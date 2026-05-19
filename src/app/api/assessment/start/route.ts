// =============================================================================
// POST /api/assessment/start
// =============================================================================
// Creates a new AssessmentSession and returns it alongside the question list.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/db/store';
import { DIAGNOSTIC_QUESTIONS } from '@/lib/diagnostic/questions';
import { startBackgroundResearch } from '@/lib/research/engine';
import { validateCompanyProfile } from '@/lib/validation/intake';
import type { CompanyProfile } from '@/types/diagnostic';
import { sendDiagnosticStartedNotification } from '@/lib/email/sender';
import { formatIndustryName } from '@/lib/diagnostic/economic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const profile = body as CompanyProfile;

    // Validate profile using shared validator
    const validation = validateCompanyProfile(profile);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400 }
      );
    }

    const session = await createSession(profile);

    // Kick off background research immediately. runs while customer answers questions
    // This searches SEC filings, news, press releases, leadership interviews, etc.
    // and uses Claude to synthesize a deep company intelligence profile
    startBackgroundResearch(session.id, profile);

    // Fire-and-forget operator notification. Failure here must not block the
    // user from starting the diagnostic, so we swallow errors and log them.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://diagnostic.rlkconsultingco.com';
    sendDiagnosticStartedNotification({
      companyName: profile.companyName,
      industryLabel: formatIndustryName(profile.industry),
      revenue: profile.revenue,
      employeeCount: profile.employeeCount,
      publicOrPrivate: profile.publicOrPrivate,
      regulatoryIntensity: profile.regulatoryIntensity,
      executiveName: profile.executiveName,
      executiveTitle: profile.executiveTitle,
      executiveEmail: profile.executiveEmail,
      websiteUrl: profile.websiteUrl,
      ticker: profile.ticker,
      sessionId: session.id,
      reportUrl: `${appUrl}/report?sessionId=${session.id}`,
      timestamp: new Date().toISOString(),
    }).catch((err) => {
      console.error('[POST /api/assessment/start] operator notification failed:', err);
    });

    return NextResponse.json(
      { session, questions: DIAGNOSTIC_QUESTIONS },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('[POST /api/assessment/start]', err);
    return NextResponse.json(
      { error: 'Failed to create assessment session' },
      { status: 500 }
    );
  }
}
