// =============================================================================
// RLK AI Board Brief — Company Research Enrichment Types
// =============================================================================
// Background research runs while the customer takes the diagnostic.
// Claude enriches their profile using public data: SEC filings, news,
// earnings calls, press releases, leadership interviews, etc.
// =============================================================================

export interface CompanyResearchProfile {
  companyName: string;
  ticker?: string;
  industry: string;

  // SEC / Financial Data
  financialHighlights?: FinancialHighlights;
  recentEarnings?: EarningsInsight[];

  // News & Press
  recentNews: NewsItem[];
  pressReleases: PressItem[];

  // Leadership & Strategy
  leadershipInsights: LeadershipInsight[];
  strategicInitiatives: StrategicInitiative[];

  // AI-Specific Intelligence
  aiMentions: AIMention[];
  aiInvestments: AIInvestment[];
  competitorAIActivity: CompetitorActivity[];

  // Industry Context
  industryTrends: IndustryTrend[];
  regulatoryDevelopments: RegulatoryItem[];

  // Synthesized Intelligence
  executiveBriefing: string;          // Claude-synthesized 2-paragraph briefing
  aiPostureAssessment: string;        // What public data reveals about their AI stance
  competitivePositionNote: string;    // Where they stand vs peers based on public info
  riskFactors: string[];              // AI-related risks from public filings/news
  opportunities: string[];            // AI opportunities specific to this company

  // Metadata
  researchCompletedAt: string;
  sourcesConsulted: number;
  confidenceLevel: 'high' | 'moderate' | 'low';
}

export interface FinancialHighlights {
  revenue?: string;
  revenueGrowth?: string;
  operatingMargin?: string;
  employeeCount?: string;
  rAndDSpend?: string;
  technologySpend?: string;
  recentAcquisitions?: string[];
  keyRiskFactors?: string[];
  managementDiscussionExcerpts?: string[];
  source: string;
}

export interface EarningsInsight {
  quarter: string;
  keyPoints: string[];
  aiMentions: string[];
  source: string;
}

export interface NewsItem {
  headline: string;
  source: string;
  date: string;
  summary: string;
  relevance: 'high' | 'medium' | 'low';
  aiRelated: boolean;
}

export interface PressItem {
  title: string;
  date: string;
  summary: string;
  aiRelated: boolean;
}

export interface LeadershipInsight {
  executiveName: string;
  title: string;
  quote?: string;
  context: string;
  source: string;
  date: string;
  topic: 'ai_strategy' | 'digital_transformation' | 'technology' | 'business_strategy' | 'other';
}

export interface StrategicInitiative {
  name: string;
  description: string;
  aiRelevance: string;
  status: 'announced' | 'in_progress' | 'completed' | 'unknown';
  source: string;
}

export interface AIMention {
  context: string;           // Where AI was mentioned (earnings call, press release, etc.)
  quote: string;
  sentiment: 'positive' | 'neutral' | 'cautious' | 'negative';
  date: string;
  source: string;
}

export interface AIInvestment {
  description: string;
  amount?: string;
  date: string;
  category: 'partnership' | 'acquisition' | 'internal_build' | 'vendor' | 'hiring';
  source: string;
}

export interface CompetitorActivity {
  competitorName: string;
  activity: string;
  implication: string;
  date: string;
  source: string;
}

export interface IndustryTrend {
  trend: string;
  relevance: string;
  timeframe: string;
  source: string;
}

export interface RegulatoryItem {
  regulation: string;
  jurisdiction: string;
  impact: string;
  effectiveDate?: string;
  source: string;
}

// Research job tracking
export interface ResearchJob {
  sessionId: string;
  companyName: string;
  status: 'queued' | 'researching' | 'synthesizing' | 'complete' | 'failed';
  startedAt: string;
  completedAt?: string;
  profile?: CompanyResearchProfile;
  error?: string;
  progress: {
    financials: boolean;
    news: boolean;
    leadership: boolean;
    aiIntelligence: boolean;
    industry: boolean;
    synthesis: boolean;
  };
}
