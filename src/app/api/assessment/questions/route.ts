// =============================================================================
// GET /api/assessment/questions
// =============================================================================
// Returns all 36 diagnostic questions so the frontend can fetch the real
// question bank without hardcoding them.
// =============================================================================

import { NextResponse } from 'next/server';
import { DIAGNOSTIC_QUESTIONS } from '@/lib/diagnostic/questions';

export async function GET() {
  return NextResponse.json({ questions: DIAGNOSTIC_QUESTIONS });
}
