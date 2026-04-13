// =============================================================================
// POST /api/report/generate
// =============================================================================
// Generates an AI-powered board brief report from a completed diagnostic.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/db/store';
import { generateFullReport } from '@/lib/ai/generate';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body as { sessionId: string };

    // Validate input
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Fetch session
    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: `Session not found: ${sessionId}` },
        { status: 404 }
      );
    }

    // Ensure diagnostic has been completed
    if (!session.diagnosticResult) {
      return NextResponse.json(
        { error: 'Diagnostic has not been completed for this session. Submit responses first.' },
        { status: 400 }
      );
    }

    // Generate the full AI report
    const report = await generateFullReport(session.diagnosticResult);

    // Persist report to session
    await updateSession(sessionId, {
      generatedReport: report,
      status: 'report_generated',
    });

    return NextResponse.json({ report });
  } catch (err: unknown) {
    console.error('[POST /api/report/generate]', err);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
