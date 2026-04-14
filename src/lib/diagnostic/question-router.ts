// =============================================================================
// RLK AI Diagnostic — Industry-Aware Question Router
// =============================================================================
// Returns the diagnostic question set with industry-specific examples
// applied as subtext. The core questions remain the same across industries,
// but the context and examples are tailored to make each question more
// relevant to the respondent's industry.
// =============================================================================

import type { DiagnosticQuestion, Industry } from '@/types/diagnostic';
import { DIAGNOSTIC_QUESTIONS } from './questions';

/**
 * Returns the full question set with industry-specific examples applied.
 * If a question has `industryExamples[industry]`, that example is appended
 * to the question's subtext (or used as subtext if none exists).
 */
export function getQuestionsForIndustry(industry: Industry): DiagnosticQuestion[] {
  return DIAGNOSTIC_QUESTIONS.map((q) => {
    const example = q.industryExamples?.[industry];
    if (!example) return q;

    // Append industry example to existing subtext, or use it as subtext
    const subtext = q.subtext
      ? `${q.subtext}\n${example}`
      : example;

    return { ...q, subtext };
  });
}
