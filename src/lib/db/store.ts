// =============================================================================
// RLK AI Diagnostic — File-Based Session Store
// =============================================================================
// MVP persistence layer: one JSON file per AssessmentSession in data/sessions/.
// Swap this out for a real database when ready.
// =============================================================================

import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { AssessmentSession, CompanyProfile } from '@/types/diagnostic';

const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function sessionPath(id: string): string {
  return path.join(DATA_DIR, `${id}.json`);
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export async function createSession(
  profile: CompanyProfile
): Promise<AssessmentSession> {
  await ensureDataDir();

  const session: AssessmentSession = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    companyProfile: profile,
    responses: [],
    currentQuestionIndex: 0,
    status: 'intake',
  };

  await fs.writeFile(sessionPath(session.id), JSON.stringify(session, null, 2));
  return session;
}

export async function getSession(
  id: string
): Promise<AssessmentSession | null> {
  try {
    const raw = await fs.readFile(sessionPath(id), 'utf-8');
    return JSON.parse(raw) as AssessmentSession;
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw err;
  }
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
  await fs.writeFile(sessionPath(id), JSON.stringify(updated, null, 2));
  return updated;
}

export async function deleteSession(id: string): Promise<void> {
  try {
    await fs.unlink(sessionPath(id));
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return; // Already gone — treat as success
    }
    throw err;
  }
}
