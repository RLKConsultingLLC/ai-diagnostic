// =============================================================================
// POST /api/payment/bypass
// =============================================================================
// Accepts a promo code and, if valid, marks the session as paid without
// going through Stripe. Used for internal testing and demo purposes.
// Also triggers the report email with PDF attachment.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/db/store';
import { sendReportEmail } from '@/lib/email/sender';
import { generateReportPDF } from '@/lib/pdf/generator';

// PDF generation + email may take time
export const maxDuration = 120;

// The bypass code is stored in an env var so it's never in source code.
// Set BYPASS_PROMO_CODE in .env.local (e.g., BYPASS_PROMO_CODE=RLK-DEMO-2026)
function getValidCodes(): string[] {
  const code = process.env.BYPASS_PROMO_CODE;
  if (!code) return [];
  // Support comma-separated codes for multiple testers
  return code.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, promoCode } = body as {
      sessionId: string;
      promoCode: string;
    };

    if (!sessionId || !promoCode) {
      return NextResponse.json(
        { error: 'sessionId and promoCode are required' },
        { status: 400 }
      );
    }

    const validCodes = getValidCodes();
    if (validCodes.length === 0) {
      return NextResponse.json(
        { error: 'Promo codes are not configured' },
        { status: 403 }
      );
    }

    if (!validCodes.includes(promoCode.trim().toUpperCase())) {
      return NextResponse.json(
        { error: 'Invalid promo code' },
        { status: 403 }
      );
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Mark as paid with a bypass identifier
    await updateSession(sessionId, {
      status: 'paid',
      paymentId: `bypass:${promoCode.trim().toUpperCase()}`,
    });

    console.log('[payment:bypass] Session unlocked', {
      sessionId,
      companyName: session.companyProfile.companyName,
      code: promoCode.trim().toUpperCase(),
    });

    // Send report email with PDF if report is already generated and email is available
    const email = session.companyProfile.executiveEmail;
    if (email && session.diagnosticResult && session.generatedReport && process.env.RESEND_API_KEY) {
      try {
        const pdfBuffer = await generateReportPDF(session.generatedReport, session.diagnosticResult);
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai-diagnostic-silk.vercel.app';

        const emailResult = await sendReportEmail({
          to: email,
          recipientName: session.companyProfile.executiveName || 'Executive',
          companyName: session.companyProfile.companyName,
          stageName: session.diagnosticResult.stageClassification.stageName,
          stageNumber: session.diagnosticResult.stageClassification.primaryStage,
          unrealizedValueLow: session.diagnosticResult.economicEstimate.unrealizedValueLow,
          unrealizedValueHigh: session.diagnosticResult.economicEstimate.unrealizedValueHigh,
          overallScore: session.diagnosticResult.overallScore,
          reportUrl: `${appUrl}/report?sessionId=${sessionId}`,
          pdfBuffer,
        });

        if (emailResult.success) {
          console.log(`[payment:bypass] Report email sent to ${email} (id: ${emailResult.id})`);
        } else {
          console.error(`[payment:bypass] Email failed: ${emailResult.error}`);
        }
      } catch (emailErr) {
        console.error('[payment:bypass] Email/PDF error:', emailErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[POST /api/payment/bypass]', err);
    return NextResponse.json(
      { error: 'Failed to process promo code' },
      { status: 500 }
    );
  }
}
