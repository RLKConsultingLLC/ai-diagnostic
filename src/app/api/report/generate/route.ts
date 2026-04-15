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
import { sendReportEmail } from '@/lib/email/sender';

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

    // Send the report delivery email if an executive email was provided
    const executiveEmail = session.companyProfile.executiveEmail;
    if (executiveEmail && process.env.RESEND_API_KEY) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai-diagnostic-silk.vercel.app';
      const reportUrl = `${appUrl}/report?sessionId=${sessionId}`;

      try {
        const emailResult = await sendReportEmail({
          to: executiveEmail,
          recipientName: session.companyProfile.executiveName || 'Executive',
          companyName: session.companyProfile.companyName,
          stageName: session.diagnosticResult.stageClassification.stageName,
          stageNumber: session.diagnosticResult.stageClassification.primaryStage,
          unrealizedValueLow: session.diagnosticResult.economicEstimate.unrealizedValueLow,
          unrealizedValueHigh: session.diagnosticResult.economicEstimate.unrealizedValueHigh,
          overallScore: session.diagnosticResult.overallScore,
          reportUrl,
        });

        if (emailResult.success) {
          console.log(`[Report] Email sent to ${executiveEmail} (id: ${emailResult.id})`);
        } else {
          console.error(`[Report] Email failed for ${executiveEmail}: ${emailResult.error}`);
        }
      } catch (emailErr) {
        // Don't fail the report generation if email fails
        console.error('[Report] Email delivery error:', emailErr);
      }
    } else if (executiveEmail && !process.env.RESEND_API_KEY) {
      console.log('[Report] Skipping email — RESEND_API_KEY not configured');
    }

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
