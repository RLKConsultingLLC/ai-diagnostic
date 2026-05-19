// =============================================================================
// GET /api/admin/stats
// =============================================================================
// Funnel and aggregate statistics across all sessions. Admin-token-gated.
//
// Returns:
//   totalSessions       all-time session count
//   countsByStatus      breakdown of current status across all sessions
//   countsByIndustry    top industries by session volume
//   conversionRates     funnel rates (start to complete, complete to paid)
//   recentActivity      counts for trailing 7, 30, 90 days
//   medianScores        median overall score, by industry
//
// Authorization: Bearer <ADMIN_TOKEN> in header, or ?token= in query string.
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

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const day = 86_400_000;

  const totalSessions = await countSessions();
  const last7Days = await countSessions({ fromMs: now - 7 * day });
  const last30Days = await countSessions({ fromMs: now - 30 * day });
  const last90Days = await countSessions({ fromMs: now - 90 * day });

  // Pull a representative window of recent sessions for richer breakdowns.
  // For deeper history, hit /api/admin/sessions with explicit date ranges.
  const recentIds = await listSessionIds({ limit: 1000, fromMs: now - 365 * day });
  const recentSessions = (await getSessions(recentIds)).filter((s): s is AssessmentSession => s !== null);

  const countsByStatus: Record<string, number> = {};
  const countsByIndustry: Record<string, number> = {};
  const scoresByIndustry: Record<string, number[]> = {};
  let completedCount = 0;
  let paidCount = 0;

  for (const s of recentSessions) {
    countsByStatus[s.status] = (countsByStatus[s.status] || 0) + 1;
    const ind = s.companyProfile?.industry || 'unknown';
    countsByIndustry[ind] = (countsByIndustry[ind] || 0) + 1;
    if (s.diagnosticResult?.overallScore != null) {
      (scoresByIndustry[ind] = scoresByIndustry[ind] || []).push(s.diagnosticResult.overallScore);
    }
    if (s.completedAt) completedCount++;
    if (s.paidAt) paidCount++;
  }

  const topIndustries = Object.entries(countsByIndustry)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([industry, count]) => ({ industry, count, medianScore: median(scoresByIndustry[industry] || []) }));

  return NextResponse.json({
    totalSessions,
    windowAnalyzed: {
      label: 'Trailing 365 days, capped at 1000 sessions',
      sampleSize: recentSessions.length,
    },
    recentActivity: {
      last7Days,
      last30Days,
      last90Days,
    },
    funnel: {
      started: recentSessions.length,
      completed: completedCount,
      paid: paidCount,
      startToCompleteRate: recentSessions.length > 0 ? +(completedCount / recentSessions.length * 100).toFixed(1) : null,
      completeToPaidRate: completedCount > 0 ? +(paidCount / completedCount * 100).toFixed(1) : null,
      startToPaidRate: recentSessions.length > 0 ? +(paidCount / recentSessions.length * 100).toFixed(1) : null,
    },
    countsByStatus,
    topIndustries,
    generatedAt: new Date().toISOString(),
  });
}
