// =============================================================================
// RLK AI Diagnostic — Report Generation via Claude API
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import type {
  DiagnosticResult,
  GeneratedReport,
  ReportSection,
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

  return text;
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
  const sections = await Promise.all(allPromises);

  return {
    id: uuidv4(),
    diagnosticResultId: result.id,
    generatedAt: new Date().toISOString(),
    sections,
    companyProfile: result.companyProfile,
    stageClassification: result.stageClassification,
    economicEstimate: result.economicEstimate,
  };
}
