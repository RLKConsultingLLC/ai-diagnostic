// =============================================================================
// RLK AI Diagnostic — Stage Classification Engine
// =============================================================================
// Classifies organizations into 5 stages of AI maturity using composite
// indices and dimension scores. Handles mixed-stage nuance.
// =============================================================================

import {
  CompositeIndex,
  ConsistencyFlag,
  Dimension,
  DimensionScore,
  ResponseQualityMetrics,
  StageClassification,
  StageNumber,
} from '@/types/diagnostic';

// ---------------------------------------------------------------------------
// STAGE DEFINITIONS
// ---------------------------------------------------------------------------

interface StageDefinition {
  stage: StageNumber;
  name: string;
  description: string;
  overallThreshold: [number, number]; // [min, max] on 0–100 scale
  boardNarrative: string;
}

export const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    stage: 1,
    name: 'Tool Curiosity',
    description:
      'AI is discussed but not embedded. Individuals may experiment, but the organization has no strategy, no measurement, and no structural support for AI adoption.',
    overallThreshold: [0, 20],
    boardNarrative:
      'Your organization is in the exploratory phase. AI conversations are happening, but there is no organizational infrastructure to convert curiosity into capability. Without structural intervention, the gap between your organization and AI-enabled competitors will widen significantly over the next 12 to 18 months.',
  },
  {
    stage: 2,
    name: 'Pilot Proliferation',
    description:
      'Multiple pilots exist but they are uncoordinated, inconsistently funded, and rarely reach production. Value is promised but not proven.',
    overallThreshold: [21, 40],
    boardNarrative:
      'Your organization has moved beyond curiosity into active experimentation, but pilots are proliferating without coordination or clear paths to production. This stage is where most AI investment is wasted. The gap between pilot activity and operational impact represents significant unrealized value.',
  },
  {
    stage: 3,
    name: 'Managed Deployment',
    description:
      'Some AI initiatives are in production with governance frameworks emerging. Value is being captured in pockets but not systematically across the organization.',
    overallThreshold: [41, 60],
    boardNarrative:
      'Your organization has begun translating AI from experiments into operational capability. Governance structures are forming and some financial impact is visible. The critical challenge at this stage is preventing the "frozen middle," where initial successes plateau due to structural and cultural barriers to scaling.',
  },
  {
    stage: 4,
    name: 'Operational Integration',
    description:
      'AI is embedded in core workflows with mature governance. Financial impact is measured and material. The organization can deploy AI at speed with appropriate risk management.',
    overallThreshold: [61, 80],
    boardNarrative:
      'Your organization has achieved meaningful AI integration with measurable financial returns. AI is no longer a side initiative. It is part of how the business operates. The opportunity now is accelerating value capture and preventing competitors from closing the gap.',
  },
  {
    stage: 5,
    name: 'AI-Native Enterprise',
    description:
      'AI is the operating model. Decisions, workflows, and resource allocation are AI-augmented by default. The organization continuously evolves its AI capabilities as a core competency.',
    overallThreshold: [81, 100],
    boardNarrative:
      'Your organization operates as an AI-native enterprise. AI is not a capability layered onto the business; it is foundational to how the business creates and captures value. Fewer than 5% of enterprises globally have reached this stage. The priority is maintaining this advantage through continuous evolution.',
  },
];

// ---------------------------------------------------------------------------
// DIMENSION-LEVEL STAGE CLASSIFICATION
// ---------------------------------------------------------------------------

function classifyDimensionStage(score: number): StageNumber {
  if (score <= 20) return 1;
  if (score <= 40) return 2;
  if (score <= 60) return 3;
  if (score <= 80) return 4;
  return 5;
}

// ---------------------------------------------------------------------------
// PRIMARY STAGE CLASSIFICATION
// ---------------------------------------------------------------------------
// Uses a weighted combination of:
//   - Overall dimension average (40%)
//   - Composite index average (40%)
//   - Lowest dimension score drag factor (20%)
//
// This prevents high-performing areas from masking critical weaknesses.
// ---------------------------------------------------------------------------

export interface ClassifyStageOptions {
  qualityMetrics?: ResponseQualityMetrics;
  consistencyFlags?: ConsistencyFlag[];
  totalQuestions?: number;
  answeredQuestions?: number;
}

export function classifyStage(
  dimensionScores: DimensionScore[],
  compositeIndices: CompositeIndex[],
  options?: ClassifyStageOptions
): StageClassification {
  // Compute dimension average
  const dimAvg =
    dimensionScores.reduce((sum, d) => sum + d.normalizedScore, 0) /
    Math.max(dimensionScores.length, 1);

  // Compute index average
  const idxAvg =
    compositeIndices.reduce((sum, i) => sum + i.score, 0) /
    Math.max(compositeIndices.length, 1);

  // Find lowest dimension (drag factor)
  const lowestDim = Math.min(...dimensionScores.map((d) => d.normalizedScore));

  // Weighted composite: prevents masking weaknesses
  const compositeScore = dimAvg * 0.4 + idxAvg * 0.4 + lowestDim * 0.2;

  // Classify primary stage
  let primaryStage: StageNumber = 1;
  for (const def of STAGE_DEFINITIONS) {
    if (compositeScore >= def.overallThreshold[0] && compositeScore <= def.overallThreshold[1]) {
      primaryStage = def.stage;
      break;
    }
  }

  // Classify each dimension independently
  const dimensionStages: Record<Dimension, StageNumber> = {} as Record<Dimension, StageNumber>;
  for (const ds of dimensionScores) {
    dimensionStages[ds.dimension] = classifyDimensionStage(ds.normalizedScore);
  }

  // Compute stage spread for confidence and mixed narrative
  const stageValues = Object.values(dimensionStages);
  const maxStage = Math.max(...stageValues);
  const minStage = Math.min(...stageValues);
  const spread = maxStage - minStage;

  // Compute multi-factor confidence
  const { confidence, confidenceFactors } = computeConfidence(spread, options);

  // Build mixed-stage narrative
  const mixedStageNarrative = buildMixedStageNarrative(
    dimensionStages,
    dimensionScores,
    primaryStage,
    spread
  );

  const stageDef = STAGE_DEFINITIONS.find((d) => d.stage === primaryStage)!;

  return {
    primaryStage,
    stageName: stageDef.name,
    stageDescription: stageDef.description,
    dimensionStages,
    mixedStageNarrative,
    confidence,
    confidenceFactors,
  };
}

// ---------------------------------------------------------------------------
// MULTI-FACTOR CONFIDENCE CALCULATION
// ---------------------------------------------------------------------------

function computeConfidence(
  spread: number,
  options?: ClassifyStageOptions
): { confidence: number; confidenceFactors: Record<string, number> } {
  const factors: Record<string, number> = {};

  // Base: 1.0
  let score = 1.0;

  // Factor 1: Dimension spread (-0.05 per stage of spread)
  const spreadPenalty = spread * 0.05;
  score -= spreadPenalty;
  factors.dimensionSpread = -spreadPenalty;

  // Factor 2: Response quality grade
  if (options?.qualityMetrics) {
    const qualityPenalties: Record<string, number> = {
      high: 0,
      acceptable: 0.03,
      low: 0.08,
      suspect: 0.15,
    };
    const qp = qualityPenalties[options.qualityMetrics.qualityGrade] || 0;
    score -= qp;
    factors.responseQuality = -qp;
  }

  // Factor 3: Consistency flags
  if (options?.consistencyFlags && options.consistencyFlags.length > 0) {
    const highFlags = options.consistencyFlags.filter((f) => f.severity === 'high').length;
    const modFlags = options.consistencyFlags.filter((f) => f.severity === 'moderate').length;
    const cp = highFlags * 0.03 + modFlags * 0.01;
    score -= cp;
    factors.consistencyFlags = -cp;
  }

  // Factor 4: Answer completeness
  if (options?.totalQuestions && options?.answeredQuestions) {
    const missing = options.totalQuestions - options.answeredQuestions;
    if (missing > 0) {
      const mp = missing * 0.02;
      score -= mp;
      factors.answerCompleteness = -mp;
    }
  }

  // Floor at 0.65 to allow genuinely low confidence for suspect data
  // but never go below 65% — the structural methodology still has value
  const confidence = Math.max(0.65, score);
  return { confidence, confidenceFactors: factors };
}

// ---------------------------------------------------------------------------
// MIXED-STAGE NARRATIVE BUILDER
// ---------------------------------------------------------------------------

function buildMixedStageNarrative(
  dimensionStages: Record<Dimension, StageNumber>,
  dimensionScores: DimensionScore[],
  primaryStage: StageNumber,
  spread: number
): string {
  if (spread <= 1) {
    return `Your organization shows consistent AI maturity across all dimensions, firmly positioned at Stage ${primaryStage}. This alignment is relatively uncommon and suggests a coherent approach to AI adoption.`;
  }

  const dimensionLabels: Record<Dimension, string> = {
    adoption_behavior: 'Adoption Behavior',
    authority_structure: 'Authority Structure',
    workflow_integration: 'Workflow Integration',
    decision_velocity: 'Decision Velocity',
    economic_translation: 'Economic Translation',
  };

  // Identify strongest and weakest dimensions
  const sorted = dimensionScores.sort((a, b) => b.normalizedScore - a.normalizedScore);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  const strongLabel = dimensionLabels[strongest.dimension];
  const weakLabel = dimensionLabels[weakest.dimension];
  const strongStage = dimensionStages[strongest.dimension];
  const weakStage = dimensionStages[weakest.dimension];

  let narrative = `Your organization exhibits a ${spread >= 3 ? 'significant' : 'notable'} maturity gap across dimensions. `;
  narrative += `${strongLabel} is your strongest dimension at Stage ${strongStage}, while ${weakLabel} lags at Stage ${weakStage}. `;

  if (spread >= 3) {
    narrative += `This ${spread}-stage spread represents a structural misalignment that limits your ability to capture value from AI investments. `;
    narrative += `Your strongest capabilities are being constrained by bottlenecks in ${weakLabel}. `;
    narrative += `Targeted intervention in the weakest dimension will yield disproportionate returns.`;
  } else {
    narrative += `This gap is common at your stage but addressable. Focused attention on ${weakLabel} will unlock value currently trapped by this imbalance.`;
  }

  return narrative;
}

// ---------------------------------------------------------------------------
// STAGE-BASED RECOMMENDATIONS
// ---------------------------------------------------------------------------

export interface StageRecommendation {
  priority: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  timeframe: string;
  dimension: Dimension;
}

export function getStageRecommendations(
  stage: StageClassification,
  dimensionScores: DimensionScore[]
): StageRecommendation[] {
  const recommendations: StageRecommendation[] = [];
  const sorted = [...dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore);

  // Always address weakest dimension first
  const weakest = sorted[0];

  const recommendationMap: Record<Dimension, Record<StageNumber, StageRecommendation>> = {
    adoption_behavior: {
      1: { priority: 'critical', title: 'Establish AI Adoption Infrastructure', description: 'Create a visible, resourced program for AI adoption with executive sponsorship, clear use case selection, and structured onboarding. Without this foundation, all other AI investment is at risk.', timeframe: '0–90 days', dimension: 'adoption_behavior' },
      2: { priority: 'high', title: 'Convert Experimentation to Structured Adoption', description: 'Move from ad hoc experimentation to deliberate adoption management. Identify 3–5 high-impact use cases, resource them properly, and establish clear success metrics.', timeframe: '30–120 days', dimension: 'adoption_behavior' },
      3: { priority: 'medium', title: 'Scale Adoption Across the Organization', description: 'Expand successful adoption patterns to underserved business units. Create communities of practice and center-of-excellence models to accelerate diffusion.', timeframe: '60–180 days', dimension: 'adoption_behavior' },
      4: { priority: 'medium', title: 'Deepen Adoption Quality', description: 'Shift focus from breadth to depth of adoption. Ensure AI tools are being used to their full capability, not just surface features.', timeframe: '90–180 days', dimension: 'adoption_behavior' },
      5: { priority: 'medium', title: 'Maintain Adoption Excellence', description: 'Continue evolving adoption practices. Focus on emerging use cases and next-generation capabilities.', timeframe: 'Ongoing', dimension: 'adoption_behavior' },
    },
    authority_structure: {
      1: { priority: 'critical', title: 'Designate AI Decision Authority', description: 'Appoint a senior leader with explicit authority and budget for AI initiatives. Current ambiguity in ownership is the primary bottleneck.', timeframe: '0–30 days', dimension: 'authority_structure' },
      2: { priority: 'critical', title: 'Streamline AI Governance', description: 'Reduce approval layers for AI initiatives. Create pre-approved categories and spending thresholds that allow teams to move without repeated escalation.', timeframe: '30–90 days', dimension: 'authority_structure' },
      3: { priority: 'high', title: 'Formalize Federated AI Governance', description: 'Establish clear governance frameworks that balance central oversight with business unit autonomy. Define what requires central approval vs. what teams can do independently.', timeframe: '60–120 days', dimension: 'authority_structure' },
      4: { priority: 'medium', title: 'Optimize Governance Efficiency', description: 'Identify and eliminate remaining governance friction points. Ensure legal and compliance are embedded partners, not sequential gates.', timeframe: '90–180 days', dimension: 'authority_structure' },
      5: { priority: 'medium', title: 'Evolve Governance for AI-Native Operations', description: 'Adapt governance frameworks for continuous AI evolution. Ensure structures support rapid capability deployment.', timeframe: 'Ongoing', dimension: 'authority_structure' },
    },
    workflow_integration: {
      1: { priority: 'critical', title: 'Connect AI to Core Workflows', description: 'AI tools that live outside daily workflows will never achieve adoption. Prioritize integration into 2–3 systems your employees use every day.', timeframe: '30–90 days', dimension: 'workflow_integration' },
      2: { priority: 'high', title: 'Build Integration Infrastructure', description: 'Invest in APIs, data pipelines, and platform capabilities that allow AI to operate within existing workflows rather than alongside them.', timeframe: '60–120 days', dimension: 'workflow_integration' },
      3: { priority: 'high', title: 'Automate AI-to-Workflow Handoffs', description: 'Eliminate manual handoffs between AI outputs and operational systems. Move from "AI generates, human transfers" to automated flow with human oversight.', timeframe: '60–150 days', dimension: 'workflow_integration' },
      4: { priority: 'medium', title: 'Unify AI Platform', description: 'Connect disparate AI tools into a coherent platform where context is shared and tools reinforce each other.', timeframe: '90–180 days', dimension: 'workflow_integration' },
      5: { priority: 'medium', title: 'Evolve to Invisible AI Infrastructure', description: 'Continue making AI invisible within workflows. Employees should interact with enhanced tools, not AI tools.', timeframe: 'Ongoing', dimension: 'workflow_integration' },
    },
    decision_velocity: {
      1: { priority: 'critical', title: 'Create Fast-Track Decision Pathway', description: 'Establish a rapid-approval mechanism for AI initiatives under a defined risk threshold. Current decision speed guarantees competitive disadvantage.', timeframe: '0–60 days', dimension: 'decision_velocity' },
      2: { priority: 'high', title: 'Reduce Decision Cycle Time', description: 'Audit the current approval chain and eliminate redundant reviews. Set target cycle times for pilot approval (< 30 days) and scale decisions (< 90 days).', timeframe: '30–90 days', dimension: 'decision_velocity' },
      3: { priority: 'high', title: 'Implement Stage-Gate Decision Model', description: 'Replace sequential re-approvals with a stage-gate model where initial approval covers the full lifecycle with defined checkpoints.', timeframe: '60–120 days', dimension: 'decision_velocity' },
      4: { priority: 'medium', title: 'Accelerate to Market Speed', description: 'Benchmark decision velocity against technology companies and fast-moving competitors. Identify remaining velocity constraints.', timeframe: '90–180 days', dimension: 'decision_velocity' },
      5: { priority: 'medium', title: 'Sustain Velocity Advantage', description: 'Maintain decision speed as competitive advantage. Continue evolving processes to match AI evolution pace.', timeframe: 'Ongoing', dimension: 'decision_velocity' },
    },
    economic_translation: {
      1: { priority: 'critical', title: 'Establish AI Value Measurement', description: 'Before investing further, build the measurement infrastructure to track AI financial impact. You cannot manage what you cannot measure, and the board cannot support what cannot be quantified.', timeframe: '0–60 days', dimension: 'economic_translation' },
      2: { priority: 'critical', title: 'Implement Value Capture Framework', description: 'Move beyond anecdotal ROI. Deploy a standardized framework for measuring AI value across cost savings, productivity gains, and revenue impact.', timeframe: '30–90 days', dimension: 'economic_translation' },
      3: { priority: 'high', title: 'Connect AI Value to P&L', description: 'Ensure AI value metrics flow into financial reporting. Finance and AI leadership must be aligned on how value is counted and reported.', timeframe: '60–120 days', dimension: 'economic_translation' },
      4: { priority: 'medium', title: 'Optimize Value Capture Rate', description: 'Identify where AI is generating value that is not being captured, particularly in time savings that are absorbed without reallocation.', timeframe: '90–180 days', dimension: 'economic_translation' },
      5: { priority: 'medium', title: 'Drive AI-Led Economic Strategy', description: 'Use AI economics to drive capital allocation and strategic planning. AI should be a primary input to investment decisions.', timeframe: 'Ongoing', dimension: 'economic_translation' },
    },
  };

  // Add recommendations for the 3 weakest dimensions
  for (let i = 0; i < Math.min(3, sorted.length); i++) {
    const dim = sorted[i];
    const dimStage = stage.dimensionStages[dim.dimension];
    const rec = recommendationMap[dim.dimension]?.[dimStage];
    if (rec) {
      recommendations.push(rec);
    }
  }

  return recommendations;
}
