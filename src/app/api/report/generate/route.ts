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
import { computeResearchAdjustments } from '@/lib/diagnostic/research-integration';
// Report generation calls Claude and can take 30-90s
export const maxDuration = 120;

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

    // Run research-diagnostic integration if research is available
    if (researchProfile && session.diagnosticResult) {
      const adjustments = computeResearchAdjustments(
        session.diagnosticResult,
        researchProfile
      );

      // Attach research alignment narrative for AI prompt context
      session.diagnosticResult.researchAlignment = adjustments.narrative;

      // Apply confidence modifier
      if (adjustments.confidenceModifier !== 0) {
        session.diagnosticResult.stageClassification.confidence = Math.max(
          0.65,
          Math.min(
            1.0,
            session.diagnosticResult.stageClassification.confidence +
              adjustments.confidenceModifier
          )
        );
      }

      if (adjustments.discrepancies.length > 0) {
        console.log(
          `[Report] Research-diagnostic discrepancies: ${adjustments.discrepancies.length} found. ` +
          `Confidence modifier: ${adjustments.confidenceModifier > 0 ? '+' : ''}${adjustments.confidenceModifier.toFixed(2)}`
        );
      }
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
