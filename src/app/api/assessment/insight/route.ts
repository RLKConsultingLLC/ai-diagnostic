// =============================================================================
// POST /api/assessment/insight
// =============================================================================
// Returns real-time AI-generated feedback after each dimension is completed.
// Called once per dimension (5 times total during assessment).
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Anthropic client singleton
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

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 300;

// ---------------------------------------------------------------------------
// Dimension display names for the prompt
// ---------------------------------------------------------------------------

const DIMENSION_LABELS: Record<string, string> = {
  adoption_behavior: 'Adoption Behavior',
  authority_structure: 'Authority Structure',
  workflow_integration: 'Workflow Integration',
  decision_velocity: 'Decision Velocity',
  economic_translation: 'Economic Translation',
};

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

interface InsightRequest {
  dimension: string;
  responses: { questionId: string; score: number }[];
  companyName: string;
  industry: string;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as InsightRequest;
    const { dimension, responses, companyName, industry } = body;

    // --- Validate inputs ---------------------------------------------------
    if (!dimension || !DIMENSION_LABELS[dimension]) {
      return NextResponse.json(
        {
          error: `Invalid dimension. Must be one of: ${Object.keys(DIMENSION_LABELS).join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(responses) || responses.length === 0) {
      return NextResponse.json(
        { error: 'responses must be a non-empty array of { questionId, score }' },
        { status: 400 }
      );
    }

    if (!companyName || typeof companyName !== 'string') {
      return NextResponse.json(
        { error: 'companyName is required' },
        { status: 400 }
      );
    }

    if (!industry || typeof industry !== 'string') {
      return NextResponse.json(
        { error: 'industry is required' },
        { status: 400 }
      );
    }

    // --- Calculate the dimension score (average) ---------------------------
    const totalScore = responses.reduce((sum, r) => sum + r.score, 0);
    const dimensionScore = Math.round((totalScore / responses.length) * 100) / 100;

    // --- Build prompts and call Claude ------------------------------------
    const dimensionLabel = DIMENSION_LABELS[dimension];

    const systemPrompt =
      'You are a senior partner at a top-tier strategy firm (McKinsey, Bain caliber) ' +
      'briefing a CIO on what their organization\'s behavioral patterns reveal. ' +
      'Your job is to say something the CIO does NOT already know. Do not summarize their score. ' +
      'Instead, identify the structural implication: what organizational dynamic is their score a symptom of? ' +
      'What hidden constraint or untapped leverage point does the pattern suggest? ' +
      'Write exactly 2 sentences. First sentence: the non-obvious structural finding. ' +
      'Second sentence: what this means for their ability to capture AI value. ' +
      'Never use the words "journey", "maturity", or "suggests that". ' +
      'Never use em dashes or double dashes. Use commas or periods instead. ' +
      'Tone: direct, peer-level, like a partner speaking to a C-suite peer over coffee.';

    const scoreContext = dimensionScore <= 1.5 ? 'critical gap'
      : dimensionScore <= 2.5 ? 'structural friction'
      : dimensionScore <= 3.5 ? 'emerging capability with constraints'
      : dimensionScore <= 4.5 ? 'strong foundation'
      : 'advanced capability';

    const dimensionContext: Record<string, string> = {
      adoption_behavior: `Low adoption scores in ${industry} typically indicate the problem is not awareness or access, but that AI tools are failing to cross the "workflow threshold" where usage becomes self-reinforcing. The real question is whether employees see AI as additive work or as work replacement.`,
      authority_structure: `Authority structure scores reveal who actually controls the pace of AI adoption. In ${industry}, the most common bottleneck is not executive resistance but the absence of a clear escalation path when AI initiatives conflict with existing process owners.`,
      workflow_integration: `Integration scores expose the gap between AI as a standalone tool and AI as infrastructure. For ${industry} organizations, the critical indicator is whether AI outputs feed directly into decision workflows or require manual handoff, which is where most value evaporates.`,
      decision_velocity: `Decision velocity in ${industry} is shaped less by technology and more by how many organizational layers an AI initiative must traverse before it can move from pilot to production. Speed here is a proxy for structural trust in AI-driven outcomes.`,
      economic_translation: `Economic translation is where most AI programs fail: not in deployment, but in connecting deployed capabilities to measurable financial outcomes. In ${industry}, the gap is typically between teams that "use AI" and finance teams that can quantify what that usage produces.`,
    };

    const userPrompt =
      `Company: ${companyName}\n` +
      `Industry: ${industry}\n` +
      `Dimension: ${dimensionLabel}\n` +
      `Score pattern: ${scoreContext} (${dimensionScore}/5 avg across ${responses.length} questions)\n\n` +
      `Industry context: ${dimensionContext[dimension] || ''}\n\n` +
      `Given this score pattern, deliver a 2-sentence structural insight that a CIO would find genuinely surprising or clarifying. Do not restate the score or say "your organization scored X". Instead, name the specific organizational dynamic their answers reveal and what it means for AI value capture.`;

    const client = getClient();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Extract text from response content blocks
    const insight = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n\n');

    if (!insight) {
      throw new Error(
        `Empty response from Claude for dimension "${dimension}". Stop reason: ${message.stop_reason}`
      );
    }

    return NextResponse.json({ insight, dimensionScore });
  } catch (err: unknown) {
    console.error('[POST /api/assessment/insight]', err);
    return NextResponse.json(
      { error: 'Failed to generate dimension insight' },
      { status: 500 }
    );
  }
}
