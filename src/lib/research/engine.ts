// =============================================================================
// RLK AI Diagnostic — Background Research Engine
// =============================================================================
// Orchestrates the full research pipeline. Runs in the background while
// the customer completes the diagnostic assessment.
//
// Flow:
// 1. Customer submits company profile → research kicks off immediately
// 2. While they answer 36 questions (~15-20 min), we:
//    a. Search SEC EDGAR for filings
//    b. Search Google News for company + AI + industry news
//    c. Fetch company web content
//    d. Send everything to Claude for synthesis
// 3. By the time they finish, we have a deep company profile ready
// =============================================================================

import { Redis } from '@upstash/redis';
import { CompanyProfile } from '@/types/diagnostic';
import { ResearchJob, CompanyResearchProfile } from '@/types/research';
import {
  searchSECFilings,
  searchCompanyNews,
  searchIndustryNews,
  fetchCompanyWebContent,
} from './sources';
import { synthesizeResearchProfile } from './synthesize';

// ---------------------------------------------------------------------------
// Redis client (singleton, shared with store.ts pattern)
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set.'
      );
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}

const RESEARCH_PREFIX = 'research:';
const RESEARCH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

// In-memory job tracker for real-time progress during active research
const activeJobs = new Map<string, ResearchJob>();

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

/**
 * Start background research for a company. Returns immediately.
 * The research runs asynchronously while the customer takes the diagnostic.
 */
export function startBackgroundResearch(
  sessionId: string,
  profile: CompanyProfile
): ResearchJob {
  const job: ResearchJob = {
    sessionId,
    companyName: profile.companyName,
    status: 'queued',
    startedAt: new Date().toISOString(),
    progress: {
      financials: false,
      news: false,
      leadership: false,
      aiIntelligence: false,
      industry: false,
      synthesis: false,
    },
  };

  activeJobs.set(sessionId, job);

  // Fire and forget — runs in background
  executeResearch(sessionId, profile).catch((error) => {
    console.error(`[Research] Failed for session ${sessionId}:`, error);
    const failedJob = activeJobs.get(sessionId);
    if (failedJob) {
      failedJob.status = 'failed';
      failedJob.error = error instanceof Error ? error.message : 'Unknown error';
      persistJob(failedJob);
    }
  });

  return job;
}

/**
 * Get the current status of a research job.
 */
export async function getResearchStatus(sessionId: string): Promise<ResearchJob | null> {
  // Check in-memory first (active jobs have real-time progress)
  const memJob = activeJobs.get(sessionId);
  if (memJob) return memJob;

  // Check Redis persistence
  try {
    const redis = getRedis();
    const raw = await redis.get<string>(`${RESEARCH_PREFIX}${sessionId}`);
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : (raw as unknown as ResearchJob);
  } catch {
    return null;
  }
}

/**
 * Get the completed research profile for a session.
 */
export async function getResearchProfile(
  sessionId: string
): Promise<CompanyResearchProfile | null> {
  const job = await getResearchStatus(sessionId);
  if (!job || job.status !== 'complete') return null;
  return job.profile || null;
}

// ---------------------------------------------------------------------------
// RESEARCH EXECUTION PIPELINE
// ---------------------------------------------------------------------------

async function executeResearch(
  sessionId: string,
  profile: CompanyProfile
): Promise<void> {
  const job = activeJobs.get(sessionId);
  if (!job) return;

  job.status = 'researching';
  console.log(`[Research] Starting for ${profile.companyName} (session: ${sessionId})`);

  // Phase 1: Parallel data gathering (runs while customer answers questions)
  const [secFilings, companyNews, aiNews, industryNews, webContent] = await Promise.all([
    // SEC filings (public companies)
    searchSECFilings(profile.companyName, profile.ticker).then((result) => {
      job.progress.financials = true;
      console.log(`[Research] SEC filings: found ${result.length}`);
      return result;
    }),

    // Company general news
    searchCompanyNews(profile.companyName, profile.industry).then((result) => {
      job.progress.news = true;
      console.log(`[Research] Company news: found ${result.length}`);
      return result;
    }),

    // AI-specific news for this company
    searchCompanyNews(`${profile.companyName} AI artificial intelligence`, profile.industry).then((result) => {
      job.progress.aiIntelligence = true;
      console.log(`[Research] AI news: found ${result.length}`);
      return result;
    }),

    // Industry-wide AI news
    searchIndustryNews(profile.industry).then((result) => {
      job.progress.industry = true;
      console.log(`[Research] Industry news: found ${result.length}`);
      return result;
    }),

    // Company website intelligence
    fetchCompanyWebContent(profile.companyName, profile.websiteUrl).then((result) => {
      job.progress.leadership = true;
      console.log(`[Research] Web content: ${result.newsroomItems.length} items`);
      return result;
    }),
  ]);

  // Phase 2: Claude synthesis
  job.status = 'synthesizing';
  console.log(`[Research] Synthesizing intelligence for ${profile.companyName}...`);

  const researchProfile = await synthesizeResearchProfile(profile, {
    secFilings,
    companyNews,
    aiNews: aiNews,
    industryNews,
    webContent,
  });

  job.progress.synthesis = true;

  // Phase 3: Complete
  job.status = 'complete';
  job.completedAt = new Date().toISOString();
  job.profile = researchProfile;

  console.log(
    `[Research] Complete for ${profile.companyName}. ` +
    `Sources: ${researchProfile.sourcesConsulted}, ` +
    `Confidence: ${researchProfile.confidenceLevel}`
  );

  // Persist to Redis
  await persistJob(job);
}

async function persistJob(job: ResearchJob): Promise<void> {
  try {
    const redis = getRedis();
    await redis.set(
      `${RESEARCH_PREFIX}${job.sessionId}`,
      JSON.stringify(job),
      { ex: RESEARCH_TTL_SECONDS }
    );
  } catch (error) {
    console.error(`[Research] Failed to persist job ${job.sessionId}:`, error);
  }
}
