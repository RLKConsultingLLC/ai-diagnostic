// =============================================================================
// POST /api/assessment/insight
// =============================================================================
// Returns escalating AI-generated feedback after each dimension is completed.
// Pulls live background research to inject company-specific intelligence
// the user never provided, making insights feel deeply researched.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getResearchProfile, getResearchStatus } from '@/lib/research/engine';

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set.');
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

const MODEL = 'claude-sonnet-4-20250514';

const DIMENSION_LABELS: Record<string, string> = {
  adoption_behavior: 'Adoption Behavior',
  authority_structure: 'Authority Structure',
  workflow_integration: 'Workflow Integration',
  decision_velocity: 'Decision Velocity',
  economic_translation: 'Economic Translation',
};

interface DimensionResponseSet {
  dimension: string;
  averageScore: number;
}

interface InsightRequest {
  dimension: string;
  responses: { questionId: string; score: number }[];
  companyName: string;
  industry: string;
  employeeCount?: number;
  revenue?: number;
  sessionId?: string;
  completedDimensions?: DimensionResponseSet[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as InsightRequest;
    const {
      dimension, responses, companyName, industry,
      employeeCount, revenue, sessionId, completedDimensions,
    } = body;

    if (!dimension || !DIMENSION_LABELS[dimension]) {
      return NextResponse.json(
        { error: `Invalid dimension.` },
        { status: 400 }
      );
    }
    if (!Array.isArray(responses) || responses.length === 0) {
      return NextResponse.json({ error: 'responses required' }, { status: 400 });
    }
    if (!companyName || !industry) {
      return NextResponse.json({ error: 'companyName and industry required' }, { status: 400 });
    }

    const totalScore = responses.reduce((sum, r) => sum + r.score, 0);
    const dimensionScore = Math.round((totalScore / responses.length) * 100) / 100;
    const completedCount = (completedDimensions?.length ?? 0) + 1;
    const dimensionLabel = DIMENSION_LABELS[dimension];

    // -----------------------------------------------------------------------
    // PULL LIVE RESEARCH (this is what makes the user go "wow")
    // -----------------------------------------------------------------------
    let researchBlock = '';
    let researchDataPoints: string[] = [];

    if (sessionId) {
      try {
        const profile = await getResearchProfile(sessionId);
        const status = await getResearchStatus(sessionId);

        if (profile) {
          researchDataPoints = buildResearchDataPoints(profile, dimension, completedCount);
          if (researchDataPoints.length > 0) {
            researchBlock = '\n\nCOMPANY INTELLIGENCE (from public sources, NOT provided by the user):\n' +
              researchDataPoints.map(p => `- ${p}`).join('\n') +
              '\n\nCRITICAL: Reference at least 1-2 of these findings by name in your insight. ' +
              'The user did NOT provide this information. When you reference it, they will realize ' +
              'the analysis goes far beyond their survey answers. This is what makes the diagnostic worth paying for.';
          }
        } else if (status && status.status === 'researching') {
          // Research still in progress. Use what we can from partial data.
          researchBlock = '\n\n[Background research on this company is still in progress. ' +
            'Use your knowledge of the ' + industry + ' industry to reference specific ' +
            'companies, regulatory frameworks, or market dynamics by name.]';
        }
      } catch {
        // Research not available, continue without it
      }
    }

    // If no research available at all, still inject industry-specific intelligence
    if (!researchBlock) {
      researchBlock = buildIndustryIntelligenceBlock(industry, companyName, dimension, completedCount);
    }

    // Build cumulative context
    let priorContext = '';
    if (completedDimensions && completedDimensions.length > 0) {
      priorContext = '\n\nPREVIOUS DIMENSIONS:\n' +
        completedDimensions.map(d =>
          `- ${DIMENSION_LABELS[d.dimension]}: ${d.averageScore.toFixed(1)}/5`
        ).join('\n');
    }

    const scoreContext = dimensionScore <= 1.5 ? 'critical gap'
      : dimensionScore <= 2.5 ? 'structural friction'
      : dimensionScore <= 3.5 ? 'emerging capability with constraints'
      : dimensionScore <= 4.5 ? 'strong foundation'
      : 'advanced capability';

    const sizeContext = employeeCount ? `\nEmployees: ~${employeeCount.toLocaleString()}` : '';
    const revenueContext = revenue ? `\nRevenue: ~$${(revenue / 1e6).toFixed(0)}M` : '';

    // -----------------------------------------------------------------------
    // ESCALATING PROMPT LAYERS
    // -----------------------------------------------------------------------
    const layer = getLayerPrompt(completedCount, researchDataPoints.length > 0);

    const userPrompt =
      `Company: ${companyName}\nIndustry: ${industry}` +
      sizeContext + revenueContext +
      `\n\nDimension: ${dimensionLabel}\nScore: ${scoreContext} (${dimensionScore}/5 avg, ${responses.length} questions)` +
      priorContext +
      researchBlock +
      `\n\n${layer.format}`;

    const client = getClient();
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: layer.maxTokens,
      system: layer.system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const insight = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n\n');

    if (!insight) {
      throw new Error(`Empty response for dimension "${dimension}".`);
    }

    const reportPreview = buildReportPreview(completedCount, companyName);

    return NextResponse.json({
      insight,
      dimensionScore,
      layer: completedCount,
      reportPreview,
      researchEnriched: researchDataPoints.length > 0,
    });
  } catch (err: unknown) {
    console.error('[POST /api/assessment/insight]', err);
    return NextResponse.json(
      { error: 'Failed to generate dimension insight' },
      { status: 500 }
    );
  }
}

// =============================================================================
// RESEARCH DATA EXTRACTION
// =============================================================================
// Pulls the most relevant findings from background research for each dimension

function buildResearchDataPoints(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any,
  dimension: string,
  layer: number
): string[] {
  const points: string[] = [];

  // Always include the executive briefing summary if available
  if (profile.aiPostureAssessment && layer >= 2) {
    points.push(`Public AI posture: ${profile.aiPostureAssessment.slice(0, 200)}`);
  }

  // Dimension-specific research injection
  if (dimension === 'adoption_behavior' || layer >= 3) {
    if (profile.aiMentions?.length > 0) {
      const mention = profile.aiMentions[0];
      points.push(`AI mention from ${mention.source || 'public record'}: "${(mention.quote || mention.context || '').slice(0, 150)}"`);
    }
    if (profile.strategicInitiatives?.length > 0) {
      const init = profile.strategicInitiatives[0];
      points.push(`Strategic initiative: ${init.name} (${init.status || 'announced'}). AI relevance: ${(init.aiRelevance || '').slice(0, 100)}`);
    }
  }

  if (dimension === 'authority_structure' || layer >= 3) {
    if (profile.leadershipInsights?.length > 0) {
      const leader = profile.leadershipInsights[0];
      points.push(`Leadership signal: ${leader.executiveName} (${leader.title}): ${(leader.context || '').slice(0, 150)}`);
    }
    if (profile.regulatoryDevelopments?.length > 0) {
      const reg = profile.regulatoryDevelopments[0];
      points.push(`Regulatory factor: ${reg.regulation} (${reg.jurisdiction}). Impact: ${(reg.impact || '').slice(0, 120)}`);
    }
  }

  if (dimension === 'workflow_integration' || layer >= 3) {
    if (profile.aiInvestments?.length > 0) {
      const inv = profile.aiInvestments[0];
      points.push(`AI investment: ${inv.description} (${inv.category}${inv.amount ? ', ' + inv.amount : ''})`);
    }
    if (profile.vendorAnalysis?.vendorsIdentified?.length > 0) {
      const vendor = profile.vendorAnalysis.vendorsIdentified[0];
      points.push(`Key vendor in their stack: ${vendor.vendorName} (${vendor.category}, market position: ${vendor.marketPosition}). Verdict: ${(vendor.verdict || '').slice(0, 120)}`);
    }
  }

  if (dimension === 'decision_velocity' || layer >= 4) {
    if (profile.competitorAIActivity?.length > 0) {
      const comp = profile.competitorAIActivity[0];
      points.push(`Competitor move: ${comp.competitorName} ${(comp.activity || '').slice(0, 120)}. Implication: ${(comp.implication || '').slice(0, 100)}`);
    }
    if (profile.industryTrends?.length > 0) {
      const trend = profile.industryTrends[0];
      points.push(`Industry trend (${trend.timeframe || 'current'}): ${(trend.trend || '').slice(0, 150)}`);
    }
  }

  if (dimension === 'economic_translation' || layer >= 5) {
    if (profile.competitivePositionNote) {
      points.push(`Competitive position: ${profile.competitivePositionNote.slice(0, 200)}`);
    }
    if (profile.opportunities?.length > 0) {
      points.push(`Identified opportunity: ${profile.opportunities[0].slice(0, 150)}`);
    }
    if (profile.riskFactors?.length > 0) {
      points.push(`Risk factor: ${profile.riskFactors[0].slice(0, 150)}`);
    }
    if (profile.vendorAnalysis?.recommendations?.length > 0) {
      points.push(`Vendor recommendation: ${profile.vendorAnalysis.recommendations[0].slice(0, 150)}`);
    }
  }

  // Add recent news if available (always compelling)
  if (profile.recentNews?.length > 0 && layer >= 2) {
    const news = profile.recentNews.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (n: any) => n.aiRelated || n.relevance === 'high'
    ) || profile.recentNews[0];
    if (news) {
      points.push(`Recent news: "${(news.headline || '').slice(0, 120)}" (${news.source}, ${news.date})`);
    }
  }

  return points.slice(0, 6); // Cap at 6 data points per layer
}

// =============================================================================
// INDUSTRY INTELLIGENCE FALLBACK
// =============================================================================
// When no research data is available yet, inject industry-specific knowledge

function buildIndustryIntelligenceBlock(
  industry: string,
  _companyName: string,
  dimension: string,
  layer: number
): string {
  if (layer <= 1) return ''; // First layer is pure behavioral analysis

  const industryIntel: Record<string, Record<string, string>> = {
    financial_services: {
      adoption_behavior: 'In financial services, the dominant adoption pattern is "compliant caution": employees adopt AI for personal productivity (drafting, research) but avoid using it for client-facing or regulated tasks without explicit permission. JPMorgan, Goldman Sachs, and Morgan Stanley have each taken different approaches to sanctioned AI usage.',
      authority_structure: 'Financial services firms face unique authority challenges because AI governance intersects with existing risk management, compliance, and model risk frameworks (SR 11-7). The most common bottleneck is the Chief Risk Officer having veto power over AI deployments that could affect regulatory standing.',
      workflow_integration: 'Integration in financial services is constrained by legacy core banking and policy administration systems. Firms like Fidelity and BlackRock have invested heavily in data infrastructure that enables AI integration; firms still running on COBOL mainframes face structural integration barriers.',
      decision_velocity: 'Decision velocity in financial services is shaped by the regulatory approval cycle. Firms subject to NYDFS, OCC, or Fed oversight face 3 to 6 month approval timelines for AI that touches customer data or financial decisions. The gap between regulated and unregulated AI use cases is where velocity diverges most.',
      economic_translation: 'The economic translation challenge in financial services is that the largest AI value (credit risk modeling, fraud detection, personalization) sits in highly regulated domains where measurement is complex. Meanwhile, easy-to-measure back-office automation captures a fraction of the total available value.',
    },
    insurance: {
      adoption_behavior: 'Insurance adoption is concentrated in claims and underwriting, where AI has the clearest ROI. However, adoption outside these functions remains low. Progressive, Lemonade, and USAA represent the industry frontier; most carriers lag significantly.',
      authority_structure: 'Insurance authority structures are complicated by the actuarial function, which has its own governance tradition. AI initiatives that touch pricing or reserving require actuarial sign-off in addition to IT and business approval, adding a unique approval layer.',
      workflow_integration: 'The integration challenge in insurance is the policy administration system (PAS). Most carriers run on systems that are 15 to 30 years old. AI sits on top of, not inside, the core workflow. Guidewire and Duck Creek are the dominant platforms, and their AI integration capabilities vary significantly.',
      decision_velocity: 'InsurTech competitors (Root, Hippo, Lemonade) make decisions at software company speed. Traditional carriers take 6 to 18 months to approve what InsurTechs deploy in weeks. This velocity gap is the primary competitive threat.',
      economic_translation: 'Insurance has a unique economic translation advantage: combined ratio improvement from AI in claims and underwriting is directly measurable. The challenge is attributing improvement to AI versus market conditions, pricing changes, or mix shifts.',
    },
    healthcare: {
      adoption_behavior: 'Healthcare AI adoption is bifurcated: clinical AI (diagnostic support, imaging) requires FDA clearance and clinical validation, while operational AI (scheduling, revenue cycle, documentation) faces lower barriers. Most health systems have active AI in operations but limited clinical deployment.',
      authority_structure: 'Healthcare authority structures must navigate HIPAA, institutional review boards, and clinical governance committees. The CMIO (Chief Medical Informatics Officer) is a critical role that many systems still lack.',
      workflow_integration: 'EHR systems (Epic, Cerner/Oracle Health) are the integration bottleneck. Epic Aero and Oracle Health AI features are expanding, but most health systems have significant technical debt preventing deep integration.',
      decision_velocity: 'Healthcare decision velocity is constrained by patient safety requirements, IRB review processes, and the need for clinical evidence. The fastest-moving health systems (Mayo Clinic, Cleveland Clinic, Mass General Brigham) have dedicated AI governance that accelerates rather than impedes.',
      economic_translation: 'Healthcare economic translation is complicated by fee-for-service vs. value-based payment models. AI that reduces costs may reduce revenue under fee-for-service. The economic case depends heavily on payer mix and contract structure.',
    },
    technology: {
      adoption_behavior: 'Technology companies face a paradox: employees adopt AI rapidly (often before IT sanctions it), creating shadow AI exposure. The adoption ceiling is high but ungoverned adoption creates data and IP risk.',
      authority_structure: 'Tech companies typically have flatter authority structures that accelerate AI adoption, but many lack formal AI governance. The CTO/VP Engineering often controls AI decisions unilaterally, which works until it intersects with legal, privacy, or product liability.',
      workflow_integration: 'Integration is typically stronger in tech companies because engineering teams build integrations themselves. The challenge is platform fragmentation: multiple teams using different AI tools without shared infrastructure or context.',
      decision_velocity: 'Tech companies are the velocity benchmark other industries measure against. But even tech companies slow down when AI touches customer-facing products (liability, trust, brand risk). The gap between internal AI usage and customer-facing AI deployment is where velocity friction lives.',
      economic_translation: 'Tech companies measure AI value through product metrics (engagement, retention, conversion) and engineering productivity. The challenge is separating AI-driven improvement from other factors in a fast-moving product environment.',
    },
  };

  const fallback: Record<string, string> = {
    adoption_behavior: `In the ${industry} sector, AI adoption patterns are shaped by workforce composition, regulatory constraints, and the availability of industry-specific AI tools. Organizations typically see a "pilot plateau" where 10 to 20% of the workforce experiments but usage does not cross the self-reinforcing threshold.`,
    authority_structure: `Authority structure in ${industry} organizations is typically shaped by regulatory oversight requirements, the maturity of IT governance, and whether a dedicated AI leadership role exists. The most common bottleneck is the gap between executive enthusiasm and middle-management permission structures.`,
    workflow_integration: `Workflow integration in ${industry} is constrained by the age and architecture of core operational systems. Organizations running on modern cloud-native platforms have 3 to 5x the integration velocity of those on legacy systems.`,
    decision_velocity: `Decision velocity in ${industry} is benchmarked against the pace of digital-native competitors. The gap between regulated and unregulated decision domains is typically where the most significant velocity friction exists.`,
    economic_translation: `Economic translation in ${industry} is complicated by attribution challenges. The most successful organizations have established "AI value offices" that standardize measurement methodology across business units.`,
  };

  const intel = industryIntel[industry]?.[dimension] || fallback[dimension] || fallback['adoption_behavior'];

  return `\n\nINDUSTRY INTELLIGENCE (from our research):\n${intel}\n\n` +
    'Reference specific companies, regulations, or market dynamics from this intelligence in your insight. ' +
    'The user should feel that the analysis draws on knowledge beyond what they provided.';
}

// =============================================================================
// ESCALATING LAYER PROMPTS
// =============================================================================

function getLayerPrompt(
  layer: number,
  hasResearchData: boolean
): { system: string; format: string; maxTokens: number } {
  const researchInstruction = hasResearchData
    ? 'You have access to company intelligence gathered from public sources. Reference specific findings (news, leadership quotes, competitor moves, vendor data) by name. The user did NOT provide this data. When you cite it, they realize the analysis goes far beyond their survey answers. '
    : 'Use your knowledge of the industry to reference specific companies, regulations, or dynamics by name. ';

  const baseRules = 'Never use "journey", "maturity", "suggests that", em dashes, or double dashes. Use commas, periods, or colons instead. ';

  const layers: Record<number, { system: string; format: string; maxTokens: number }> = {
    1: {
      system:
        'You are a senior partner at McKinsey briefing a CIO. ' +
        'Say something the CIO does NOT already know. Do not summarize scores. ' +
        'Identify the structural implication: what organizational dynamic is their score a symptom of? ' +
        researchInstruction +
        'Write exactly 3 sentences. Sentence 1: the non-obvious structural finding. ' +
        'Sentence 2: a specific external reference (competitor, regulation, industry trend) that contextualizes the finding. ' +
        'Sentence 3: what this means for their AI value capture. ' +
        baseRules + 'Tone: direct, peer-level.',
      format: 'Deliver a 3-sentence structural insight with an external reference the user did not provide.',
      maxTokens: 350,
    },
    2: {
      system:
        'You are a senior partner presenting an emerging cross-dimensional pattern to a CIO. ' +
        researchInstruction +
        'Write 4 sentences. Sentence 1: the cross-dimensional pattern forming between these two dimensions. ' +
        'Sentence 2: reference a specific company, competitor, or regulatory development that makes this pattern urgent. ' +
        'Sentence 3: the organizational consequence of this pattern if unaddressed. ' +
        'Sentence 4: what the remaining dimensions will reveal about whether the organization can overcome it. ' +
        baseRules + 'Tone: increasingly authoritative, like someone assembling a diagnosis in real time.',
      format: 'Deliver a 4-sentence cross-dimensional insight with specific external intelligence.',
      maxTokens: 450,
    },
    3: {
      system:
        'You are a senior partner and the diagnosis is crystallizing. Three of five dimensions complete. ' +
        researchInstruction +
        'Write 5 sentences. Sentence 1: name the dominant structural pattern across all three dimensions. ' +
        'Sentence 2: reference specific competitive intelligence (name a competitor and what they are doing differently). ' +
        'Sentence 3: provide a preliminary economic signal with a specific dollar range or percentage. ' +
        'Sentence 4: identify the single organizational lever that would shift the pattern. ' +
        'Sentence 5: state what the final two dimensions will clarify about whether transformation is possible. ' +
        baseRules + 'Tone: the confidence of someone who has seen this exact pattern across hundreds of organizations.',
      format: 'Deliver a 5-sentence crystallizing diagnosis with competitive intelligence and economic signal.',
      maxTokens: 550,
    },
    4: {
      system:
        'You are a senior partner with four of five dimensions complete. The picture is nearly whole. ' +
        researchInstruction +
        'Write 6 sentences. Sentence 1: state the organization\'s structural AI posture clearly. ' +
        'Sentence 2: identify the single biggest bottleneck across all four dimensions. ' +
        'Sentence 3: reference specific competitive threats by name (companies or market dynamics). ' +
        'Sentence 4: provide a specific economic estimate of unrealized value. ' +
        'Sentence 5: name a specific vendor, technology, or regulatory development that is relevant to their situation. ' +
        'Sentence 6: frame what the final dimension (Economic Translation) will determine. ' +
        baseRules + 'Tone: the gravity of a partner about to present findings to the board.',
      format: 'Deliver a 6-sentence preliminary diagnosis with named competitors, vendors, and economic estimates.',
      maxTokens: 650,
    },
    5: {
      system:
        'You are a senior partner delivering the final synthesis. All five dimensions complete. ' +
        'This insight must be so specific and consequential that the CIO feels they MUST see the full report. ' +
        researchInstruction +
        'Write 7 sentences. Sentences 1-2: the core structural finding with specific organizational dynamics named. ' +
        'Sentence 3: a specific competitive comparison (name competitors and what they do differently). ' +
        'Sentence 4: a dollar-range estimate of unrealized annual value. ' +
        'Sentence 5: the single highest-leverage intervention your analysis has identified. ' +
        'Sentence 6: reference that the full report includes a vendor landscape assessment, 90-day action plan, ' +
        'and company-specific intelligence from public filings that makes these findings actionable. ' +
        'Sentence 7: close with a direct, confident statement about what will happen if the organization does not act. ' +
        baseRules + 'Tone: the close of a $200K engagement pitch. Make it undeniable.',
      format: 'Deliver a 7-sentence complete synthesis with named intelligence that makes the full report essential.',
      maxTokens: 750,
    },
  };

  return layers[Math.min(layer, 5)] || layers[1];
}

// =============================================================================
// REPORT PREVIEW BUILDER
// =============================================================================

function buildReportPreview(layer: number, companyName: string): {
  unlockedSections: string[];
  nextUnlock: string | null;
  valueTeaser: string;
} {
  const allSections = [
    'AI Posture Diagnosis',
    'Structural Constraints Analysis',
    'Financial Impact Quantification',
    'Competitive Positioning',
    'Security & Governance Risk Assessment',
    'Vendor Landscape Analysis',
    '90-Day Action Plan',
  ];

  const unlockMap: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 5, 5: 7 };
  const unlockedCount = unlockMap[layer] || 1;

  const teasers: Record<number, string> = {
    1: `Your responses are shaping ${companyName}'s diagnostic profile. Background research is enriching the analysis with public intelligence.`,
    2: `Cross-dimensional patterns are emerging. Your report is being enriched with competitive intelligence specific to ${companyName}.`,
    3: `Financial modeling is underway. We are calculating ${companyName}'s unrealized AI value using industry benchmarks and your organizational data.`,
    4: `Competitive positioning and vendor analysis are being compiled. Your report will include intelligence ${companyName}'s competitors are likely not tracking.`,
    5: `All dimensions complete. Your report includes 7 sections of analysis enriched with public filings, news, competitor intelligence, and vendor assessment specific to ${companyName}.`,
  };

  return {
    unlockedSections: allSections.slice(0, unlockedCount),
    nextUnlock: unlockedCount < allSections.length ? allSections[unlockedCount] : null,
    valueTeaser: teasers[layer] || teasers[1],
  };
}
