// =============================================================================
// RLK AI Diagnostic. Redis Session Store (Upstash)
// =============================================================================
// Serverless-compatible persistence via Upstash Redis REST API.
// Each session is stored as a JSON string keyed by "session:{id}".
//
// Persistence policy: sessions persist forever. We deliberately do not set a
// TTL so every prospect interaction becomes part of a permanent dataset for
// later aggregation, cohort analysis, and product-market-fit research.
//
// In addition to the per-session key, every session id is added to a sorted
// set "sessions:index" scored by createdAt epoch ms. That index makes
// time-range queries cheap without scanning every key in the database.
// =============================================================================

import { Redis } from '@upstash/redis';
import { v4 as uuidv4 } from 'uuid';
import type { AssessmentSession, CompanyProfile, Industry } from '@/types/diagnostic';

// ---------------------------------------------------------------------------
// Redis client (singleton)
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (!url || !token) {
      throw new Error(
        'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set.'
      );
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}

const SESSION_PREFIX = 'session:';
const SESSION_INDEX_KEY = 'sessions:index'; // sorted set, scored by createdAt epoch ms
// No TTL: sessions persist forever. The diagnostic captures every prospect
// interaction as permanent dataset for later aggregation and analysis.

// ---------------------------------------------------------------------------
// Backward compatibility: map old industry slugs to new ones
// ---------------------------------------------------------------------------

const INDUSTRY_SLUG_MIGRATION: Record<string, Industry> = {
  retail_consumer: 'retail',
  technology_software: 'software_saas',
  technology_hardware: 'hardware_electronics',
  real_estate_property: 'real_estate_commercial',
  professional_services: 'consulting_services',
  travel_hospitality: 'retail',
  education_higher: 'consulting_services',
  education_k12: 'consulting_services',
};

function normalizeSession(session: AssessmentSession): AssessmentSession {
  const oldIndustry = session.companyProfile?.industry;
  if (oldIndustry && INDUSTRY_SLUG_MIGRATION[oldIndustry]) {
    return {
      ...session,
      companyProfile: {
        ...session.companyProfile,
        industry: INDUSTRY_SLUG_MIGRATION[oldIndustry],
      },
    };
  }
  return session;
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export async function createSession(
  profile: CompanyProfile
): Promise<AssessmentSession> {
  const redis = getRedis();

  const now = new Date();
  const session: AssessmentSession = {
    id: uuidv4(),
    createdAt: now.toISOString(),
    lastUpdatedAt: now.toISOString(),
    companyProfile: profile,
    responses: [],
    currentQuestionIndex: 0,
    status: 'intake',
  };

  // Persist forever (no TTL). Index by createdAt for time-range queries.
  await Promise.all([
    redis.set(`${SESSION_PREFIX}${session.id}`, JSON.stringify(session)),
    redis.zadd(SESSION_INDEX_KEY, { score: now.getTime(), member: session.id }),
  ]);
  return session;
}

export async function getSession(
  id: string
): Promise<AssessmentSession | null> {
  const redis = getRedis();
  const raw = await redis.get<string>(`${SESSION_PREFIX}${id}`);
  if (!raw) return null;

  // Upstash may return parsed JSON or string depending on how it was stored
  const session: AssessmentSession =
    typeof raw === 'string' ? JSON.parse(raw) : (raw as unknown as AssessmentSession);
  return normalizeSession(session);
}

export async function updateSession(
  id: string,
  updates: Partial<AssessmentSession>
): Promise<AssessmentSession> {
  const session = await getSession(id);
  if (!session) {
    throw new Error(`Session not found: ${id}`);
  }

  const nowIso = new Date().toISOString();
  // Stamp transition timestamps as the status changes. These are write-once:
  // we only set completedAt the first time status becomes "completed",
  // paidAt the first time it becomes "paid", etc.
  const transitionStamps: Partial<AssessmentSession> = {};
  if (updates.status === 'completed' && !session.completedAt) {
    transitionStamps.completedAt = nowIso;
  }
  if (updates.status === 'paid' && !session.paidAt) {
    transitionStamps.paidAt = nowIso;
  }
  if (updates.status === 'report_generated' && !session.reportGeneratedAt) {
    transitionStamps.reportGeneratedAt = nowIso;
  }

  const updated: AssessmentSession = {
    ...session,
    ...updates,
    ...transitionStamps,
    id: session.id,
    lastUpdatedAt: nowIso,
  };

  const redis = getRedis();
  // Persist forever (no TTL). The index already has this id from creation.
  await redis.set(`${SESSION_PREFIX}${id}`, JSON.stringify(updated));
  return updated;
}

export async function deleteSession(id: string): Promise<void> {
  const redis = getRedis();
  await Promise.all([
    redis.del(`${SESSION_PREFIX}${id}`),
    redis.zrem(SESSION_INDEX_KEY, id),
  ]);
}

// ---------------------------------------------------------------------------
// Bulk read operations for analytics and aggregation
// ---------------------------------------------------------------------------

/**
 * Returns session ids in createdAt order, optionally filtered by date range.
 * Reverse-chronological by default (newest first).
 */
export async function listSessionIds(opts: {
  fromMs?: number;
  toMs?: number;
  limit?: number;
  offset?: number;
  reverse?: boolean;
} = {}): Promise<string[]> {
  const redis = getRedis();
  const fromMs = opts.fromMs ?? 0;
  const toMs = opts.toMs ?? Date.now() + 86_400_000; // tomorrow as upper bound
  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? 1000;

  if (opts.reverse !== false) {
    // newest first
    return (await redis.zrange(SESSION_INDEX_KEY, toMs, fromMs, {
      byScore: true,
      rev: true,
      offset,
      count: limit,
    })) as string[];
  }
  return (await redis.zrange(SESSION_INDEX_KEY, fromMs, toMs, {
    byScore: true,
    offset,
    count: limit,
  })) as string[];
}

/**
 * Returns total count of sessions in the index, optionally within a date range.
 */
export async function countSessions(opts: { fromMs?: number; toMs?: number } = {}): Promise<number> {
  const redis = getRedis();
  const fromMs = opts.fromMs ?? 0;
  const toMs = opts.toMs ?? Date.now() + 86_400_000;
  return (await redis.zcount(SESSION_INDEX_KEY, fromMs, toMs)) as number;
}

/**
 * Bulk-load sessions by id list. Returns sessions in the same order, with nulls
 * for any id that no longer exists (e.g. deleted).
 */
export async function getSessions(ids: string[]): Promise<(AssessmentSession | null)[]> {
  if (ids.length === 0) return [];
  return Promise.all(ids.map((id) => getSession(id)));
}
