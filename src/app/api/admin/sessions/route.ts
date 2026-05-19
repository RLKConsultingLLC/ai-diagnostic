// =============================================================================
// GET /api/admin/sessions
// =============================================================================
// Admin-only listing and export of all sessions in the database. Used for
// cohort analysis, funnel reporting, and offline data export.
//
// Authorization: requires an ADMIN_TOKEN env var. Pass it as either
//   Authorization: Bearer <token>
// or
//   ?token=<token>
//
// Query parameters:
//   from        ISO date (inclusive lower bound on createdAt)
//   to          ISO date (inclusive upper bound on createdAt)
//   status      optional status filter (intake, in_progress, completed,
//               report_generated, paid)
//   industry    optional industry slug filter
//   limit       max sessions to return (default 100, max 1000)
//   offset      pagination offset
//   format      json (default, returns array) or jsonl (newline-delimited)
//   summary     "true" returns only id, createdAt, status, companyProfile,
//               and key timestamps. Default returns full session including
//               responses and diagnosticResult.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { countSessions, listSessionIds, getSessions } from '@/lib/db/store';
import type { AssessmentSession } from '@/types/diagnostic';

export const maxDuration = 60;

function getAuthToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (header) {
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  return request.nextUrl.searchParams.get('token');
}

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) return false;
  const provided = getAuthToken(request);
  if (!provided) return false;
  return provided === expected;
}

function summarize(s: AssessmentSession) {
  return {
    id: s.id,
    createdAt: s.createdAt,
    completedAt: s.completedAt,
    reportGeneratedAt: s.reportGeneratedAt,
    paidAt: s.paidAt,
    lastUpdatedAt: s.lastUpdatedAt,
    status: s.status,
    companyProfile: s.companyProfile,
    overallScore: s.diagnosticResult?.overallScore,
    primaryStage: s.diagnosticResult?.stageClassification?.primaryStage,
    paymentId: s.paymentId,
    responseCount: s.responses?.length || 0,
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const fromIso = params.get('from');
  const toIso = params.get('to');
  const statusFilter = params.get('status');
  const industryFilter = params.get('industry');
  const limit = Math.min(parseInt(params.get('limit') || '100', 10), 1000);
  const offset = parseInt(params.get('offset') || '0', 10);
  const format = params.get('format') || 'json';
  const summaryOnly = params.get('summary') === 'true';

  const fromMs = fromIso ? new Date(fromIso).getTime() : undefined;
  const toMs = toIso ? new Date(toIso).getTime() : undefined;

  const total = await countSessions({ fromMs, toMs });
  const ids = await listSessionIds({ fromMs, toMs, limit: limit * 3, offset }); // overshoot to allow post-filter
  const sessions = (await getSessions(ids)).filter((s): s is AssessmentSession => s !== null);

  const filtered = sessions.filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (industryFilter && s.companyProfile.industry !== industryFilter) return false;
    return true;
  }).slice(0, limit);

  const out = summaryOnly ? filtered.map(summarize) : filtered;

  if (format === 'jsonl') {
    const body = out.map((s) => JSON.stringify(s)).join('\n');
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Content-Disposition': `attachment; filename="rlk-sessions-${new Date().toISOString().slice(0, 10)}.jsonl"`,
      },
    });
  }

  return NextResponse.json({
    total,
    returned: out.length,
    offset,
    limit,
    sessions: out,
  });
}
