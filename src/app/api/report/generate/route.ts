// =============================================================================
// POST /api/report/generate
// =============================================================================
// Generates an AI-powered diagnostic report from a completed diagnostic.
// Incorporates background research data (10-K, news, leadership intel) if
// available — this is what makes the report feel deeply custom.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/db/store';
import { generateFullReport } from '@/lib/ai/generate';
import { getResearchProfile, getResearchStatus } from '@/lib/research/engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body as { sessionId: string };

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: `Session not found: ${sessionId}` },
        { status: 404 }
      );
    }

    if (!session.diagnosticResult) {
      return NextResponse.json(
        { error: 'Diagnostic has not been completed for this session. Submit responses first.' },
        { status: 400 }
      );
    }

    // Fetch background research if available
    // This was kicked off when the assessment started and has been running
    // in parallel while the customer answered diagnostic questions
    const researchProfile = await getResearchProfile(sessionId);
    const researchStatus = await getResearchStatus(sessionId);

    if (researchProfile) {
      console.log(
        `[Report] Research available for ${session.companyProfile.companyName}: ` +
        `${researchProfile.sourcesConsulted} sources, ` +
        `confidence: ${researchProfile.confidenceLevel}`
      );
    } else {
      console.log(
        `[Report] No research available (status: ${researchStatus?.status || 'not started'}). ` +
        `Generating report with diagnostic data only.`
      );
    }

    // Generate the full AI report — enriched with research if available
    const report = await generateFullReport(session.diagnosticResult, researchProfile ?? undefined);

    await updateSession(sessionId, {
      generatedReport: report,
      status: 'report_generated',
    });

    return NextResponse.json({
      report,
      researchAvailable: !!researchProfile,
      researchConfidence: researchProfile?.confidenceLevel,
      sourcesConsulted: researchProfile?.sourcesConsulted || 0,
    });
  } catch (err: unknown) {
    console.error('[POST /api/report/generate]', err);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
