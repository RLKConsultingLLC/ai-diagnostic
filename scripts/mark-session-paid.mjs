// =============================================================================
// One-off: mark a specific session as status="paid" so the report page skips
// the paywall for that session only. Used to generate paywall-free shareable
// links for sales-pitch / promotional purposes.
//
// Usage:
//   node --env-file=.env.local scripts/mark-session-paid.mjs <sessionId>
//
// Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from env.
// =============================================================================

import { Redis } from '@upstash/redis';

const sessionId = process.argv[2];
if (!sessionId) {
  console.error('Usage: node scripts/mark-session-paid.mjs <sessionId>');
  process.exit(1);
}

const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
if (!url || !token) {
  console.error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set.');
  process.exit(1);
}

const redis = new Redis({ url, token });
const key = `session:${sessionId}`;

const raw = await redis.get(key);
if (!raw) {
  console.error(`Session not found: ${sessionId}`);
  process.exit(1);
}

const session = typeof raw === 'string' ? JSON.parse(raw) : raw;
const before = session.status;
session.status = 'paid';
// Tag as a promotional/sales session so we know why it's persisted long-term
session.promotional = session.promotional || {
  markedAt: new Date().toISOString(),
  purpose: 'sales-share',
};

// 2 years — long enough that a sales pitch link won't expire mid-cycle.
// If you need it to truly never expire, remove the `ex` option below.
const TTL = 2 * 365 * 24 * 60 * 60;
await redis.set(key, JSON.stringify(session), { ex: TTL });

const verify = await redis.get(key);
const verifySession = typeof verify === 'string' ? JSON.parse(verify) : verify;

console.log(JSON.stringify({
  sessionId,
  companyName: session.companyProfile?.companyName,
  industry: session.companyProfile?.industry,
  statusBefore: before,
  statusAfter: verifySession.status,
  ttlSeconds: TTL,
  ttlYears: 2,
  updated: verifySession.status === 'paid',
}, null, 2));
