// =============================================================================
// RLK AI Diagnostic — Scoring Engine
// =============================================================================
// Computes dimension scores, composite indices, and normalizes to 0–100 scale.
// =============================================================================

import {
  AssessmentResponse,
  CompanyProfile,
  CompositeIndex,
  Dimension,
  DimensionScore,
  Industry,
} from '@/types/diagnostic';
import { DIAGNOSTIC_QUESTIONS, QUESTIONS_BY_DIMENSION } from './questions';
import { getIndustryWeightModifiers } from './customization';

// ---------------------------------------------------------------------------
// DIMENSION SCORING
// ---------------------------------------------------------------------------

export function computeDimensionScores(
  responses: AssessmentResponse[],
  profile: CompanyProfile
): DimensionScore[] {
  const dimensions: Dimension[] = [
    'adoption_behavior',
    'authority_structure',
    'workflow_integration',
    'decision_velocity',
    'economic_translation',
  ];

  const industryModifiers = getIndustryWeightModifiers(profile.industry);

  return dimensions.map((dimension) => {
    const dimensionQuestions = QUESTIONS_BY_DIMENSION[dimension] || [];
    const dimensionResponses = responses.filter((r) => {
      const q = DIAGNOSTIC_QUESTIONS.find((q) => q.id === r.questionId);
      return q?.dimension === dimension;
    });

    let weightedScoreSum = 0;
    let weightSum = 0;

    for (const response of dimensionResponses) {
      const question = DIAGNOSTIC_QUESTIONS.find((q) => q.id === response.questionId);
      if (!question) continue;

      const industryMod = industryModifiers[dimension] ?? 1.0;
      const effectiveWeight = question.weight * industryMod;

      weightedScoreSum += response.score * effectiveWeight;
      weightSum += effectiveWeight;
    }

    const maxScorePerQuestion = 5;
    const rawScore = weightSum > 0 ? weightedScoreSum / weightSum : 0;
    const maxPossible = maxScorePerQuestion;
    const normalizedScore = Math.round((rawScore / maxPossible) * 100);

    return {
      dimension,
      rawScore: Math.round(rawScore * 100) / 100,
      normalizedScore: Math.min(100, Math.max(0, normalizedScore)),
      questionCount: dimensionResponses.length,
      maxPossible: dimensionQuestions.length * maxScorePerQuestion,
    };
  });
}

// ---------------------------------------------------------------------------
// COMPOSITE INDEX: AUTHORITY FRICTION
// ---------------------------------------------------------------------------
// Derived from: approval layers, workflow ownership, governance bottlenecks
// Sources: AS-01, AS-03, AS-04, AS-05, AS-07, WI-07, DV-03
// Note: This is an INVERSE index — higher score = LESS friction
// ---------------------------------------------------------------------------

export const AUTHORITY_FRICTION_COMPONENTS: { questionId: string; weight: number }[] = [
  { questionId: 'AS-01', weight: 1.5 },  // Approval layers
  { questionId: 'AS-03', weight: 1.2 },  // Budget reallocation speed
  { questionId: 'AS-04', weight: 1.0 },  // Process conflict resolution
  { questionId: 'AS-05', weight: 1.3 },  // Legal/compliance role
  { questionId: 'AS-07', weight: 1.1 },  // Decentralization
  { questionId: 'WI-07', weight: 0.8 },  // Change management
  { questionId: 'DV-03', weight: 1.4 },  // Re-approval redundancy
];

// ---------------------------------------------------------------------------
// COMPOSITE INDEX: DECISION VELOCITY
// ---------------------------------------------------------------------------
// Derived from: time to approve pilots, time to scale, repetition of approvals
// Sources: DV-01, DV-02, DV-03, DV-04, DV-05, AS-01, AS-03
// ---------------------------------------------------------------------------

export const DECISION_VELOCITY_COMPONENTS: { questionId: string; weight: number }[] = [
  { questionId: 'DV-01', weight: 1.5 },  // Idea to funded pilot
  { questionId: 'DV-02', weight: 1.5 },  // Pilot to scale
  { questionId: 'DV-03', weight: 1.3 },  // Re-approval frequency
  { questionId: 'DV-04', weight: 1.0 },  // Competitive response speed
  { questionId: 'DV-05', weight: 1.1 },  // Procurement speed
  { questionId: 'AS-01', weight: 0.8 },  // Approval layers (cross-dimension)
  { questionId: 'AS-03', weight: 0.7 },  // Budget velocity (cross-dimension)
];

// ---------------------------------------------------------------------------
// COMPOSITE INDEX: ECONOMIC TRANSLATION
// ---------------------------------------------------------------------------
// Derived from: financial measurement, cost reduction, productivity monetization
// Sources: ET-01, ET-02, ET-03, ET-04, ET-05, ET-07
// ---------------------------------------------------------------------------

export const ECONOMIC_TRANSLATION_COMPONENTS: { questionId: string; weight: number }[] = [
  { questionId: 'ET-01', weight: 1.5 },  // Financial measurement
  { questionId: 'ET-02', weight: 1.3 },  // Capacity reallocation
  { questionId: 'ET-03', weight: 1.0 },  // Board justification
  { questionId: 'ET-04', weight: 1.5 },  // Measurable translation
  { questionId: 'ET-05', weight: 1.1 },  // Finance team perspective
  { questionId: 'ET-07', weight: 1.2 },  // Investor defensibility
];

// ---------------------------------------------------------------------------
// COMPOSITE INDEX CALCULATOR
// ---------------------------------------------------------------------------

function computeCompositeIndex(
  components: { questionId: string; weight: number }[],
  responses: AssessmentResponse[],
  name: string,
  slug: 'authority_friction' | 'decision_velocity' | 'economic_translation'
): CompositeIndex {
  const responseMap = new Map(responses.map((r) => [r.questionId, r]));

  let weightedSum = 0;
  let totalWeight = 0;
  const resolvedComponents: CompositeIndex['components'] = [];

  for (const component of components) {
    const response = responseMap.get(component.questionId);
    if (!response) continue;

    weightedSum += response.score * component.weight;
    totalWeight += component.weight;

    resolvedComponents.push({
      questionId: component.questionId,
      weight: component.weight,
      score: response.score,
    });
  }

  const maxScore = 5;
  const rawAverage = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const normalizedScore = Math.round((rawAverage / maxScore) * 100);
  const clampedScore = Math.min(100, Math.max(0, normalizedScore));

  return {
    name,
    slug,
    score: clampedScore,
    components: resolvedComponents,
    interpretation: getIndexInterpretation(slug, clampedScore),
  };
}

export function computeAllIndices(responses: AssessmentResponse[]): CompositeIndex[] {
  return [
    computeCompositeIndex(
      AUTHORITY_FRICTION_COMPONENTS,
      responses,
      'Authority Friction Index',
      'authority_friction'
    ),
    computeCompositeIndex(
      DECISION_VELOCITY_COMPONENTS,
      responses,
      'Decision Velocity Index',
      'decision_velocity'
    ),
    computeCompositeIndex(
      ECONOMIC_TRANSLATION_COMPONENTS,
      responses,
      'Economic Translation Index',
      'economic_translation'
    ),
  ];
}

// ---------------------------------------------------------------------------
// INDEX INTERPRETATION
// ---------------------------------------------------------------------------

function getIndexInterpretation(
  slug: string,
  score: number
): string {
  const interpretations: Record<string, { range: [number, number]; text: string }[]> = {
    authority_friction: [
      { range: [0, 20], text: 'Severe structural friction. AI initiatives face systemic permission bottlenecks that prevent meaningful progress regardless of investment level.' },
      { range: [21, 40], text: 'High friction. Multiple approval layers and governance gaps create a drag on AI value capture. Structural reform is required before scaling.' },
      { range: [41, 60], text: 'Moderate friction. Some enabling structures exist but inconsistency between policy and practice creates unpredictable timelines.' },
      { range: [61, 80], text: 'Low friction. Governance frameworks are mature with clear pathways. Remaining friction points are specific and addressable.' },
      { range: [81, 100], text: 'Minimal friction. Authority structures enable rather than constrain AI adoption. Governance is embedded, not imposed.' },
    ],
    decision_velocity: [
      { range: [0, 20], text: 'Critically slow. The organization takes 6 to 12+ months to move from idea to pilot, making it unable to keep pace with AI evolution.' },
      { range: [21, 40], text: 'Slow. While some AI activity exists, the time from insight to action erodes competitive advantage and team morale.' },
      { range: [41, 60], text: 'Moderate pace. The organization can execute AI initiatives but is slower than industry leaders, creating a widening capability gap.' },
      { range: [61, 80], text: 'Fast. AI decisions move at competitive speed with appropriate governance. The organization can respond to market changes within weeks.' },
      { range: [81, 100], text: 'Industry-leading velocity. AI is deployed with the speed of a technology company while maintaining enterprise governance.' },
    ],
    economic_translation: [
      { range: [0, 20], text: 'No translation. AI spending generates no measurable financial return. The organization is investing without a value capture mechanism.' },
      { range: [21, 40], text: 'Weak translation. Isolated examples of AI value exist but cannot be aggregated into a credible financial narrative.' },
      { range: [41, 60], text: 'Emerging translation. Some AI investments are measured, but significant value leaks through untracked productivity gains and unrealized capacity.' },
      { range: [61, 80], text: 'Strong translation. AI value is systematically measured and reported. Finance and operations are aligned on AI economics.' },
      { range: [81, 100], text: 'Full economic integration. AI value is visible in financial statements and drives capital allocation decisions.' },
    ],
  };

  const levels = interpretations[slug] || [];
  for (const level of levels) {
    if (score >= level.range[0] && score <= level.range[1]) {
      return level.text;
    }
  }
  return '';
}

// ---------------------------------------------------------------------------
// OVERALL COMPOSITE SCORE
// ---------------------------------------------------------------------------

export function computeOverallScore(dimensionScores: DimensionScore[]): number {
  // Weighted average of dimension scores
  const weights: Record<Dimension, number> = {
    adoption_behavior: 1.2,
    authority_structure: 1.1,
    workflow_integration: 1.3,
    decision_velocity: 1.0,
    economic_translation: 1.4,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const ds of dimensionScores) {
    const w = weights[ds.dimension] || 1.0;
    weightedSum += ds.normalizedScore * w;
    totalWeight += w;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

// ---------------------------------------------------------------------------
// INDUSTRY-SPECIFIC BENCHMARKS
// ---------------------------------------------------------------------------

export const INDUSTRY_BENCHMARKS: Record<Industry, { avgScore: number; topQuartile: number; label: string }> = {
  // Financial Services
  insurance: { avgScore: 35, topQuartile: 58, label: 'Insurance' },
  banking: { avgScore: 42, topQuartile: 65, label: 'Banking' },
  capital_markets: { avgScore: 42, topQuartile: 65, label: 'Capital Markets' },
  asset_wealth_management: { avgScore: 42, topQuartile: 65, label: 'Asset & Wealth Management' },
  investment_banking: { avgScore: 44, topQuartile: 67, label: 'Investment Banking' },
  private_equity: { avgScore: 46, topQuartile: 68, label: 'Private Equity' },
  venture_capital: { avgScore: 50, topQuartile: 72, label: 'Venture Capital' },
  hedge_funds: { avgScore: 48, topQuartile: 70, label: 'Hedge Funds' },
  // Healthcare & Life Sciences
  healthcare_providers: { avgScore: 30, topQuartile: 52, label: 'Healthcare Providers' },
  healthcare_payers: { avgScore: 30, topQuartile: 52, label: 'Healthcare Payers' },
  healthcare_services: { avgScore: 32, topQuartile: 54, label: 'Healthcare Services' },
  life_sciences_pharma: { avgScore: 30, topQuartile: 52, label: 'Life Sciences & Pharma' },
  // Consumer & Retail
  retail: { avgScore: 40, topQuartile: 61, label: 'Retail' },
  ecommerce_digital: { avgScore: 45, topQuartile: 68, label: 'E-Commerce & Digital' },
  cpg: { avgScore: 40, topQuartile: 61, label: 'Consumer Packaged Goods' },
  dtc: { avgScore: 44, topQuartile: 66, label: 'Direct-to-Consumer' },
  food_beverage: { avgScore: 36, topQuartile: 58, label: 'Food & Beverage' },
  // Industrial & Energy
  manufacturing_discrete: { avgScore: 33, topQuartile: 55, label: 'Discrete Manufacturing' },
  manufacturing_process: { avgScore: 33, topQuartile: 55, label: 'Process Manufacturing' },
  automotive: { avgScore: 33, topQuartile: 55, label: 'Automotive' },
  aerospace_defense: { avgScore: 44, topQuartile: 65, label: 'Aerospace & Defense' },
  energy_oil_gas: { avgScore: 28, topQuartile: 48, label: 'Energy & Oil/Gas' },
  utilities: { avgScore: 28, topQuartile: 48, label: 'Utilities' },
  chemicals_materials: { avgScore: 30, topQuartile: 50, label: 'Chemicals & Materials' },
  industrial_services: { avgScore: 31, topQuartile: 52, label: 'Industrial Services' },
  // Technology
  software_saas: { avgScore: 58, topQuartile: 78, label: 'Software & SaaS' },
  it_services: { avgScore: 52, topQuartile: 73, label: 'IT Services' },
  hardware_electronics: { avgScore: 58, topQuartile: 78, label: 'Hardware & Electronics' },
  // Infrastructure & Logistics
  transportation: { avgScore: 41, topQuartile: 62, label: 'Transportation' },
  shipping_logistics: { avgScore: 41, topQuartile: 62, label: 'Shipping & Logistics' },
  infrastructure_transport: { avgScore: 35, topQuartile: 56, label: 'Infrastructure & Transport' },
  construction_engineering: { avgScore: 33, topQuartile: 55, label: 'Construction & Engineering' },
  real_estate_commercial: { avgScore: 30, topQuartile: 50, label: 'Commercial Real Estate' },
  real_estate_residential: { avgScore: 28, topQuartile: 48, label: 'Residential Real Estate' },
  // Media & Telecom
  telecommunications: { avgScore: 46, topQuartile: 66, label: 'Telecommunications' },
  media_entertainment: { avgScore: 48, topQuartile: 70, label: 'Media & Entertainment' },
  // Public Sector & Non-Profit
  government_federal: { avgScore: 32, topQuartile: 52, label: 'Federal Government' },
  government_state_local: { avgScore: 28, topQuartile: 48, label: 'State & Local Government' },
  defense_contractors: { avgScore: 38, topQuartile: 60, label: 'Defense Contractors' },
  nonprofit_ngo: { avgScore: 26, topQuartile: 45, label: 'Nonprofit & NGO' },
  // Professional Services
  consulting_services: { avgScore: 40, topQuartile: 62, label: 'Consulting Services' },
  legal_services: { avgScore: 34, topQuartile: 56, label: 'Legal Services' },
  accounting_audit: { avgScore: 36, topQuartile: 58, label: 'Accounting & Audit' },
};
