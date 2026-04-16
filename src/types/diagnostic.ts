// =============================================================================
// RLK AI Diagnostic — Core Diagnostic Types
// =============================================================================

export type Dimension =
  | 'adoption_behavior'
  | 'authority_structure'
  | 'workflow_integration'
  | 'decision_velocity'
  | 'economic_translation';

export interface AnswerOption {
  text: string;
  score: number; // 0–5
}

export interface DiagnosticQuestion {
  id: string;
  dimension: Dimension;
  text: string;
  subtext?: string; // Clarifying context for respondent
  options: AnswerOption[];
  weight: number; // Base weight (1.0 = normal, can be adjusted by customization)
  tags: string[]; // For customization matching (e.g., 'governance', 'financial')
  industryExamples?: Partial<Record<Industry, string>>; // Industry-specific subtext
}

export interface CompanyProfile {
  companyName: string;
  ticker?: string; // Stock ticker (e.g., "AAPL") for public company research
  websiteUrl?: string; // Company website for research targeting
  industry: Industry;
  industryDisplayLabel?: string; // The user-selected MCC sub-industry label
  subIndustry?: string;
  revenue: number; // Annual revenue in USD
  employeeCount: number;
  publicOrPrivate: 'public' | 'private';
  regulatoryIntensity: 'low' | 'moderate' | 'high' | 'very_high';
  primaryAIUseCases: string[]; // e.g., ['claims', 'underwriting', 'customer_service']
  executiveName?: string;
  executiveTitle?: string;
  executiveEmail?: string;
}

export type Industry =
  // Financial Services
  | 'insurance'
  | 'banking'
  | 'capital_markets'
  | 'asset_wealth_management'
  | 'investment_banking'
  | 'private_equity'
  | 'venture_capital'
  | 'hedge_funds'
  // Healthcare & Life Sciences
  | 'healthcare_providers'
  | 'healthcare_payers'
  | 'healthcare_services'
  | 'life_sciences_pharma'
  // Consumer & Retail
  | 'retail'
  | 'ecommerce_digital'
  | 'cpg'
  | 'dtc'
  | 'food_beverage'
  // Industrial & Energy
  | 'manufacturing_discrete'
  | 'manufacturing_process'
  | 'automotive'
  | 'aerospace_defense'
  | 'energy_oil_gas'
  | 'utilities'
  | 'chemicals_materials'
  | 'industrial_services'
  // Technology
  | 'software_saas'
  | 'it_services'
  | 'hardware_electronics'
  // Infrastructure & Logistics
  | 'transportation'
  | 'shipping_logistics'
  | 'infrastructure_transport'
  | 'construction_engineering'
  | 'real_estate_commercial'
  | 'real_estate_residential'
  // Media & Telecom
  | 'telecommunications'
  | 'media_entertainment'
  // Public Sector & Non-Profit
  | 'government_federal'
  | 'government_state_local'
  | 'defense_contractors'
  | 'nonprofit_ngo'
  // Professional Services
  | 'consulting_services'
  | 'legal_services'
  | 'accounting_audit';

export interface AssessmentResponse {
  questionId: string;
  selectedOptionIndex: number;
  score: number;
  durationMs?: number; // time spent on this question
}

export interface ResponseQualityMetrics {
  totalDurationMs: number;
  averageQuestionTimeMs: number;
  fastResponseCount: number; // < 3 seconds
  straightLineDetected: boolean; // same answer 10+ times in a row
  qualityGrade: 'high' | 'acceptable' | 'low' | 'suspect';
}

export interface ConsistencyFlag {
  questionPairIds: [string, string];
  type: 'contradiction' | 'unlikely';
  severity: 'high' | 'moderate';
  explanation: string;
}

export interface DimensionScore {
  dimension: Dimension;
  rawScore: number;
  normalizedScore: number; // 0–100
  questionCount: number;
  maxPossible: number;
}

export interface CompositeIndex {
  name: string;
  slug: 'authority_friction' | 'decision_velocity' | 'economic_translation';
  score: number; // 0–100
  components: { questionId: string; weight: number; score: number }[];
  interpretation: string;
}

export type StageNumber = 1 | 2 | 3 | 4 | 5;

export interface StageClassification {
  primaryStage: StageNumber;
  stageName: string;
  stageDescription: string;
  dimensionStages: Record<Dimension, StageNumber>;
  mixedStageNarrative: string;
  confidence: number; // 0–1, lower when dimensions diverge significantly
  confidenceFactors?: Record<string, number>;
}

export interface EconomicSource {
  name: string;
  metric: string;
  year: number;
  url?: string;
}

export interface EconomicEstimate {
  productivityPotentialPercent: number; // 10–35%
  currentCapturePercent: number;
  /** Raw base rate from the industry-group × stage matrix (e.g. 0.25 = 25%) */
  captureRateBase: number;
  /** Diagnostic modifier multiplier (e.g. 1.077) */
  captureRateModifier: number;
  /** Industry capture group key (e.g. "professional_services") */
  captureRateGroup: string;
  unrealizedValueLow: number;
  unrealizedValueHigh: number;
  annualWastedHours: number;
  costPerEmployee: number;
  industryBenchmark: string;
  warnings?: string[];
  sources?: EconomicSource[];
}

export interface DiagnosticResult {
  id: string;
  completedAt: string;
  companyProfile: CompanyProfile;
  responses: AssessmentResponse[];
  dimensionScores: DimensionScore[];
  compositeIndices: CompositeIndex[];
  stageClassification: StageClassification;
  economicEstimate: EconomicEstimate;
  overallScore: number; // 0–100 composite
  responseQuality?: ResponseQualityMetrics;
  consistencyFlags?: ConsistencyFlag[];
  researchAlignment?: string; // Narrative from research-scoring integration
  sensitivityAnalysis?: SensitivityResult;
}

export interface SensitivityItem {
  questionId: string;
  questionText: string;
  dimension: string;
  currentScore: number;
  hypotheticalScore: number;
  overallDelta: number;
  stageDelta: number;
  dimensionDelta: number;
}

export interface SensitivityResult {
  topImpactQuestions: SensitivityItem[];
  highestLeverageDimension: string;
  averageDelta: number;
}

export interface ReportSection {
  title: string;
  slug: string;
  content: string; // AI-generated markdown
}

export interface CompetitorPosition {
  label: string;
  capability: number;
  readiness: number;
  rationale: string;
}

export interface GeneratedReport {
  id: string;
  diagnosticResultId: string;
  generatedAt: string;
  sections: ReportSection[];
  companyProfile: CompanyProfile;
  stageClassification: StageClassification;
  economicEstimate: EconomicEstimate;
  competitorPositions?: CompetitorPosition[];
}

// Assessment session tracking
export interface AssessmentSession {
  id: string;
  createdAt: string;
  companyProfile: CompanyProfile;
  responses: AssessmentResponse[];
  currentQuestionIndex: number;
  status: 'intake' | 'in_progress' | 'completed' | 'report_generated' | 'paid';
  diagnosticResult?: DiagnosticResult;
  generatedReport?: GeneratedReport;
  paymentId?: string;
}
