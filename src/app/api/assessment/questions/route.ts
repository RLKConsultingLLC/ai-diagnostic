// =============================================================================
// GET /api/assessment/questions
// =============================================================================
// Returns diagnostic questions, optionally tailored with industry-specific
// examples when an industry query parameter is provided.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import type { Industry } from '@/types/diagnostic';
import { DIAGNOSTIC_QUESTIONS } from '@/lib/diagnostic/questions';
import { getQuestionsForIndustry } from '@/lib/diagnostic/question-router';

export async function GET(request: NextRequest) {
  const industry = request.nextUrl.searchParams.get('industry') as Industry | null;

  if (industry) {
    return NextResponse.json({ questions: getQuestionsForIndustry(industry) });
  }

  return NextResponse.json({ questions: DIAGNOSTIC_QUESTIONS });
}
