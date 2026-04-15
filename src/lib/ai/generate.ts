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
// Two-wave generation strategy for cross-section awareness
// ---------------------------------------------------------------------------

// Wave 1: Core analysis sections (generated in parallel, no prior context)
const WAVE_1_SECTIONS = [
  'executive-summary',
  'ai-posture-diagnosis',
  'structural-constraints',
  'financial-impact',
];

// Wave 2: Sections that benefit from Wave 1 findings (generated in parallel,
// with a digest of Wave 1 so they can reference earlier analysis)
const WAVE_2_SECTIONS = [
  'pnl-business-case',
  'competitive-positioning',
  'security-governance-risk',
  'vendor-landscape',
  '90-day-action-plan',
];

function buildWave1Digest(sections: ReportSection[]): string {
  const lines: string[] = [];
  for (const section of sections) {
    // Extract the first 2-3 key paragraphs from each section (skip headers)
    const paragraphs = section.content
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#'))
      .slice(0, 3)
      .join(' ');
    lines.push(`[${section.title}]: ${paragraphs.slice(0, 500)}`);
  }
  return lines.join('\n\n');
}

export async function generateFullReport(
  result: DiagnosticResult,
  research?: CompanyResearchProfile
): Promise<GeneratedReport> {
  // Wave 1: Core analysis — parallel, no cross-section context
  const wave1Promises: Promise<ReportSection>[] = WAVE_1_SECTIONS.map(
    async (slug) => {
      const content = await generateReportSection(slug, result, research);
      return { title: SECTION_TITLES[slug], slug, content };
    }
  );
  const wave1Sections = await Promise.all(wave1Promises);

  // Build digest of Wave 1 findings for Wave 2 context
  const wave1Digest = buildWave1Digest(wave1Sections);

  // Wave 2: Sections that reference Wave 1 findings — parallel with digest
  const wave2Promises: Promise<ReportSection>[] = WAVE_2_SECTIONS.map(
    async (slug) => {
      const content = await generateReportSection(slug, result, research, wave1Digest);
      return { title: SECTION_TITLES[slug], slug, content };
    }
  );
  const wave2Sections = await Promise.all(wave2Promises);

  // Combine in original section order
  const allSections = [...wave1Sections, ...wave2Sections];
  const rawSections = SECTION_ORDER.map(
    (slug) => allSections.find((s) => s.slug === slug)!
  );

  // Post-generation quality pass: deduplicate, fix contradictions, ensure consistency
  const sections = await deduplicateReport(rawSections);

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
