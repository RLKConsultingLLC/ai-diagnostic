// =============================================================================
// RLK AI Diagnostic — Report Generation via Claude API
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import type {
  DiagnosticResult,
  GeneratedReport,
  ReportSection,
  CompetitorPosition,
} from '@/types/diagnostic';
import type { CompanyResearchProfile } from '@/types/research';
import {
  SECTION_PROMPTS,
  SECTION_TITLES,
  SECTION_ORDER,
} from '@/lib/ai/prompts';
import { deduplicateReport } from '@/lib/ai/postProcess';

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. Add it to your environment variables.'
      );
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2048;

// ---------------------------------------------------------------------------
// Generate a single report section
// ---------------------------------------------------------------------------

export async function generateReportSection(
  sectionSlug: string,
  result: DiagnosticResult,
  research?: CompanyResearchProfile,
  priorContext?: string
): Promise<string> {
  const promptFn = SECTION_PROMPTS[sectionSlug];
  if (!promptFn) {
    throw new Error(
      `Unknown section slug: "${sectionSlug}". Valid slugs: ${Object.keys(SECTION_PROMPTS).join(', ')}`
    );
  }

  const { system, user } = promptFn(result, research);
  const fullUser = priorContext
    ? `PRIOR SECTIONS CONTEXT (reference these findings where relevant, do not repeat them verbatim):\n${priorContext}\n\n---\n\n${user}`
    : user;
  const client = getClient();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: 'user', content: fullUser }],
  });

  // Extract text from the response content blocks
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n\n');

  if (!text) {
    throw new Error(
      `Empty response from Claude for section "${sectionSlug}". Stop reason: ${response.stop_reason}`
    );
  }

  // Post-processing: remove AI writing tells (em dashes, en dashes)
  // The system prompt asks Claude not to use them, but it often ignores this.
  return text
    .replace(/—/g, ' - ')
    .replace(/–/g, '-');
}

// ---------------------------------------------------------------------------
// Single-wave parallel generation (fits within Vercel 60s function limit)
// ---------------------------------------------------------------------------

export async function generateFullReport(
  result: DiagnosticResult,
  research?: CompanyResearchProfile
): Promise<GeneratedReport> {
  // Generate all sections in parallel — single wave for speed
  const allPromises: Promise<ReportSection>[] = SECTION_ORDER.map(
    async (slug) => {
      const content = await generateReportSection(slug, result, research);
      return { title: SECTION_TITLES[slug], slug, content };
    }
  );

  // Generate competitor positions in parallel using research intelligence
  const competitorPromise = generateCompetitorPositions(result, research);

  const [sections, competitorPositions] = await Promise.all([
    Promise.all(allPromises),
    competitorPromise,
  ]);

  return {
    id: uuidv4(),
    diagnosticResultId: result.id,
    generatedAt: new Date().toISOString(),
    sections,
    companyProfile: result.companyProfile,
    stageClassification: result.stageClassification,
    economicEstimate: result.economicEstimate,
    competitorPositions,
  };
}

// ---------------------------------------------------------------------------
// Competitor position estimation via Claude + research data
// ---------------------------------------------------------------------------

async function generateCompetitorPositions(
  result: DiagnosticResult,
  research?: CompanyResearchProfile,
): Promise<CompetitorPosition[]> {
  try {
    const client = getClient();
    const industry = result.companyProfile.industry;
    const capScore = (
      (result.dimensionScores.find(d => d.dimension === 'adoption_behavior')?.normalizedScore || 0) * 0.5 +
      (result.dimensionScores.find(d => d.dimension === 'workflow_integration')?.normalizedScore || 0) * 0.5
    );
    const readyScore = (
      (result.dimensionScores.find(d => d.dimension === 'authority_structure')?.normalizedScore || 0) * 0.4 +
      (result.dimensionScores.find(d => d.dimension === 'decision_velocity')?.normalizedScore || 0) * 0.3 +
      (result.dimensionScores.find(d => d.dimension === 'economic_translation')?.normalizedScore || 0) * 0.3
    );

    // Build research context for Claude
    let researchContext = '';
    if (research?.competitorAIActivity?.length) {
      researchContext += '\nCOMPETITOR AI ACTIVITY (from public research):\n';
      research.competitorAIActivity.forEach((c) => {
        researchContext += `- ${c.competitorName}: ${c.activity} (${c.source}, ${c.date}). Implication: ${c.implication}\n`;
      });
    }
    if (research?.industryTrends?.length) {
      researchContext += '\nINDUSTRY AI TRENDS:\n';
      research.industryTrends.forEach((t) => {
        researchContext += `- ${t.trend}: ${t.relevance} (${t.source})\n`;
      });
    }
    if (research?.competitivePositionNote) {
      researchContext += `\nCOMPETITIVE POSITION ANALYSIS:\n${research.competitivePositionNote}\n`;
    }
    if (research?.aiInvestments?.length) {
      researchContext += '\nKNOWN AI INVESTMENTS IN INDUSTRY:\n';
      research.aiInvestments.slice(0, 5).forEach((inv) => {
        researchContext += `- [${inv.category}] ${inv.description}${inv.amount ? ` ($${inv.amount})` : ''} (${inv.source})\n`;
      });
    }

    const prompt = `You are an AI maturity analyst. Estimate the competitive positioning of 5 anonymous competitors in the ${industry.replace(/_/g, ' ')} industry on a 2x2 matrix.

The axes are:
- AI Capability (0-100): How effectively the organization adopts and integrates AI tools into workflows
- Organizational Readiness (0-100): Governance structures, decision velocity, and economic translation capabilities

The assessed company scores: Capability=${Math.round(capScore)}, Readiness=${Math.round(readyScore)}.

Use these data sources to estimate realistic competitor positions:
1. McKinsey 2024 Global AI Survey industry benchmarks
2. BCG AI Advantage Report peer analytics
3. Gartner industry maturity curves
4. Any specific competitor intelligence below
${researchContext || '\nNo company-specific competitor data available. Use industry benchmarks only.'}

Return ONLY valid JSON - an array of exactly 5 competitors:
[
  { "label": "Comp. A", "capability": 75, "readiness": 70, "rationale": "Industry leader based on..." },
  { "label": "Comp. B", "capability": 60, "readiness": 55, "rationale": "..." },
  ...
]

Rules:
- Positions must reflect realistic industry distribution (not random)
- At least one competitor should be in the upper-right (leader)
- At least one should be in lower-left (laggard)
- Spread should reflect actual industry AI maturity variance
- If competitor intelligence is available, use it to place specific competitors more accurately
- Rationale must cite the data source informing the placement
- Labels must be Comp. A through Comp. E (anonymized)`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: 'You are an AI industry analyst. Respond ONLY with valid JSON array. No markdown, no explanation.',
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as CompetitorPosition[];
    return parsed.filter(c => c.label && typeof c.capability === 'number' && typeof c.readiness === 'number').slice(0, 5);
  } catch (err) {
    console.error('[Report] Competitor position generation failed:', err);
    return []; // Fallback to static benchmarks on frontend
  }
}
