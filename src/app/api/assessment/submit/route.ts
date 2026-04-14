// =============================================================================
// POST /api/assessment/submit
// =============================================================================
// Accepts completed responses, runs the diagnostic engine, and returns results.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/db/store';
import { runDiagnostic } from '@/lib/diagnostic/engine';
import { DIAGNOSTIC_QUESTIONS } from '@/lib/diagnostic/questions';
import type { AssessmentResponse } from '@/types/diagnostic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, responses } = body as {
      sessionId: string;
      responses: AssessmentResponse[];
    };

    // Validate inputs
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(responses) || responses.length === 0) {
      return NextResponse.json(
        { error: 'responses must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate each response has a valid question and score
    const validQuestionIds = new Set(DIAGNOSTIC_QUESTIONS.map((q) => q.id));
    for (const r of responses) {
      if (!validQuestionIds.has(r.questionId)) {
        return NextResponse.json(
          { error: `Invalid questionId: ${r.questionId}` },
          { status: 400 }
        );
      }
      const question = DIAGNOSTIC_QUESTIONS.find((q) => q.id === r.questionId);
      if (
        question &&
        (r.selectedOptionIndex < 0 || r.selectedOptionIndex >= question.options.length)
      ) {
        return NextResponse.json(
          { error: `Invalid option index ${r.selectedOptionIndex} for question ${r.questionId}` },
          { status: 400 }
        );
      }
    }

    // Fetch session
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: `Session not found: ${sessionId}` },
        { status: 404 }
      );
    }

    // Run the diagnostic engine
    const result = runDiagnostic(responses, session.companyProfile);

    // Persist results to session
    await updateSession(sessionId, {
      responses,
      status: 'completed',
      diagnosticResult: result,
      currentQuestionIndex: responses.length,
    });

    return NextResponse.json({ result });
  } catch (err: unknown) {
    console.error('[POST /api/assessment/submit]', err);
    return NextResponse.json(
      { error: 'Failed to process assessment submission' },
      { status: 500 }
    );
  }
}
