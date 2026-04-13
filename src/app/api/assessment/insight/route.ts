// =============================================================================
// POST /api/assessment/insight
// =============================================================================
// Returns escalating AI-generated feedback after each dimension is completed.
// Each subsequent dimension produces richer, more cross-cutting analysis
// that builds the case for the full report.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

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

const MODEL = 'claude-sonnet-4-20250514';

const DIMENSION_LABELS: Record<string, string> = {
  adoption_behavior: 'Adoption Behavior',
  authority_structure: 'Authority Structure',
  workflow_integration: 'Workflow Integration',
  decision_velocity: 'Decision Velocity',
  economic_translation: 'Economic Translation',
};

interface DimensionResponseSet {
  dimension: string;
  responses: { questionId: string; score: number }[];
  averageScore: number;
}

interface InsightRequest {
  dimension: string;
  responses: { questionId: string; score: number }[];
  companyName: string;
  industry: string;
  employeeCount?: number;
  revenue?: number;
  // All previously completed dimensions + their scores
  completedDimensions?: DimensionResponseSet[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as InsightRequest;
    const { dimension, responses, companyName, industry, employeeCount, revenue, completedDimensions } = body;

    if (!dimension || !DIMENSION_LABELS[dimension]) {
      return NextResponse.json(
        { error: `Invalid dimension. Must be one of: ${Object.keys(DIMENSION_LABELS).join(', ')}` },
        { status: 400 }
      );
    }

    if (!Array.isArray(responses) || responses.length === 0) {
      return NextResponse.json(
        { error: 'responses must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!companyName || !industry) {
      return NextResponse.json({ error: 'companyName and industry are required' }, { status: 400 });
    }

    const totalScore = responses.reduce((sum, r) => sum + r.score, 0);
    const dimensionScore = Math.round((totalScore / responses.length) * 100) / 100;

    // Determine which "layer" we are on (1-5) based on completed dimensions
    const completedCount = (completedDimensions?.length ?? 0) + 1;
    const dimensionLabel = DIMENSION_LABELS[dimension];

    // Build cumulative context from all prior dimensions
    let priorContext = '';
    if (completedDimensions && completedDimensions.length > 0) {
      priorContext = '\n\nPREVIOUS DIMENSIONS COMPLETED:\n' +
        completedDimensions.map(d =>
          `- ${DIMENSION_LABELS[d.dimension]}: ${d.averageScore.toFixed(1)}/5`
        ).join('\n');
    }

    const scoreContext = dimensionScore <= 1.5 ? 'critical gap'
      : dimensionScore <= 2.5 ? 'structural friction'
      : dimensionScore <= 3.5 ? 'emerging capability with constraints'
      : dimensionScore <= 4.5 ? 'strong foundation'
      : 'advanced capability';

    // Escalating prompt strategy: each layer gets more sophisticated
    const layerPrompts: Record<number, { system: string; format: string; maxTokens: number }> = {
      // Layer 1: Sharp structural insight (2 sentences)
      1: {
        system:
          'You are a senior partner at a top-tier strategy firm (McKinsey, Bain caliber) ' +
          'briefing a CIO on what their behavioral patterns reveal. ' +
          'Your job is to say something the CIO does NOT already know. Do not summarize their score. ' +
          'Instead, identify the structural implication: what organizational dynamic is their score a symptom of? ' +
          'Write exactly 2 sentences. First: the non-obvious structural finding. Second: what this means for AI value capture. ' +
          'Never use the words "journey", "maturity", or "suggests that". Never use em dashes or double dashes. ' +
          'Tone: direct, peer-level.',
        format: 'Deliver a 2-sentence structural insight.',
        maxTokens: 250,
      },
      // Layer 2: Cross-dimensional pattern emerges (3 sentences + a teaser)
      2: {
        system:
          'You are a senior partner presenting an emerging pattern to a CIO. You now have TWO data points ' +
          'and can start seeing how dimensions interact. ' +
          'Your job: identify the connection between these two dimensions that the CIO cannot see from inside the organization. ' +
          'Write 3 sentences. Sentence 1: the cross-dimensional pattern you see forming. ' +
          'Sentence 2: the specific organizational consequence of this pattern. ' +
          'Sentence 3: a forward-looking statement hinting at what the full picture will reveal (build anticipation for the full report). ' +
          'Never use "journey", "maturity", or em dashes. Tone: increasingly authoritative.',
        format: 'Deliver a 3-sentence cross-dimensional insight that connects this dimension to the previous one.',
        maxTokens: 350,
      },
      // Layer 3: Structural diagnosis crystallizes (4 sentences + economic hint)
      3: {
        system:
          'You are a senior partner and the structural diagnosis is crystallizing. With THREE dimensions complete, ' +
          'you can now see the organizational architecture that is either enabling or constraining AI value. ' +
          'Write 4 sentences. Sentence 1: name the dominant structural pattern across all three dimensions. ' +
          'Sentence 2: explain how this pattern specifically constrains value capture in their industry. ' +
          'Sentence 3: provide a preliminary economic signal (e.g., "organizations with this pattern typically capture ' +
          'less than 30% of their AI potential"). Sentence 4: state what the remaining dimensions will clarify. ' +
          'Never use "journey", "maturity", or em dashes. Reference their industry by name. ' +
          'Tone: the confidence of someone who has seen this pattern hundreds of times.',
        format: 'Deliver a 4-sentence structural diagnosis with an economic signal.',
        maxTokens: 450,
      },
      // Layer 4: Full structural picture + competitive framing (5 sentences)
      4: {
        system:
          'You are a senior partner and the picture is now nearly complete. FOUR of five dimensions are in. ' +
          'You can now deliver a substantive preliminary diagnosis. ' +
          'Write 5 sentences. Sentence 1: state the organization\'s structural AI posture in one clear sentence. ' +
          'Sentence 2: identify the single biggest bottleneck revealed across all four dimensions. ' +
          'Sentence 3: frame this against their competitive landscape (name the type of competitors gaining advantage). ' +
          'Sentence 4: provide a more specific economic estimate (e.g., "for an organization of this size and profile, ' +
          'the unrealized value is likely in the range of..."). ' +
          'Sentence 5: state that the final dimension (Economic Translation) will determine whether the organization ' +
          'can actually capture the value the first four dimensions suggest is available. ' +
          'Never use "journey", "maturity", or em dashes. Reference their industry and approximate size. ' +
          'Tone: the gravity of a partner about to present findings to the board.',
        format: 'Deliver a 5-sentence preliminary diagnosis with competitive and economic framing.',
        maxTokens: 550,
      },
      // Layer 5: Complete synthesis + the close (6 sentences, make the report feel essential)
      5: {
        system:
          'You are a senior partner and all five dimensions are now complete. This is the moment of synthesis. ' +
          'The CIO is about to decide whether the full report is worth purchasing. ' +
          'Your insight must demonstrate that you have found something specific, non-obvious, and consequential ' +
          'that the CIO needs to understand in full. ' +
          'Write 6 sentences. Sentences 1-2: deliver the core structural finding across all five dimensions. ' +
          'Name the specific pattern and what it means for this organization. ' +
          'Sentence 3: quantify the gap between where they are and where they should be. ' +
          'Sentence 4: name the single highest-leverage intervention point your analysis has identified. ' +
          'Sentence 5: reference that the full report includes company-specific intelligence from public filings, ' +
          'news, competitive analysis, and a vendor landscape assessment that will make these findings actionable. ' +
          'Sentence 6: close with a statement about what the 90-day action plan in the full report will address. ' +
          'Never use "journey", "maturity", or em dashes. Be specific to their industry and size. ' +
          'Tone: the confident close of a $100K engagement pitch.',
        format: 'Deliver a 6-sentence complete synthesis that makes the full report feel essential.',
        maxTokens: 650,
      },
    };

    const layer = layerPrompts[Math.min(completedCount, 5)] || layerPrompts[1];

    const sizeContext = employeeCount
      ? `\nCompany size: ~${employeeCount.toLocaleString()} employees`
      : '';
    const revenueContext = revenue
      ? `\nRevenue: ~$${(revenue / 1e6).toFixed(0)}M`
      : '';

    const userPrompt =
      `Company: ${companyName}\n` +
      `Industry: ${industry}` +
      sizeContext +
      revenueContext +
      `\n\nDimension just completed: ${dimensionLabel}\n` +
      `Score pattern: ${scoreContext} (${dimensionScore}/5 avg across ${responses.length} questions)` +
      priorContext +
      `\n\n${layer.format}`;

    const client = getClient();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: layer.maxTokens,
      system: layer.system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const insight = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n\n');

    if (!insight) {
      throw new Error(`Empty response for dimension "${dimension}".`);
    }

    // Build a "report preview" teaser based on layer
    const reportPreview = buildReportPreview(completedCount, dimensionScore, companyName);

    return NextResponse.json({
      insight,
      dimensionScore,
      layer: completedCount,
      reportPreview,
    });
  } catch (err: unknown) {
    console.error('[POST /api/assessment/insight]', err);
    return NextResponse.json(
      { error: 'Failed to generate dimension insight' },
      { status: 500 }
    );
  }
}

// Progressive report preview teasers that build anticipation
function buildReportPreview(layer: number, _score: number, companyName: string): {
  unlockedSections: string[];
  nextUnlock: string | null;
  valueTeaser: string;
} {
  const allSections = [
    'AI Posture Diagnosis',
    'Structural Constraints Analysis',
    'Financial Impact Quantification',
    'Competitive Positioning',
    'Security & Governance Risk Assessment',
    'Vendor Landscape Analysis',
    '90-Day Action Plan',
  ];

  const unlockMap: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 5, 5: 7 };
  const unlockedCount = unlockMap[layer] || 1;
  const unlockedSections = allSections.slice(0, unlockedCount);
  const nextUnlock = unlockedCount < allSections.length ? allSections[unlockedCount] : null;

  const teasers: Record<number, string> = {
    1: `Your responses are shaping the first layer of ${companyName}'s AI diagnostic profile.`,
    2: `Cross-dimensional patterns are emerging. Your report is becoming specific to ${companyName}'s organizational structure.`,
    3: `Your report now includes financial modeling. We are estimating ${companyName}'s unrealized AI value.`,
    4: `Competitive positioning analysis is being built. Your report will include industry-specific benchmarking.`,
    5: `All five dimensions complete. Your full report includes 7 sections of company-specific analysis, enriched with public intelligence on ${companyName}.`,
  };

  return {
    unlockedSections,
    nextUnlock,
    valueTeaser: teasers[layer] || teasers[1],
  };
}
