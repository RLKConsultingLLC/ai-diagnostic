// =============================================================================
// RLK AI Diagnostic — Claude Research Synthesis Engine
// =============================================================================
// Takes raw research data and uses Claude to synthesize it into a structured
// CompanyResearchProfile. This is what makes the report feel like a $50K
// consulting engagement — deep, specific, company-aware intelligence.
// =============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { CompanyProfile } from '@/types/diagnostic';
import {
  CompanyResearchProfile,
  AIMention,
  AIInvestment,
  CompetitorActivity,
  EarningsInsight,
  IndustryTrend,
  LeadershipInsight,
  NewsItem,
  RegulatoryItem,
  StrategicInitiative,
  VendorAnalysis,
} from '@/types/research';
import { RawNewsResult, SECFiling } from './sources';

const client = new Anthropic();

// ---------------------------------------------------------------------------
// RESEARCH CONFIDENCE — Quality-weighted instead of count-based
// ---------------------------------------------------------------------------

function computeResearchConfidence(
  rawData: {
    secFilings: SECFiling[];
    companyNews: RawNewsResult[];
    aiNews: RawNewsResult[];
    industryNews: RawNewsResult[];
    webContent: { aboutText: string; newsroomItems: string[]; aiReferences: string[] };
  },
  synthesized: {
    newsItems: NewsItem[];
    aiMentions: AIMention[];
    aiInvestments: AIInvestment[];
    leadershipInsights: LeadershipInsight[];
    earnings: EarningsInsight[];
  }
): 'high' | 'moderate' | 'low' {
  let score = 0;

  // SEC filings (+30) — strongest credibility signal
  if (rawData.secFilings.length > 0) score += 30;

  // AI-specific news coverage (+20)
  if (rawData.aiNews.length >= 3) score += 20;
  else if (rawData.aiNews.length >= 1) score += 10;

  // Recency (+15) — recent news within last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recentNews = synthesized.newsItems.filter((n) => {
    try { return new Date(n.date) >= sixMonthsAgo; } catch { return false; }
  });
  if (recentNews.length >= 3) score += 15;
  else if (recentNews.length >= 1) score += 8;

  // Leadership quotes (+10) — direct executive signals
  if (synthesized.leadershipInsights.length >= 2) score += 10;
  else if (synthesized.leadershipInsights.length >= 1) score += 5;

  // Company web content (+10) — direct company data
  const hasWebContent =
    rawData.webContent.aboutText.length > 100 ||
    rawData.webContent.newsroomItems.length > 0 ||
    rawData.webContent.aiReferences.length > 0;
  if (hasWebContent) score += 10;

  // Source diversity (+10) — multiple source types
  const sourceTypes = [
    rawData.secFilings.length > 0,
    rawData.companyNews.length > 0,
    rawData.aiNews.length > 0,
    rawData.industryNews.length > 0,
    hasWebContent,
  ].filter(Boolean).length;
  if (sourceTypes >= 4) score += 10;
  else if (sourceTypes >= 3) score += 5;

  // Thresholds
  if (score >= 60) return 'high';
  if (score >= 30) return 'moderate';
  return 'low';
}

// ---------------------------------------------------------------------------
// MAIN SYNTHESIS — Orchestrates Claude to build the full research profile
// ---------------------------------------------------------------------------

export async function synthesizeResearchProfile(
  companyProfile: CompanyProfile,
  rawData: {
    secFilings: SECFiling[];
    companyNews: RawNewsResult[];
    aiNews: RawNewsResult[];
    industryNews: RawNewsResult[];
    webContent: { aboutText: string; newsroomItems: string[]; aiReferences: string[] };
  }
): Promise<CompanyResearchProfile> {
  // Run synthesis tasks in parallel for speed
  const [
    newsAnalysis,
    aiIntelligence,
    strategicAnalysis,
    industryContext,
    vendorAnalysis,
  ] = await Promise.all([
    synthesizeNews(companyProfile, rawData.companyNews),
    synthesizeAIIntelligence(companyProfile, rawData.aiNews, rawData.webContent),
    synthesizeStrategicIntel(companyProfile, rawData.secFilings, rawData.companyNews),
    synthesizeIndustryContext(companyProfile, rawData.industryNews),
    synthesizeVendorAnalysis(companyProfile, rawData.aiNews, rawData.industryNews),
  ]);

  // Final synthesis: executive briefing that ties everything together
  const executiveSynthesis = await synthesizeExecutiveBriefing(
    companyProfile,
    newsAnalysis,
    aiIntelligence,
    strategicAnalysis,
    industryContext
  );

  const sourcesConsulted =
    rawData.secFilings.length +
    rawData.companyNews.length +
    rawData.aiNews.length +
    rawData.industryNews.length +
    rawData.webContent.newsroomItems.length;

  return {
    companyName: companyProfile.companyName,
    industry: companyProfile.industry,
    recentNews: newsAnalysis.newsItems,
    pressReleases: newsAnalysis.pressItems,
    leadershipInsights: strategicAnalysis.leadershipInsights,
    strategicInitiatives: strategicAnalysis.initiatives,
    aiMentions: aiIntelligence.mentions,
    aiInvestments: aiIntelligence.investments,
    competitorAIActivity: aiIntelligence.competitorActivity,
    industryTrends: industryContext.trends,
    regulatoryDevelopments: industryContext.regulatory,
    recentEarnings: strategicAnalysis.earnings,
    vendorAnalysis,
    executiveBriefing: executiveSynthesis.briefing,
    aiPostureAssessment: executiveSynthesis.aiPosture,
    competitivePositionNote: executiveSynthesis.competitivePosition,
    riskFactors: executiveSynthesis.risks,
    opportunities: executiveSynthesis.opportunities,
    researchCompletedAt: new Date().toISOString(),
    sourcesConsulted,
    confidenceLevel: computeResearchConfidence(rawData, {
      newsItems: newsAnalysis.newsItems,
      aiMentions: aiIntelligence.mentions,
      aiInvestments: aiIntelligence.investments,
      leadershipInsights: strategicAnalysis.leadershipInsights,
      earnings: strategicAnalysis.earnings,
    }),
  };
}

// ---------------------------------------------------------------------------
// NEWS SYNTHESIS
// ---------------------------------------------------------------------------

async function synthesizeNews(
  profile: CompanyProfile,
  news: RawNewsResult[]
): Promise<{ newsItems: NewsItem[]; pressItems: { title: string; date: string; summary: string; aiRelated: boolean }[] }> {
  if (news.length === 0) {
    return { newsItems: [], pressItems: [] };
  }

  const newsText = news
    .map((n, i) => `[${i + 1}] "${n.title}" — ${n.source} (${n.publishedAt})\n${n.description}`)
    .join('\n\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: 'You are a senior research analyst at a management consulting firm. Analyze news articles and extract structured intelligence. Respond ONLY with valid JSON.',
    messages: [
      {
        role: 'user',
        content: `Analyze these news articles about ${profile.companyName} in the ${profile.industry} industry.

For each article, determine:
1. Is it actually about this company (not a different company with a similar name)?
2. What is its relevance to AI strategy, digital transformation, or organizational capability?
3. Is it a press release or editorial news?

NEWS ARTICLES:
${newsText}

Respond with this exact JSON structure:
{
  "newsItems": [
    {
      "headline": "string",
      "source": "string",
      "date": "string",
      "summary": "one-sentence summary of strategic relevance",
      "relevance": "high" | "medium" | "low",
      "aiRelated": true/false
    }
  ],
  "pressReleases": [
    {
      "title": "string",
      "date": "string",
      "summary": "string",
      "aiRelated": true/false
    }
  ]
}

Only include articles that are actually about ${profile.companyName}. Filter out irrelevant results.`,
      },
    ],
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { newsItems: [], pressItems: [] };
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      newsItems: parsed.newsItems || [],
      pressItems: parsed.pressReleases || [],
    };
  } catch {
    return { newsItems: [], pressItems: [] };
  }
}

// ---------------------------------------------------------------------------
// AI INTELLIGENCE SYNTHESIS
// ---------------------------------------------------------------------------

async function synthesizeAIIntelligence(
  profile: CompanyProfile,
  aiNews: RawNewsResult[],
  webContent: { aboutText: string; newsroomItems: string[]; aiReferences: string[] }
): Promise<{
  mentions: AIMention[];
  investments: AIInvestment[];
  competitorActivity: CompetitorActivity[];
}> {
  const aiNewsText = aiNews
    .map((n, i) => `[${i + 1}] "${n.title}" — ${n.source} (${n.publishedAt})\n${n.description}`)
    .join('\n\n');

  const webText = [
    ...webContent.newsroomItems.map((item) => `NEWSROOM: ${item}`),
    ...webContent.aiReferences.map((ref) => `AI REFERENCE: ${ref}`),
  ].join('\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: 'You are a senior AI strategy analyst at a top-tier consulting firm. Extract AI-specific intelligence from company data. Respond ONLY with valid JSON.',
    messages: [
      {
        role: 'user',
        content: `Analyze AI-related intelligence for ${profile.companyName} (${profile.industry} industry, ~${profile.employeeCount} employees).

AI-RELATED NEWS:
${aiNewsText || 'No AI-specific news found.'}

WEB INTELLIGENCE:
${webText || 'No web content found.'}

Extract and synthesize into this JSON structure:
{
  "mentions": [
    {
      "context": "where AI was mentioned (e.g., earnings call, press release)",
      "quote": "relevant quote or paraphrase",
      "sentiment": "positive" | "neutral" | "cautious" | "negative",
      "date": "YYYY-MM-DD if available",
      "source": "source name"
    }
  ],
  "investments": [
    {
      "description": "what was invested in",
      "amount": "dollar amount if known, else null",
      "date": "YYYY-MM-DD if available",
      "category": "partnership" | "acquisition" | "internal_build" | "vendor" | "hiring",
      "source": "source name"
    }
  ],
  "competitorActivity": [
    {
      "competitorName": "competitor name",
      "activity": "what they did with AI",
      "implication": "what this means for ${profile.companyName}",
      "date": "YYYY-MM-DD if available",
      "source": "source name"
    }
  ]
}

If information is sparse, return empty arrays rather than fabricating competitor data. Only include competitor activities that are directly supported by the news and web content provided above.`,
      },
    ],
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { mentions: [], investments: [], competitorActivity: [] };
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      mentions: parsed.mentions || [],
      investments: parsed.investments || [],
      competitorActivity: parsed.competitorActivity || [],
    };
  } catch {
    return { mentions: [], investments: [], competitorActivity: [] };
  }
}

// ---------------------------------------------------------------------------
// STRATEGIC INTEL SYNTHESIS
// ---------------------------------------------------------------------------

async function synthesizeStrategicIntel(
  profile: CompanyProfile,
  _filings: SECFiling[],
  news: RawNewsResult[]
): Promise<{
  leadershipInsights: LeadershipInsight[];
  initiatives: StrategicInitiative[];
  earnings: EarningsInsight[];
}> {
  const newsText = news
    .slice(0, 15)
    .map((n, i) => `[${i + 1}] "${n.title}" — ${n.source} (${n.publishedAt})\n${n.description}`)
    .join('\n\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: 'You are a senior strategy consultant. Extract leadership, strategic, and earnings intelligence. Respond ONLY with valid JSON.',
    messages: [
      {
        role: 'user',
        content: `Extract strategic intelligence for ${profile.companyName} (${profile.industry}, ${profile.publicOrPrivate}, ~$${(profile.revenue / 1e6).toFixed(0)}M revenue, ~${profile.employeeCount} employees).

AVAILABLE DATA:
${newsText || 'Limited public information available.'}

Extract into this JSON:
{
  "leadershipInsights": [
    {
      "executiveName": "name",
      "title": "C-suite title",
      "quote": "relevant quote if available",
      "context": "what they said/did and why it matters for AI strategy",
      "source": "source",
      "date": "YYYY-MM-DD",
      "topic": "ai_strategy" | "digital_transformation" | "technology" | "business_strategy" | "other"
    }
  ],
  "initiatives": [
    {
      "name": "initiative name",
      "description": "what it is",
      "aiRelevance": "how this relates to AI capability",
      "status": "announced" | "in_progress" | "completed" | "unknown",
      "source": "source"
    }
  ],
  "earnings": [
    {
      "quarter": "Q1 2024",
      "keyPoints": ["point 1", "point 2"],
      "aiMentions": ["any AI-related mentions from earnings"],
      "source": "earnings call/report"
    }
  ]
}

For private companies where earnings data isn't available, focus on leadership insights and strategic initiatives. Use your knowledge of the industry to provide relevant context even if direct data is limited. Include at least 2-3 items per category.`,
      },
    ],
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { leadershipInsights: [], initiatives: [], earnings: [] };
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      leadershipInsights: parsed.leadershipInsights || [],
      initiatives: parsed.initiatives || [],
      earnings: parsed.earnings || [],
    };
  } catch {
    return { leadershipInsights: [], initiatives: [], earnings: [] };
  }
}

// ---------------------------------------------------------------------------
// INDUSTRY CONTEXT SYNTHESIS
// ---------------------------------------------------------------------------

async function synthesizeIndustryContext(
  profile: CompanyProfile,
  industryNews: RawNewsResult[]
): Promise<{
  trends: IndustryTrend[];
  regulatory: RegulatoryItem[];
}> {
  const newsText = industryNews
    .slice(0, 10)
    .map((n, i) => `[${i + 1}] "${n.title}" — ${n.source} (${n.publishedAt})\n${n.description}`)
    .join('\n\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: 'You are a senior industry analyst specializing in AI adoption across enterprise sectors. Respond ONLY with valid JSON.',
    messages: [
      {
        role: 'user',
        content: `Analyze industry context for a ${profile.industry} company with ${profile.regulatoryIntensity} regulatory intensity.

RECENT INDUSTRY NEWS:
${newsText || 'No industry-specific news available.'}

Provide industry AI trends and regulatory developments. Use your extensive knowledge of this industry to supplement the news data.

JSON structure:
{
  "trends": [
    {
      "trend": "trend name/description",
      "relevance": "why this matters for ${profile.companyName}",
      "timeframe": "current" | "next 6 months" | "next 12 months" | "2+ years",
      "source": "industry analysis / specific source"
    }
  ],
  "regulatory": [
    {
      "regulation": "regulation name/description",
      "jurisdiction": "US/EU/State/Industry body",
      "impact": "how this affects AI deployment in ${profile.industry}",
      "effectiveDate": "date if known",
      "source": "regulatory body / news source"
    }
  ]
}

Include at least 3-4 trends and 2-3 regulatory items. Be specific to ${profile.industry}.`,
      },
    ],
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { trends: [], regulatory: [] };
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      trends: parsed.trends || [],
      regulatory: parsed.regulatory || [],
    };
  } catch {
    return { trends: [], regulatory: [] };
  }
}

// ---------------------------------------------------------------------------
// VENDOR ANALYSIS SYNTHESIS
// ---------------------------------------------------------------------------

async function synthesizeVendorAnalysis(
  profile: CompanyProfile,
  aiNews: RawNewsResult[],
  industryNews: RawNewsResult[]
): Promise<VendorAnalysis> {
  const vendorNewsText = [...aiNews, ...industryNews]
    .filter((n) => {
      const lower = (n.title + ' ' + n.description).toLowerCase();
      return (
        lower.includes('vendor') ||
        lower.includes('partner') ||
        lower.includes('platform') ||
        lower.includes('deploy') ||
        lower.includes('openai') ||
        lower.includes('microsoft') ||
        lower.includes('google') ||
        lower.includes('aws') ||
        lower.includes('salesforce') ||
        lower.includes('ibm') ||
        lower.includes('automation') ||
        lower.includes('copilot') ||
        lower.includes('genai') ||
        lower.includes('gen ai') ||
        lower.includes('llm')
      );
    })
    .slice(0, 15)
    .map((n, i) => `[${i + 1}] "${n.title}" — ${n.source} (${n.publishedAt})\n${n.description}`)
    .join('\n\n');

  const useCases = profile.primaryAIUseCases?.length
    ? profile.primaryAIUseCases.join(', ')
    : 'general enterprise AI';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    system: `You are a senior technology analyst at Gartner or Forrester. Analyze the AI vendor landscape for this company's specific industry and use cases. Be specific about vendor names, capabilities, and limitations. Your analysis should help a CIO evaluate whether their current vendor investments are optimal. Respond ONLY with valid JSON.`,
    messages: [
      {
        role: 'user',
        content: `Analyze the AI vendor landscape for a ${profile.industry} company (~${profile.employeeCount.toLocaleString()} employees, ${profile.publicOrPrivate}) with these primary AI use cases: ${useCases}.

VENDOR-RELATED NEWS & SIGNALS:
${vendorNewsText || 'No vendor-specific news found. Rely on your knowledge of the current vendor landscape.'}

Using the news above plus your knowledge of the AI vendor ecosystem, identify the top 5-8 vendors most relevant to this company's industry and use cases. For each vendor, assess fit, cost, and market position.

Respond with this exact JSON structure:
{
  "vendorsIdentified": [
    {
      "vendorName": "Vendor Name",
      "category": "Enterprise AI Platform" | "LLM Provider" | "RPA/Automation" | "Industry-Specific AI" | "Data & Analytics" | "AI Infrastructure",
      "relevantUseCases": ["which of the company's use cases this vendor serves"],
      "strengths": ["2-3 key strengths"],
      "weaknesses": ["2-3 key weaknesses"],
      "marketPosition": "leader" | "challenger" | "niche" | "emerging",
      "costEfficiency": "premium" | "moderate" | "value",
      "industryFit": "strong" | "moderate" | "weak",
      "verdict": "One sentence: should this company consider this vendor and why?"
    }
  ],
  "marketLandscape": "A 3-4 sentence overview of the current AI vendor landscape as it applies to the ${profile.industry} industry and these use cases (${useCases}). Note key trends like consolidation, pricing pressure, or capability shifts.",
  "recommendations": [
    "3-5 specific vendor strategy recommendations for this company. Be concrete: name vendors, suggest evaluation approaches, flag build-vs-buy decisions."
  ],
  "riskFlags": [
    "2-4 vendor-related risks: lock-in risks, concentration risks, capability gaps in the market, pricing trajectory concerns, or vendor stability issues."
  ]
}

Be specific. Name real vendors. Assess real capabilities. A CIO should be able to hand this to their procurement team.`,
      },
    ],
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { vendorsIdentified: [], marketLandscape: '', recommendations: [], riskFlags: [] };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      vendorsIdentified: parsed.vendorsIdentified || [],
      marketLandscape: parsed.marketLandscape || '',
      recommendations: parsed.recommendations || [],
      riskFlags: parsed.riskFlags || [],
    };
  } catch {
    return { vendorsIdentified: [], marketLandscape: '', recommendations: [], riskFlags: [] };
  }
}

// ---------------------------------------------------------------------------
// EXECUTIVE BRIEFING — Final synthesis that ties everything together
// ---------------------------------------------------------------------------

async function synthesizeExecutiveBriefing(
  profile: CompanyProfile,
  newsAnalysis: { newsItems: NewsItem[]; pressItems: { title: string; date: string; summary: string; aiRelated: boolean }[] },
  aiIntel: { mentions: AIMention[]; investments: AIInvestment[]; competitorActivity: CompetitorActivity[] },
  strategicIntel: { leadershipInsights: LeadershipInsight[]; initiatives: StrategicInitiative[]; earnings: EarningsInsight[] },
  industryContext: { trends: IndustryTrend[]; regulatory: RegulatoryItem[] }
): Promise<{
  briefing: string;
  aiPosture: string;
  competitivePosition: string;
  risks: string[];
  opportunities: string[];
}> {
  const contextBlock = `
COMPANY: ${profile.companyName}
INDUSTRY: ${profile.industry}
TYPE: ${profile.publicOrPrivate}
REVENUE: ~$${(profile.revenue / 1e6).toFixed(0)}M
EMPLOYEES: ~${profile.employeeCount.toLocaleString()}
REGULATORY INTENSITY: ${profile.regulatoryIntensity}

RECENT NEWS (${newsAnalysis.newsItems.length} items):
${newsAnalysis.newsItems.slice(0, 5).map((n) => `- ${n.headline} [${n.relevance}]`).join('\n')}

AI MENTIONS (${aiIntel.mentions.length} items):
${aiIntel.mentions.slice(0, 5).map((m) => `- ${m.context}: "${m.quote}" [${m.sentiment}]`).join('\n')}

AI INVESTMENTS (${aiIntel.investments.length} items):
${aiIntel.investments.slice(0, 5).map((i) => `- ${i.description} (${i.category})`).join('\n')}

COMPETITOR AI ACTIVITY:
${aiIntel.competitorActivity.slice(0, 5).map((c) => `- ${c.competitorName}: ${c.activity}`).join('\n')}

LEADERSHIP INSIGHTS:
${strategicIntel.leadershipInsights.slice(0, 5).map((l) => `- ${l.executiveName} (${l.title}): ${l.context}`).join('\n')}

STRATEGIC INITIATIVES:
${strategicIntel.initiatives.slice(0, 5).map((i) => `- ${i.name}: ${i.description} [AI relevance: ${i.aiRelevance}]`).join('\n')}

INDUSTRY TRENDS:
${industryContext.trends.slice(0, 4).map((t) => `- ${t.trend} [${t.timeframe}]`).join('\n')}

REGULATORY CONTEXT:
${industryContext.regulatory.slice(0, 3).map((r) => `- ${r.regulation}: ${r.impact}`).join('\n')}
`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: `You are a senior partner at a top-tier management consulting firm preparing an executive briefing for a C-suite client. Your tone is authoritative, specific, and actionable. You never hedge or use filler. Every sentence carries weight. Do not use the word "journey." Do not use generic AI maturity language.`,
    messages: [
      {
        role: 'user',
        content: `Based on the following research intelligence, produce a structured executive briefing for ${profile.companyName}.

${contextBlock}

Respond with this exact JSON structure:
{
  "briefing": "A 2-paragraph executive briefing (150-200 words). Paragraph 1: What public data reveals about this company's AI trajectory. Paragraph 2: The strategic implications and what's at stake. Be specific — reference actual news, initiatives, or leadership signals. This should feel like the opening of a McKinsey engagement deck.",

  "aiPosture": "A 3-4 sentence assessment of this company's public AI posture based on the evidence. What are they saying? What are they doing? Where is the gap between rhetoric and action?",

  "competitivePosition": "A 2-3 sentence assessment of where this company stands vs. their competitors in AI capability based on public signals. Name specific competitors where possible.",

  "risks": ["3-5 specific, company-relevant AI risks derived from the research — not generic risks. Each should reference a specific finding."],

  "opportunities": ["3-5 specific, company-relevant AI opportunities derived from the research. Each should be tied to something specific about this company, its industry, or its competitive position."]
}`,
      },
    ],
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        briefing: 'Research synthesis in progress.',
        aiPosture: '',
        competitivePosition: '',
        risks: [],
        opportunities: [],
      };
    }
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      briefing: 'Research synthesis in progress.',
      aiPosture: '',
      competitivePosition: '',
      risks: [],
      opportunities: [],
    };
  }
}
