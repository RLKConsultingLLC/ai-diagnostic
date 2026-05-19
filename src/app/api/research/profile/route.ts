// =============================================================================
// GET /api/research/profile?sessionId=xxx
// =============================================================================
// Returns the full CompanyResearchProfile for a session if research is
// complete. Used by the report page to overlay publicly available evidence
// onto the self-reported diagnostic scores.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getResearchProfile, getResearchStatus } from '@/lib/research/engine';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  const status = await getResearchStatus(sessionId);
  if (!status) {
    return NextResponse.json({ status: 'none', profile: null }, { status: 200 });
  }

  const profile = await getResearchProfile(sessionId);
  return NextResponse.json({
    sessionId,
    status: status.status,
    completedAt: status.completedAt,
    profile,
  });
}
