// =============================================================================
// POST /api/admin/backfill-index
// =============================================================================
// One-shot operation: scans every "session:*" key in Redis and adds the id
// to the sessions:index sorted set scored by createdAt. Used once after
// adding the index, so historical sessions become queryable.
//
// Authorization: Bearer <ADMIN_TOKEN> in header, or ?token= in query string.
// Safe to run multiple times: zadd is idempotent.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import type { AssessmentSession } from '@/types/diagnostic';

export const maxDuration = 60;

const SESSION_INDEX_KEY = 'sessions:index';
const SESSION_PREFIX = 'session:';

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) throw new Error('Redis env vars missing');
  return new Redis({ url, token });
}

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
  return !!provided && provided === expected;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const redis = getRedis();
  let cursor: string | number = 0;
  let scanned = 0;
  let added = 0;
  let skipped = 0;
  const errors: string[] = [];

  do {
    const result = (await redis.scan(cursor, { match: `${SESSION_PREFIX}*`, count: 100 })) as [string, string[]];
    cursor = result[0];
    const keys = result[1];

    for (const key of keys) {
      scanned++;
      const id = key.startsWith(SESSION_PREFIX) ? key.slice(SESSION_PREFIX.length) : key;
      try {
        const raw = await redis.get<string>(key);
        if (!raw) { skipped++; continue; }
        const session: AssessmentSession = typeof raw === 'string' ? JSON.parse(raw) : (raw as unknown as AssessmentSession);
        const createdAtMs = new Date(session.createdAt).getTime();
        if (!Number.isFinite(createdAtMs)) { skipped++; continue; }
        await redis.zadd(SESSION_INDEX_KEY, { score: createdAtMs, member: id });
        added++;
      } catch (err) {
        errors.push(`${id}: ${err instanceof Error ? err.message : 'unknown'}`);
        skipped++;
      }
    }
  } while (String(cursor) !== '0');

  return NextResponse.json({
    success: true,
    scanned,
    added,
    skipped,
    errorCount: errors.length,
    sampleErrors: errors.slice(0, 5),
  });
}
