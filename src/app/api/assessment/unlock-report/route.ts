// =============================================================================
// POST /api/assessment/unlock-report
// =============================================================================
// Captures an email address against a completed session, subscribes the email
// to the RLK Beehiiv newsletter, and notifies the operator that someone has
// finished the diagnostic. The session's `reportUnlockedAt` timestamp gates
// access to the full report on the client side.
//
// Side effects are fire-and-forget: failures in Beehiiv or operator email
// must not block the user from seeing their report.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSession } from '@/lib/db/store';
import { sendDiagnosticUnlockedNotification, sendReportEmail } from '@/lib/email/sender';
import { formatIndustryName } from '@/lib/diagnostic/economic';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Beehiiv publication + automation. Mirrors the RLK consulting site config.
const BEEHIIV_PUBLICATION_ID = 'pub_a8a8a961-4586-4bcc-bca5-45eacd84fc8e';
const BEEHIIV_WELCOME_AUTOMATION_ID = 'aut_3b3d188e-f99c-4f0c-b476-7f5870329824';

interface BeehiivResult {
  subscribed: boolean;
  error?: string;
}

async function subscribeToBeehiiv(email: string, sessionId: string, companyName: string): Promise<BeehiivResult> {
  const apiKey = process.env.BEEHIIV_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[unlock-report] BEEHIIV_API_KEY not set, skipping subscription for', email);
    return { subscribed: false, error: 'BEEHIIV_API_KEY not set' };
  }

  try {
    const res = await fetch(
      `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          email,
          reactivate_existing: false,
          send_welcome_email: false,
          utm_source: 'ai-diagnostic',
          utm_medium: 'report-unlock',
          utm_campaign: 'diagnostic-completion',
          referring_site: 'diagnostic.rlkconsultingco.com',
          custom_fields: [
            { name: 'company', value: companyName },
            { name: 'session_id', value: sessionId },
          ],
          automation_ids: [BEEHIIV_WELCOME_AUTOMATION_ID],
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      console.error(`[unlock-report] Beehiiv ${res.status}:`, body);
      return { subscribed: false, error: `Beehiiv ${res.status}` };
    }
    return { subscribed: true };
  } catch (err) {
    console.error('[unlock-report] Beehiiv fetch threw:', err);
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

    // Side effects, fire-and-forget. Failures here must not block the response.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://diagnostic.rlkconsultingco.com';
    const reportUrl = `${appUrl}/report?sessionId=${sessionId}`;

    // Beehiiv subscription
    const beehiivPromise = subscribeToBeehiiv(email, sessionId, updated.companyProfile.companyName);

    // Operator notification (depends on beehiiv result to populate the row)
    beehiivPromise.then((bh) => {
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
        subscribedToNewsletter: bh.subscribed,
      }).catch((err) => {
        console.error('[unlock-report] operator notification failed:', err);
      });
    });

    // Branded report email to the user. Fulfills the gate's promise of a copy
    // and gives a controlled, on-brand touchpoint rather than relying solely on
    // the Beehiiv welcome automation. Fire-and-forget.
    const dr = updated.diagnosticResult;
    if (dr) {
      sendReportEmail({
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
      }).then((res) => {
        if (!res.success) {
          console.error('[unlock-report] report email failed:', res.error);
        }
      }).catch((err) => {
        console.error('[unlock-report] report email threw:', err);
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/assessment/unlock-report]', err);
    return NextResponse.json({ error: 'Failed to unlock report' }, { status: 500 });
  }
}
