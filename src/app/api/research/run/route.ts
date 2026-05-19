// =============================================================================
// POST /api/research/run
// =============================================================================
// Synchronously runs background research for an existing session and returns
// the completed profile. Used to backfill prebaked sessions or to run
// on-demand from the report page when no research exists yet.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/db/store';
import { runResearchSync } from '@/lib/research/engine';

// Allow up to 5 minutes for synthesis (Vercel Pro plan caps at 800s)
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body as { sessionId: string };
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const job = await runResearchSync(sessionId, session.companyProfile);
    return NextResponse.json({
      sessionId,
      status: job.status,
      completedAt: job.completedAt,
      sourcesConsulted: job.profile?.sourcesConsulted,
      confidenceLevel: job.profile?.confidenceLevel,
    });
  } catch (err: unknown) {
    console.error('[POST /api/research/run]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Research failed' },
      { status: 500 }
    );
  }
}
