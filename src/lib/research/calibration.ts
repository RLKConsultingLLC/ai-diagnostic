// =============================================================================
// RLK AI Diagnostic. Publicly Available Evidence Calibration
// =============================================================================
// Compares self-reported diagnostic scores against publicly available
// evidence pulled by the research engine. Produces a per-dimension
// "evidence score" and a short list of citations.
//
// We intentionally do NOT auto-override the self-reported scores. The delta
// IS the diagnostic. We show both side-by-side so the prospect, their team,
// and the consultant can have a real conversation about why the gap exists.
// =============================================================================

import type { Dimension } from '@/types/diagnostic';
import type {
  CompanyResearchProfile,
  LeadershipInsight,
  StrategicInitiative,
  AIMention,
  AIInvestment,
} from '@/types/research';

export interface DimensionCalibrationSignal {
  text: string;       // Short citation snippet, plain language
  source: string;     // Where it came from (e.g. "Q3 2024 earnings call")
}

export interface DimensionCalibration {
  dimension: Dimension;
  selfScore: number;          // 0-100 from diagnostic engine
  evidenceScore: number;      // 0-100 derived from public data
  delta: number;              // evidenceScore - selfScore (negative means overrated)
  confidence: 'high' | 'moderate' | 'low' | 'insufficient';
  signals: DimensionCalibrationSignal[];
  narrative: string;          // Short plain-language reading of the delta
}

export interface CalibrationOverlay {
  available: boolean;
  reason?: string;            // If unavailable, why
  sourcesConsulted: number;
  confidenceLevel: 'high' | 'moderate' | 'low';
  generatedAt: string;
  byDimension: Record<Dimension, DimensionCalibration>;
  summary: string;            // Top-level 2-sentence read on the calibration
}

// ---------------------------------------------------------------------------
// Signal extraction utilities
// ---------------------------------------------------------------------------

function countAIMentionsBySentiment(
  mentions: AIMention[]
): { positive: number; neutral: number; cautious: number; negative: number; total: number } {
  const out = { positive: 0, neutral: 0, cautious: 0, negative: 0, total: mentions.length };
  for (const m of mentions) {
    if (m.sentiment in out) out[m.sentiment as keyof typeof out]++;
  }
  return out;
}

function leadershipQuotesByTopic(
  insights: LeadershipInsight[],
  topics: string[]
): LeadershipInsight[] {
  return insights.filter((i) => topics.includes(i.topic));
}

function initiativesMatching(
  initiatives: StrategicInitiative[],
  keywords: string[]
): StrategicInitiative[] {
  const lower = keywords.map((k) => k.toLowerCase());
  return initiatives.filter((init) => {
    const text = `${init.name} ${init.description} ${init.aiRelevance}`.toLowerCase();
    return lower.some((k) => text.includes(k));
  });
}

function investmentTotalUSD(investments: AIInvestment[]): number {
  // Best-effort parse of "$X B", "$X M" strings into a comparable number
  let total = 0;
  for (const inv of investments) {
    if (!inv.amount) continue;
    const match = inv.amount.match(/\$?([\d,.]+)\s*(B|M|K)?/i);
    if (!match) continue;
    const num = parseFloat(match[1].replace(/,/g, ''));
    const unit = (match[2] || '').toUpperCase();
    if (unit === 'B') total += num * 1_000_000_000;
    else if (unit === 'M') total += num * 1_000_000;
    else if (unit === 'K') total += num * 1_000;
    else total += num;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Dimension-specific scoring
// ---------------------------------------------------------------------------
// Each scorer takes the research profile and returns:
//   - a 0-100 evidence score
//   - up to 4 short signals (used as the citations in the UI)
//   - a confidence level based on how much public signal exists
//
// Scoring philosophy: start at 50 (neutral, no signal) and adjust toward the
// extremes based on concrete evidence. We score conservatively: it takes
// genuine public-data weight to move the needle far in either direction.
// ---------------------------------------------------------------------------

function scoreAuthorityStructure(p: CompanyResearchProfile): {
  evidenceScore: number;
  signals: DimensionCalibrationSignal[];
  confidence: 'high' | 'moderate' | 'low' | 'insufficient';
} {
  let score = 50;
  const signals: DimensionCalibrationSignal[] = [];

  // 1. CEO / board-level AI commentary in earnings or press
  const aiLeadership = leadershipQuotesByTopic(p.leadershipInsights || [], [
    'ai_strategy',
    'digital_transformation',
    'technology',
  ]);
  if (aiLeadership.length >= 3) {
    score += 15;
    signals.push({
      text: `${aiLeadership.length} senior-executive AI or technology statements in the public record`,
      source: aiLeadership.slice(0, 2).map((q) => q.source).join('; '),
    });
  } else if (aiLeadership.length === 0) {
    score -= 15;
    signals.push({
      text: 'No senior-executive AI or technology statements surfaced in the public record',
      source: `${p.sourcesConsulted} sources reviewed`,
    });
  }

  // 2. AI mentions in earnings calls (positive sentiment carries more weight)
  const mentionStats = countAIMentionsBySentiment(p.aiMentions || []);
  if (mentionStats.total >= 5) {
    score += 10;
    signals.push({
      text: `${mentionStats.total} AI references across earnings calls and disclosures (${mentionStats.positive} positive)`,
      source: 'Earnings calls and 10-K filings',
    });
  } else if (mentionStats.total === 0 && (p.aiMentions !== undefined)) {
    score -= 8;
    signals.push({
      text: 'AI was not raised by management in reviewed earnings disclosures',
      source: 'Recent earnings disclosures',
    });
  }

  // 3. AI risks documented in 10-K (governance signal)
  const aiRisks = (p.riskFactors || []).filter((r) =>
    /ai|artificial intelligence|machine learning|automated/i.test(r)
  );
  if (aiRisks.length >= 2) {
    score += 8;
    signals.push({
      text: `${aiRisks.length} AI-specific risk factors disclosed (suggests formal governance)`,
      source: '10-K risk factors',
    });
  }

  score = Math.max(5, Math.min(95, Math.round(score)));
  const confidence: 'high' | 'moderate' | 'low' | 'insufficient' =
    signals.length >= 3 ? 'high' : signals.length >= 1 ? 'moderate' : 'insufficient';
  return { evidenceScore: score, signals: signals.slice(0, 4), confidence };
}

function scoreAdoptionBehavior(p: CompanyResearchProfile): {
  evidenceScore: number;
  signals: DimensionCalibrationSignal[];
  confidence: 'high' | 'moderate' | 'low' | 'insufficient';
} {
  let score = 50;
  const signals: DimensionCalibrationSignal[] = [];

  // 1. AI investments / partnerships / acquisitions
  const investments = p.aiInvestments || [];
  if (investments.length >= 3) {
    score += 15;
    const totalUSD = investmentTotalUSD(investments);
    signals.push({
      text: `${investments.length} disclosed AI investments, partnerships, or acquisitions${totalUSD > 0 ? ` totaling roughly $${(totalUSD / 1_000_000_000).toFixed(1)}B disclosed` : ''}`,
      source: investments.slice(0, 2).map((i) => i.source).join('; '),
    });
  } else if (investments.length === 0) {
    score -= 10;
    signals.push({
      text: 'No disclosed AI investments, partnerships, or acquisitions in the public record',
      source: `${p.sourcesConsulted} sources reviewed`,
    });
  } else {
    signals.push({
      text: `${investments.length} disclosed AI investment(s) or partnership(s) in the public record`,
      source: investments[0]?.source || 'Public disclosures',
    });
  }

  // 2. Strategic initiatives mentioning adoption / rollout / deployment
  const adoptionInitiatives = initiativesMatching(p.strategicInitiatives || [], [
    'rollout',
    'deployment',
    'adoption',
    'enterprise-wide',
    'all employees',
    'workforce',
    'training',
  ]);
  if (adoptionInitiatives.length >= 2) {
    score += 10;
    signals.push({
      text: `${adoptionInitiatives.length} strategic initiative(s) tied to broad AI adoption or workforce enablement`,
      source: adoptionInitiatives[0]?.source || 'Press releases',
    });
  }

  score = Math.max(5, Math.min(95, Math.round(score)));
  const confidence: 'high' | 'moderate' | 'low' | 'insufficient' =
    signals.length >= 3 ? 'high' : signals.length >= 1 ? 'moderate' : 'insufficient';
  return { evidenceScore: score, signals: signals.slice(0, 4), confidence };
}

function scoreWorkflowIntegration(p: CompanyResearchProfile): {
  evidenceScore: number;
  signals: DimensionCalibrationSignal[];
  confidence: 'high' | 'moderate' | 'low' | 'insufficient';
} {
  let score = 50;
  const signals: DimensionCalibrationSignal[] = [];

  // 1. AI products / features publicly disclosed
  const productInitiatives = initiativesMatching(p.strategicInitiatives || [], [
    'product',
    'platform',
    'launch',
    'feature',
    'embedded',
    'integration',
    'workflow',
    'automation',
  ]);
  if (productInitiatives.length >= 3) {
    score += 18;
    signals.push({
      text: `${productInitiatives.length} disclosed AI products, platforms, or workflow integrations`,
      source: productInitiatives[0]?.source || 'Public disclosures',
    });
  } else if (productInitiatives.length === 0) {
    score -= 12;
    signals.push({
      text: 'No AI products, platforms, or workflow integrations referenced in the public record',
      source: `${p.sourcesConsulted} sources reviewed`,
    });
  } else {
    signals.push({
      text: `${productInitiatives.length} AI product or workflow integration(s) referenced publicly`,
      source: productInitiatives[0]?.source || 'Public disclosures',
    });
  }

  // 2. AI posture text quality
  if (p.aiPostureAssessment && p.aiPostureAssessment.length > 200) {
    const posture = p.aiPostureAssessment.toLowerCase();
    if (/embedded|integrated|production|deployed|live|in market/.test(posture)) {
      score += 8;
      signals.push({
        text: 'Public posture suggests AI is in production or embedded in core workflows',
        source: 'Synthesized from earnings calls and product disclosures',
      });
    } else if (/exploring|pilot|evaluating|early|considering/.test(posture)) {
      score -= 10;
      signals.push({
        text: 'Public posture suggests AI work remains exploratory or in pilot phase',
        source: 'Synthesized from earnings calls and product disclosures',
      });
    }
  }

  score = Math.max(5, Math.min(95, Math.round(score)));
  const confidence: 'high' | 'moderate' | 'low' | 'insufficient' =
    signals.length >= 2 ? 'high' : signals.length >= 1 ? 'moderate' : 'insufficient';
  return { evidenceScore: score, signals: signals.slice(0, 4), confidence };
}

function scoreDecisionVelocity(p: CompanyResearchProfile): {
  evidenceScore: number;
  signals: DimensionCalibrationSignal[];
  confidence: 'high' | 'moderate' | 'low' | 'insufficient';
} {
  let score = 50;
  const signals: DimensionCalibrationSignal[] = [];

  // 1. Volume of announced AI initiatives within trailing 12 months
  const initiatives = p.strategicInitiatives || [];
  if (initiatives.length >= 5) {
    score += 15;
    signals.push({
      text: `${initiatives.length} AI-related strategic initiatives announced in trailing public coverage`,
      source: 'Press releases and earnings calls',
    });
  } else if (initiatives.length <= 1) {
    score -= 12;
    signals.push({
      text: `Only ${initiatives.length} AI-related strategic initiative(s) found in the public record`,
      source: `${p.sourcesConsulted} sources reviewed`,
    });
  }

  // 2. "In progress" status signals active execution
  const inProgress = initiatives.filter((i) => i.status === 'in_progress' || i.status === 'completed');
  if (inProgress.length >= 2) {
    score += 8;
    signals.push({
      text: `${inProgress.length} AI initiatives in active deployment or completed status`,
      source: 'Press releases',
    });
  }

  score = Math.max(5, Math.min(95, Math.round(score)));
  const confidence: 'high' | 'moderate' | 'low' | 'insufficient' =
    signals.length >= 2 ? 'high' : signals.length >= 1 ? 'moderate' : 'insufficient';
  return { evidenceScore: score, signals: signals.slice(0, 4), confidence };
}

function scoreEconomicTranslation(p: CompanyResearchProfile): {
  evidenceScore: number;
  signals: DimensionCalibrationSignal[];
  confidence: 'high' | 'moderate' | 'low' | 'insufficient';
} {
  let score = 50;
  const signals: DimensionCalibrationSignal[] = [];

  // 1. AI investments with disclosed dollar amounts
  const investmentsWithAmount = (p.aiInvestments || []).filter((i) => !!i.amount);
  if (investmentsWithAmount.length >= 2) {
    score += 18;
    const totalUSD = investmentTotalUSD(investmentsWithAmount);
    signals.push({
      text: `${investmentsWithAmount.length} AI investments with disclosed dollar values${totalUSD > 0 ? ` (roughly $${(totalUSD / 1_000_000_000).toFixed(1)}B in aggregate)` : ''}`,
      source: investmentsWithAmount[0]?.source || 'Public disclosures',
    });
  } else if (investmentsWithAmount.length === 0) {
    score -= 12;
    signals.push({
      text: 'No AI investments disclosed with specific dollar figures in the public record',
      source: `${p.sourcesConsulted} sources reviewed`,
    });
  }

  // 2. Mentions of AI ROI, return, savings, productivity in leadership quotes
  const econLanguage = (p.leadershipInsights || []).filter((q) => {
    const text = `${q.quote || ''} ${q.context || ''}`.toLowerCase();
    return /roi|return on|savings|productivity|efficiency gain|cost reduction|margin|operating leverage/.test(text);
  });
  if (econLanguage.length >= 2) {
    score += 10;
    signals.push({
      text: `${econLanguage.length} leadership statement(s) tying AI to ROI, productivity, or margin`,
      source: econLanguage[0]?.source || 'Earnings calls',
    });
  } else if (econLanguage.length === 0 && (p.leadershipInsights || []).length > 0) {
    score -= 8;
    signals.push({
      text: 'AI is discussed by leadership without explicit ROI, productivity, or margin framing',
      source: 'Earnings calls',
    });
  }

  score = Math.max(5, Math.min(95, Math.round(score)));
  const confidence: 'high' | 'moderate' | 'low' | 'insufficient' =
    signals.length >= 2 ? 'high' : signals.length >= 1 ? 'moderate' : 'insufficient';
  return { evidenceScore: score, signals: signals.slice(0, 4), confidence };
}

// ---------------------------------------------------------------------------
// Narrative generation (deterministic, no extra LLM call)
// ---------------------------------------------------------------------------

function narrateDelta(selfScore: number, evidenceScore: number, dimensionLabel: string): string {
  const delta = evidenceScore - selfScore;
  if (Math.abs(delta) < 8) {
    return `Self-perception and publicly available evidence are roughly aligned for ${dimensionLabel}.`;
  }
  if (delta < -15) {
    return `Self-perception of ${dimensionLabel} is materially higher than what the public record supports. This is the most common gap pattern and frequently the most actionable one.`;
  }
  if (delta < 0) {
    return `Self-perception of ${dimensionLabel} runs ahead of what publicly available evidence currently demonstrates.`;
  }
  if (delta > 15) {
    return `Publicly available evidence shows stronger ${dimensionLabel} than the self-assessment indicates. The organization may be under-claiming credit for real progress.`;
  }
  return `Publicly available evidence reads slightly stronger than the self-assessment on ${dimensionLabel}.`;
}

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

const DIMENSION_LABELS: Record<Dimension, string> = {
  adoption_behavior: 'Adoption Behavior',
  authority_structure: 'Authority Structure',
  workflow_integration: 'Workflow Integration',
  decision_velocity: 'Decision Velocity',
  economic_translation: 'Economic Translation',
};

export function buildCalibrationOverlay(
  profile: CompanyResearchProfile | null,
  selfScoresByDimension: Record<Dimension, number>
): CalibrationOverlay {
  if (!profile) {
    return {
      available: false,
      reason: 'No publicly available research has been completed for this session yet.',
      sourcesConsulted: 0,
      confidenceLevel: 'low',
      generatedAt: new Date().toISOString(),
      byDimension: {} as Record<Dimension, DimensionCalibration>,
      summary: '',
    };
  }

  const scorers: Record<Dimension, (p: CompanyResearchProfile) => {
    evidenceScore: number;
    signals: DimensionCalibrationSignal[];
    confidence: 'high' | 'moderate' | 'low' | 'insufficient';
  }> = {
    authority_structure: scoreAuthorityStructure,
    adoption_behavior: scoreAdoptionBehavior,
    workflow_integration: scoreWorkflowIntegration,
    decision_velocity: scoreDecisionVelocity,
    economic_translation: scoreEconomicTranslation,
  };

  const byDimension: Record<Dimension, DimensionCalibration> = {} as Record<Dimension, DimensionCalibration>;
  const deltas: number[] = [];

  (Object.keys(scorers) as Dimension[]).forEach((dim) => {
    const selfScore = selfScoresByDimension[dim] ?? 50;
    const { evidenceScore, signals, confidence } = scorers[dim](profile);
    const delta = evidenceScore - selfScore;
    deltas.push(delta);
    byDimension[dim] = {
      dimension: dim,
      selfScore,
      evidenceScore,
      delta,
      confidence,
      signals,
      narrative: narrateDelta(selfScore, evidenceScore, DIMENSION_LABELS[dim]),
    };
  });

  // Top-level summary
  const meanDelta = deltas.reduce((a, b) => a + b, 0) / Math.max(1, deltas.length);
  const largestGap = (Object.values(byDimension) as DimensionCalibration[])
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];

  let summary: string;
  if (Math.abs(meanDelta) < 8) {
    summary = `Self-assessment and publicly available evidence are broadly aligned across all five dimensions. The largest individual gap appears in ${DIMENSION_LABELS[largestGap.dimension]} at ${largestGap.delta > 0 ? '+' : ''}${largestGap.delta} points.`;
  } else if (meanDelta < 0) {
    summary = `On balance, self-assessment runs ${Math.abs(Math.round(meanDelta))} points higher than publicly available evidence supports. The largest gap is in ${DIMENSION_LABELS[largestGap.dimension]} (self ${largestGap.selfScore}, evidence ${largestGap.evidenceScore}).`;
  } else {
    summary = `On balance, publicly available evidence suggests this organization may be under-claiming credit by about ${Math.round(meanDelta)} points across dimensions. The largest under-claim is in ${DIMENSION_LABELS[largestGap.dimension]}.`;
  }

  return {
    available: true,
    sourcesConsulted: profile.sourcesConsulted,
    confidenceLevel: profile.confidenceLevel,
    generatedAt: new Date().toISOString(),
    byDimension,
    summary,
  };
}
