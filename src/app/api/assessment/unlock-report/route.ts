// =============================================================================
// POST /api/assessment/unlock-report
// =============================================================================
// Captures an email address against a completed session, subscribes the email
// to the RLK MailerLite newsletter, and notifies the operator that someone has
// finished the diagnostic. The session's `reportUnlockedAt` timestamp gates
// access to the full report on the client side.
//
// Side effects are awaited (Vercel serverless freezes on response flush).
// Failures in MailerLite or operator email must not block the user from
// seeing their report.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/db/store';
import { sendDiagnosticUnlockedNotification, sendReportEmail } from '@/lib/email/sender';
import { formatIndustryName } from '@/lib/diagnostic/economic';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ML_GROUP_DISPATCH     = '190844532918584468';
const ML_GROUP_NEW_UNSORTED = '191003221215413502';

interface SubscribeResult {
  subscribed: boolean;
  error?: string;
}

async function subscribeToMailerLite(email: string, companyName: string): Promise<SubscribeResult> {
  const apiKey = process.env.MAILERLITE_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[unlock-report] MAILERLITE_API_KEY not set, skipping subscription for', email);
    return { subscribed: false, error: 'MAILERLITE_API_KEY not set' };
  }

  try {
    const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email,
        fields: { company: companyName },
        groups: [ML_GROUP_DISPATCH, ML_GROUP_NEW_UNSORTED],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[unlock-report] MailerLite ${res.status}:`, body);
      return { subscribed: false, error: `MailerLite ${res.status}` };
    }
    return { subscribed: true };
  } catch (err) {
    console.error('[unlock-report] MailerLite fetch threw:', err);
    return { subscribed: false, error: err instanceof Error ? err.message : 'unknown error' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, email: rawEmail } = body as { sessionId?: string; email?: string };

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Idempotent: if already unlocked, just return success.
    if (session.reportUnlockedAt) {
      return NextResponse.json({ success: true, alreadyUnlocked: true });
    }

    // Persist email + unlock timestamp before triggering side effects.
    const nowIso = new Date().toISOString();
    const updated = await updateSession(sessionId, {
      reportUnlockedAt: nowIso,
      companyProfile: {
        ...session.companyProfile,
        executiveEmail: email,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://diagnostic.rlkconsultingco.com';
    const reportUrl = `${appUrl}/report?sessionId=${sessionId}`;
    const dr = updated.diagnosticResult;

    const ml = await subscribeToMailerLite(email, updated.companyProfile.companyName);

    await Promise.allSettled([
      sendDiagnosticUnlockedNotification({
        companyName: updated.companyProfile.companyName,
        industryLabel: formatIndustryName(updated.companyProfile.industry),
        revenue: updated.companyProfile.revenue,
        employeeCount: updated.companyProfile.employeeCount,
        executiveName: updated.companyProfile.executiveName,
        executiveTitle: updated.companyProfile.executiveTitle,
        executiveEmail: email,
        websiteUrl: updated.companyProfile.websiteUrl,
        ticker: updated.companyProfile.ticker,
        overallScore: updated.diagnosticResult?.overallScore,
        stageName: updated.diagnosticResult?.stageClassification?.stageName,
        sessionId,
        reportUrl,
        timestamp: nowIso,
        subscribedToNewsletter: ml.subscribed,
      }),
      // Branded report email to the user. Fulfills the gate's promise of a copy
      // and is the controlled, on-brand touchpoint. Only sent once the report
      // has been generated (diagnosticResult present).
      dr
        ? sendReportEmail({
            to: email,
            recipientName: updated.companyProfile.executiveName || updated.companyProfile.companyName,
            companyName: updated.companyProfile.companyName,
            stageName: dr.stageClassification.stageName,
            stageNumber: dr.stageClassification.primaryStage,
            unrealizedValueLow: dr.economicEstimate.unrealizedValueLow,
            unrealizedValueHigh: dr.economicEstimate.unrealizedValueHigh,
            overallScore: dr.overallScore,
            reportUrl,
            calendlyUrl: process.env.CALENDLY_URL,
          })
        : Promise.resolve(),
    ]);

    return NextResponse.json({ success: true, subscribed: ml.subscribed });
  } catch (err) {
    console.error('[POST /api/assessment/unlock-report]', err);
    return NextResponse.json({ error: 'Failed to unlock report' }, { status: 500 });
  }
}
