// =============================================================================
// POST /api/assessment/start
// =============================================================================
// Creates a new AssessmentSession and returns it alongside the question list.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/db/store';
import { DIAGNOSTIC_QUESTIONS } from '@/lib/diagnostic/questions';
import { startBackgroundResearch } from '@/lib/research/engine';
import type { CompanyProfile } from '@/types/diagnostic';

const REQUIRED_FIELDS: (keyof CompanyProfile)[] = [
  'companyName',
  'industry',
  'revenue',
  'employeeCount',
  'publicOrPrivate',
  'regulatoryIntensity',
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const profile = body as CompanyProfile;

    // Validate required fields
    const missing = REQUIRED_FIELDS.filter(
      (field) => profile[field] === undefined || profile[field] === null || profile[field] === ''
    );

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    const session = await createSession(profile);

    // Kick off background research immediately — runs while customer answers questions
    // This searches SEC filings, news, press releases, leadership interviews, etc.
    // and uses Claude to synthesize a deep company intelligence profile
    startBackgroundResearch(session.id, profile);

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
