// =============================================================================
// RLK AI Diagnostic — Redis Session Store (Upstash)
// =============================================================================
// Serverless-compatible persistence via Upstash Redis REST API.
// Each session is stored as a JSON string keyed by "session:{id}".
// Sessions auto-expire after 30 days.
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
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

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

  const session: AssessmentSession = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    companyProfile: profile,
    responses: [],
    currentQuestionIndex: 0,
    status: 'intake',
  };

  await redis.set(
    `${SESSION_PREFIX}${session.id}`,
    JSON.stringify(session),
    { ex: SESSION_TTL_SECONDS }
  );
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

  const updated: AssessmentSession = { ...session, ...updates, id: session.id };

  const redis = getRedis();
  await redis.set(
    `${SESSION_PREFIX}${id}`,
    JSON.stringify(updated),
    { ex: SESSION_TTL_SECONDS }
  );
  return updated;
}

export async function deleteSession(id: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`${SESSION_PREFIX}${id}`);
}
