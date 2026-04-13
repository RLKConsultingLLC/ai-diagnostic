// =============================================================================
// GET /api/research/status?sessionId=xxx
// =============================================================================
// Returns the current status of background research for a session.
// Frontend polls this to show research progress while user takes diagnostic.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getResearchStatus } from '@/lib/research/engine';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  const status = await getResearchStatus(sessionId);

  if (!status) {
    return NextResponse.json({ error: 'No research job found' }, { status: 404 });
  }

  // Return status without the full profile (to keep payload small during polling)
  return NextResponse.json({
    sessionId: status.sessionId,
    companyName: status.companyName,
    status: status.status,
    startedAt: status.startedAt,
    completedAt: status.completedAt,
    progress: status.progress,
    sourcesConsulted: status.profile?.sourcesConsulted,
    confidenceLevel: status.profile?.confidenceLevel,
    error: status.error,
  });
}
