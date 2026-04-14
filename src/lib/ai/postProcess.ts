// =============================================================================
// RLK AI Diagnostic — Post-Generation Quality Pass
// =============================================================================
// Runs a single Claude call after all sections are generated to:
//   1. Remove duplicative content across sections
//   2. Fix typos and grammar issues
//   3. Ensure cross-section consistency
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import type { ReportSection } from '@/types/diagnostic';

// ---------------------------------------------------------------------------
// Client (reuse from generate.ts pattern)
// ---------------------------------------------------------------------------

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set.');
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

const MODEL = 'claude-sonnet-4-20250514';

// ---------------------------------------------------------------------------
// Deduplication + Quality Pass
// ---------------------------------------------------------------------------

export async function deduplicateReport(
  sections: ReportSection[]
): Promise<ReportSection[]> {
  // Build the concatenated input for the quality pass
  const sectionTexts = sections
    .map(
      (s, i) =>
        `=== SECTION ${i + 1}: ${s.title} (slug: ${s.slug}) ===\n${s.content}`
    )
    .join('\n\n');

  const systemPrompt = `You are a senior editorial quality controller for executive strategy reports. Your job is to review a multi-section AI diagnostic report and return a cleaned version. You MUST preserve every section's structure, headings, and analytical substance — you are editing for quality, not rewriting.

Your mandate:
1. DEDUPLICATION: Identify sentences, paragraphs, or statistics that appear nearly verbatim across multiple sections. When a point is made in an earlier section, later sections should reference "as noted in Section X" or rephrase with new context rather than repeating. A statistic cited in 1-2 sections is fine; the same stat in 3+ sections is duplicative.
2. TYPOS & GRAMMAR: Fix spelling errors, grammatical issues, and inconsistent formatting. Ensure professional tone throughout.
3. CONSISTENCY: Verify that section cross-references (e.g., "See Section 5") are internally consistent. Flag any contradictions in data or recommendations across sections.

Rules:
- Do NOT add new content, analysis, or recommendations
- Do NOT change section headings or markdown structure
- Do NOT remove substantive analysis — only remove or rephrase duplicated passages
- Preserve all specific numbers, dollar amounts, and data points
- Keep the same authoritative, direct tone
- Return the COMPLETE cleaned report with all sections, using the exact same section delimiter format`;

  const userPrompt = `Review this ${sections.length}-section AI diagnostic report for duplication, typos, and consistency issues. Return the complete cleaned version.

${sectionTexts}

Return the cleaned report using this exact format for each section:
=== SECTION N: Title (slug: slug-name) ===
[cleaned content]`;

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000, // Large enough for full report
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content
      .filter(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      )
      .map((block) => block.text)
      .join('\n\n');

    if (!text || text.length < sectionTexts.length * 0.5) {
      // Safety: if response is suspiciously short, return originals
      console.warn(
        '[postProcess] Dedup response too short — returning originals'
      );
      return sections;
    }

    // Parse the cleaned sections back out
    const cleaned = parseSections(text, sections);
    return cleaned;
  } catch (error) {
    // On any error, return originals rather than failing the report
    console.error('[postProcess] Quality pass failed, returning originals:', error);
    return sections;
  }
}

// ---------------------------------------------------------------------------
// Parse cleaned output back into ReportSection[]
// ---------------------------------------------------------------------------

function parseSections(
  text: string,
  originals: ReportSection[]
): ReportSection[] {
  const result: ReportSection[] = [];

  for (let i = 0; i < originals.length; i++) {
    const original = originals[i];
    const slug = original.slug;

    // Find the section in the cleaned output
    const pattern = new RegExp(
      `=== SECTION \\d+:.*?\\(slug: ${slug}\\) ===\\n([\\s\\S]*?)(?==== SECTION|$)`
    );
    const match = text.match(pattern);

    if (match && match[1] && match[1].trim().length > 100) {
      result.push({
        ...original,
        content: match[1].trim(),
      });
    } else {
      // If we can't parse a section, keep the original
      result.push(original);
    }
  }

  return result;
}
