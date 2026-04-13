// =============================================================================
// RLK AI Board Brief — Core Diagnostic Types
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
}

export interface CompanyProfile {
  companyName: string;
  ticker?: string; // Stock ticker (e.g., "AAPL") for public company research
  websiteUrl?: string; // Company website for research targeting
  industry: Industry;
  subIndustry?: string;
  revenue: number; // Annual revenue in USD
  employeeCount: number;
  publicOrPrivate: 'public' | 'private';
  regulatoryIntensity: 'low' | 'moderate' | 'high' | 'very_high';
  primaryAIUseCases: string[]; // e.g., ['claims', 'underwriting', 'customer_service']
  executiveTitle?: string;
  executiveEmail?: string;
}

export type Industry =
  | 'financial_services'
  | 'insurance'
  | 'healthcare'
  | 'manufacturing'
  | 'technology'
  | 'retail_ecommerce'
  | 'professional_services'
  | 'energy_utilities'
  | 'government'
  | 'education'
  | 'media_entertainment'
  | 'other';

export interface AssessmentResponse {
  questionId: string;
  selectedOptionIndex: number;
  score: number;
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
}

export interface EconomicEstimate {
  productivityPotentialPercent: number; // 10–35%
  currentCapturePercent: number;
  unrealizedValueLow: number;
  unrealizedValueHigh: number;
  annualWastedHours: number;
  costPerEmployee: number;
  industryBenchmark: string;
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
}

export interface ReportSection {
  title: string;
  slug: string;
  content: string; // AI-generated markdown
}

export interface GeneratedReport {
  id: string;
  diagnosticResultId: string;
  generatedAt: string;
  sections: ReportSection[];
  companyProfile: CompanyProfile;
  stageClassification: StageClassification;
  economicEstimate: EconomicEstimate;
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
