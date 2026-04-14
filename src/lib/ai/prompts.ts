// =============================================================================
// RLK AI Diagnostic — Prompt Templates for Narrative Generation
// =============================================================================

import type {
  DiagnosticResult,
  CompanyProfile,
  DimensionScore,
  CompositeIndex,
  StageClassification,
  EconomicEstimate,
} from '@/types/diagnostic';
import type { CompanyResearchProfile } from '@/types/research';
import { DIAGNOSTIC_QUESTIONS } from '@/lib/diagnostic/questions';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const SYSTEM_MESSAGE = `You are a senior executive strategy advisor who has spent 20 years counseling Fortune 500 boards on technology transformation. You write with the authority and specificity of a McKinsey senior partner addressing a board of directors. Your analysis is data-driven, your recommendations are concrete, and you never hedge. You speak as a peer to CIOs, CFOs, and CEOs — not as a vendor or consultant seeking approval.

Rules you must follow in every response:
- Do not use the word "journey."
- Do not use generic maturity-model language such as "climbing the maturity curve," "leveling up," or "moving up the ladder."
- Never hedge with "it depends" or "consider exploring." State what to do.
- Use specific numbers from the diagnostic data provided. Do not invent statistics.
- Write in markdown with headers. Do not use bullet-point walls — use short, punchy paragraphs.
- Tone: authoritative, direct, peer-level. No jargon. No filler.
- Never use em dashes or double dashes. Use commas, periods, or colons instead.`;

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatIndustryLabel(industry: string): string {
  const labels: Record<string, string> = {
    insurance: 'Insurance',
    banking: 'Banking',
    capital_markets: 'Capital Markets',
    asset_wealth_management: 'Asset & Wealth Management',
    investment_banking: 'Investment Banking / M&A Advisory',
    private_equity: 'Private Equity',
    venture_capital: 'Venture Capital',
    hedge_funds: 'Hedge Funds',
    healthcare_providers: 'Healthcare Providers',
    healthcare_payers: 'Healthcare Payers',
    healthcare_services: 'Healthcare Services',
    life_sciences_pharma: 'Life Sciences / Pharmaceuticals',
    retail: 'Retail',
    ecommerce_digital: 'E-commerce / Digital Commerce',
    cpg: 'Consumer Packaged Goods (CPG)',
    dtc: 'Direct-to-Consumer (DTC)',
    food_beverage: 'Food & Beverage',
    manufacturing_discrete: 'Manufacturing (Discrete)',
    manufacturing_process: 'Manufacturing (Process / Industrial)',
    automotive: 'Automotive',
    aerospace_defense: 'Aerospace & Defense',
    energy_oil_gas: 'Energy (Oil & Gas)',
    utilities: 'Utilities',
    chemicals_materials: 'Chemicals & Materials',
    industrial_services: 'Industrial Services',
    software_saas: 'Software / SaaS',
    it_services: 'IT Services / Managed Services',
    hardware_electronics: 'Hardware / Electronics',
    transportation: 'Transportation',
    shipping_logistics: 'Shipping & Logistics',
    infrastructure_transport: 'Infrastructure / Transportation Systems',
    construction_engineering: 'Construction & Engineering',
    real_estate_commercial: 'Real Estate (Commercial)',
    real_estate_residential: 'Real Estate (Residential)',
    telecommunications: 'Telecommunications',
    media_entertainment: 'Media & Entertainment',
    government_federal: 'Government (Federal)',
    government_state_local: 'Government (State & Local)',
    defense_contractors: 'Defense / Government Contractors',
    nonprofit_ngo: 'Non-Profit / NGO',
    consulting_services: 'Consulting Services',
    legal_services: 'Legal Services',
    accounting_audit: 'Accounting / Audit',
  };
  return labels[industry] || industry.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function serializeCompanyContext(profile: CompanyProfile): string {
  return `
COMPANY CONTEXT:
- Company: ${profile.companyName}
- Industry: ${formatIndustryLabel(profile.industry)}${profile.subIndustry ? ` (${profile.subIndustry})` : ''}
- Annual Revenue: ${formatCurrency(profile.revenue)}
- Employees: ${profile.employeeCount.toLocaleString()}
- Public/Private: ${profile.publicOrPrivate}
- Regulatory Intensity: ${profile.regulatoryIntensity}
- Primary AI Use Cases: ${profile.primaryAIUseCases?.join(', ') || 'Not specified'}`;
}

function serializeDimensionScores(scores: DimensionScore[]): string {
  const lines = scores.map(
    (s) =>
      `- ${formatDimensionLabel(s.dimension)}: ${s.normalizedScore}/100 (raw ${s.rawScore}/${s.maxPossible})`
  );
  return `DIMENSION SCORES:\n${lines.join('\n')}`;
}

function formatDimensionLabel(dimension: string): string {
  return dimension
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function serializeCompositeIndices(indices: CompositeIndex[]): string {
  const lines = indices.map(
    (i) => `- ${i.name} (${i.slug}): ${i.score}/100 — ${i.interpretation}`
  );
  return `COMPOSITE INDICES:\n${lines.join('\n')}`;
}

function serializeStageClassification(stage: StageClassification): string {
  const dimensionLines = Object.entries(stage.dimensionStages).map(
    ([dim, stageNum]) => `  - ${formatDimensionLabel(dim)}: Stage ${stageNum}`
  );
  return `STAGE CLASSIFICATION:
- Primary Stage: ${stage.primaryStage} — "${stage.stageName}"
- Description: ${stage.stageDescription}
- Confidence: ${(stage.confidence * 100).toFixed(0)}%
- Dimension-Level Stages:
${dimensionLines.join('\n')}
- Mixed-Stage Narrative: ${stage.mixedStageNarrative}`;
}

function serializeEconomicEstimate(econ: EconomicEstimate): string {
  return `ECONOMIC ESTIMATE:
- Productivity Potential: ${econ.productivityPotentialPercent}%
- Current Capture: ${econ.currentCapturePercent}%
- Unrealized Value Range: ${formatCurrency(econ.unrealizedValueLow)} to ${formatCurrency(econ.unrealizedValueHigh)}
- Annual Wasted Hours: ${econ.annualWastedHours.toLocaleString()}
- Cost Per Employee: ${formatCurrency(econ.costPerEmployee)}
- Industry Benchmark: ${econ.industryBenchmark}`;
}

function serializeResponseQuality(result: DiagnosticResult): string {
  const sections: string[] = [];

  if (result.responseQuality) {
    const q = result.responseQuality;
    sections.push(`RESPONSE QUALITY: Grade=${q.qualityGrade.toUpperCase()}`);
    if (q.fastResponseCount > 0) {
      sections.push(`- ${q.fastResponseCount} responses under 3 seconds`);
    }
    if (q.straightLineDetected) {
      sections.push('- Straight-line pattern detected (10+ consecutive identical answers)');
    }
    if (q.qualityGrade === 'suspect' || q.qualityGrade === 'low') {
      sections.push('NOTE: Response quality concerns detected. Weight self-reported data accordingly and rely more heavily on public research data where available.');
    }
  }

  if (result.consistencyFlags && result.consistencyFlags.length > 0) {
    sections.push('\nINTERNAL CONSISTENCY FLAGS:');
    for (const flag of result.consistencyFlags) {
      const label = flag.type === 'contradiction' ? 'CONTRADICTION' : 'UNLIKELY';
      sections.push(`- [${label}/${flag.severity.toUpperCase()}] ${flag.explanation}`);
    }
    sections.push('NOTE: Reference these inconsistencies in your analysis where relevant. Do not ignore them.');
  }

  return sections.join('\n');
}

function buildDiagnosticDataBlock(result: DiagnosticResult, research?: CompanyResearchProfile): string {
  let block = `
${serializeCompanyContext(result.companyProfile)}

OVERALL SCORE: ${result.overallScore}/100

${serializeDimensionScores(result.dimensionScores)}

${serializeCompositeIndices(result.compositeIndices)}

${serializeStageClassification(result.stageClassification)}

${serializeEconomicEstimate(result.economicEstimate)}`;

  const qualityBlock = serializeResponseQuality(result);
  if (qualityBlock) {
    block += `\n\n${qualityBlock}`;
  }

  if (research) {
    block += `\n\n${serializeResearchIntelligence(research)}`;
  }

  return block;
}

// ---------------------------------------------------------------------------
// Research intelligence serialization — makes reports deeply custom
// ---------------------------------------------------------------------------

function serializeResearchIntelligence(research: CompanyResearchProfile): string {
  const sections: string[] = [];

  sections.push('=== COMPANY INTELLIGENCE (from public sources) ===');
  sections.push(`Sources consulted: ${research.sourcesConsulted} | Confidence: ${research.confidenceLevel}`);

  if (research.executiveBriefing) {
    sections.push(`\nEXECUTIVE BRIEFING:\n${research.executiveBriefing}`);
  }

  if (research.aiPostureAssessment) {
    sections.push(`\nPUBLIC AI POSTURE:\n${research.aiPostureAssessment}`);
  }

  if (research.competitivePositionNote) {
    sections.push(`\nCOMPETITIVE POSITION (from public data):\n${research.competitivePositionNote}`);
  }

  if (research.recentNews.length > 0) {
    const newsLines = research.recentNews
      .filter((n) => n.relevance !== 'low')
      .slice(0, 5)
      .map((n) => `- [${n.relevance.toUpperCase()}] ${n.headline} (${n.source}, ${n.date})${n.aiRelated ? ' [AI-RELATED]' : ''}: ${n.summary}`);
    sections.push(`\nRECENT NEWS:\n${newsLines.join('\n')}`);
  }

  if (research.aiMentions.length > 0) {
    const mentionLines = research.aiMentions
      .slice(0, 5)
      .map((m) => `- [${m.sentiment}] ${m.context}: "${m.quote}" (${m.source}, ${m.date})`);
    sections.push(`\nAI MENTIONS IN PUBLIC RECORD:\n${mentionLines.join('\n')}`);
  }

  if (research.aiInvestments.length > 0) {
    const investLines = research.aiInvestments
      .slice(0, 5)
      .map((i) => `- [${i.category}] ${i.description}${i.amount ? ` ($${i.amount})` : ''} (${i.source}, ${i.date})`);
    sections.push(`\nAI INVESTMENTS & PARTNERSHIPS:\n${investLines.join('\n')}`);
  }

  if (research.leadershipInsights.length > 0) {
    const leaderLines = research.leadershipInsights
      .slice(0, 4)
      .map((l) => `- ${l.executiveName} (${l.title}): ${l.context}${l.quote ? `\n  Quote: "${l.quote}"` : ''} (${l.source})`);
    sections.push(`\nLEADERSHIP SIGNALS:\n${leaderLines.join('\n')}`);
  }

  if (research.strategicInitiatives.length > 0) {
    const initLines = research.strategicInitiatives
      .slice(0, 4)
      .map((i) => `- ${i.name} [${i.status}]: ${i.description} (AI relevance: ${i.aiRelevance})`);
    sections.push(`\nSTRATEGIC INITIATIVES:\n${initLines.join('\n')}`);
  }

  if (research.competitorAIActivity.length > 0) {
    const compLines = research.competitorAIActivity
      .slice(0, 4)
      .map((c) => `- ${c.competitorName}: ${c.activity} → Implication: ${c.implication}`);
    sections.push(`\nCOMPETITOR AI ACTIVITY:\n${compLines.join('\n')}`);
  }

  if (research.industryTrends.length > 0) {
    const trendLines = research.industryTrends
      .slice(0, 4)
      .map((t) => `- [${t.timeframe}] ${t.trend}: ${t.relevance}`);
    sections.push(`\nINDUSTRY AI TRENDS:\n${trendLines.join('\n')}`);
  }

  if (research.regulatoryDevelopments.length > 0) {
    const regLines = research.regulatoryDevelopments
      .slice(0, 3)
      .map((r) => `- ${r.regulation} (${r.jurisdiction}): ${r.impact}`);
    sections.push(`\nREGULATORY DEVELOPMENTS:\n${regLines.join('\n')}`);
  }

  if (research.riskFactors.length > 0) {
    sections.push(`\nIDENTIFIED RISK FACTORS:\n${research.riskFactors.map((r) => `- ${r}`).join('\n')}`);
  }

  if (research.opportunities.length > 0) {
    sections.push(`\nIDENTIFIED OPPORTUNITIES:\n${research.opportunities.map((o) => `- ${o}`).join('\n')}`);
  }

  if (research.vendorAnalysis) {
    const va = research.vendorAnalysis;

    if (va.marketLandscape) {
      sections.push(`\nVENDOR LANDSCAPE OVERVIEW:\n${va.marketLandscape}`);
    }

    if (va.vendorsIdentified.length > 0) {
      const vendorLines = va.vendorsIdentified
        .slice(0, 8)
        .map((v) => `- ${v.vendorName} (${v.category}, ${v.marketPosition}): ${v.verdict}`);
      sections.push(`\nVENDOR LANDSCAPE:\n${vendorLines.join('\n')}`);
    }

    if (va.recommendations.length > 0) {
      sections.push(`\nVENDOR STRATEGY RECOMMENDATIONS:\n${va.recommendations.map((r) => `- ${r}`).join('\n')}`);
    }

    if (va.riskFlags.length > 0) {
      sections.push(`\nVENDOR RISK FLAGS:\n${va.riskFlags.map((f) => `- ${f}`).join('\n')}`);
    }
  }

  sections.push('\n=== END COMPANY INTELLIGENCE ===');
  sections.push('IMPORTANT: Use this intelligence to make the report specific to this company. Reference actual news, leadership signals, competitor moves, and industry trends by name. The customer should feel this report could only have been written about THEIR company.');

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// Prompt template: shared shape
// ---------------------------------------------------------------------------

export interface PromptTemplate {
  system: string;
  user: string;
}

// ---------------------------------------------------------------------------
// 1. Executive Summary
// ---------------------------------------------------------------------------

export function executiveSummaryPrompt(result: DiagnosticResult, research?: CompanyResearchProfile): PromptTemplate {
  return {
    system: SYSTEM_MESSAGE,
    user: `Write a 300-word Executive Summary for the board of ${result.companyProfile.companyName}.

This is the opening section of an AI Maturity diagnostic report. It must accomplish three things in exactly this order:
1. State the organization's AI maturity stage and what that means in plain language (one sentence).
2. Deliver the headline financial figure — the unrealized value range (${formatCurrency(result.economicEstimate.unrealizedValueLow)} – ${formatCurrency(result.economicEstimate.unrealizedValueHigh)}) — and frame it as what the board is leaving on the table.
3. Provide a one-sentence diagnosis: the single most important structural reason this organization is underperforming on AI.

Then provide 2-3 short paragraphs of supporting context that connect the overall score to the dimension-level findings.${research ? '\n\nCRITICAL: You have access to company intelligence below. Reference at least one specific finding — a recent news item, leadership signal, or competitor move — to demonstrate that this report is built on real-world intelligence, not just survey data.' : ''}

DIAGNOSTIC DATA:
${buildDiagnosticDataBlock(result, research)}

OUTPUT FORMAT:
- Markdown with a single H2 header: ## Executive Summary
- 300 words maximum. Every sentence must carry weight.
- No bullet points in this section. Flowing paragraphs only.
- End with a single forward-looking sentence that sets up the rest of the report.`,
  };
}

// ---------------------------------------------------------------------------
// 2. AI Posture Diagnosis
// ---------------------------------------------------------------------------

export function aiPostureDiagnosisPrompt(result: DiagnosticResult, research?: CompanyResearchProfile): PromptTemplate {
  return {
    system: SYSTEM_MESSAGE,
    user: `Write the AI Posture Diagnosis section for ${result.companyProfile.companyName}.

This section must analyze each of the five dimensions and explain what the score reveals about actual organizational behavior. For each dimension, address:
- What the score tells us the organization IS doing (current behavior)
- What the score tells us the organization is NOT doing (gap)
- What an organization at Stage ${result.stageClassification.primaryStage + 1 > 5 ? 5 : result.stageClassification.primaryStage + 1} would be doing differently

Pay special attention to dimension-level stage divergence. Where one dimension is significantly ahead or behind the others, call that out explicitly — it reveals structural imbalance.${research ? '\n\nYou have company intelligence from public sources. Where leadership has made public statements about AI, reference them. Where the company has announced AI initiatives, assess whether the diagnostic data supports or contradicts their public narrative.' : ''}

DIAGNOSTIC DATA:
${buildDiagnosticDataBlock(result, research)}

OUTPUT FORMAT:
- Markdown starting with H2: ## AI Posture Diagnosis
- Use H3 subheaders for each dimension (e.g., ### Adoption Behavior)
- 500-700 words total
- Each dimension subsection: 2-3 paragraphs
- Close with a synthesis paragraph that identifies the dominant pattern across all five dimensions
- Use specific scores. Do not round or approximate — use the exact numbers provided.`,
  };
}

// ---------------------------------------------------------------------------
// 3. Structural Constraints
// ---------------------------------------------------------------------------

export function structuralConstraintsPrompt(result: DiagnosticResult, research?: CompanyResearchProfile): PromptTemplate {
  const authorityFriction = result.compositeIndices.find(
    (i) => i.slug === 'authority_friction'
  );
  const authorityScore =
    result.dimensionScores.find((d) => d.dimension === 'authority_structure')
      ?.normalizedScore ?? 0;
  const decisionVelocity = result.compositeIndices.find(
    (i) => i.slug === 'decision_velocity'
  );

  return {
    system: SYSTEM_MESSAGE,
    user: `Write the Structural Constraints section for ${result.companyProfile.companyName}.

This section explains WHY the organization is stuck — not what scores it got, but what organizational structures, governance patterns, and authority dynamics are preventing faster AI adoption.

Focus areas:
1. Authority Friction: The Authority Friction Index is ${authorityFriction?.score ?? 'N/A'}/100 (${authorityFriction?.interpretation ?? 'N/A'}). The Authority Structure dimension score is ${authorityScore}/100. Analyze what this means — who has decision rights over AI initiatives, and how that slows or accelerates adoption.
2. Decision Velocity: The Decision Velocity Index is ${decisionVelocity?.score ?? 'N/A'}/100 (${decisionVelocity?.interpretation ?? 'N/A'}). Translate this into concrete organizational behavior — how many approval layers exist, how fast can a team go from pilot to production.
3. Governance Bottlenecks: Given the regulatory intensity (${result.companyProfile.regulatoryIntensity}), identify whether governance is appropriately sized or creating unnecessary friction.

Do NOT just restate the scores. Explain the organizational dynamics they reveal.

DIAGNOSTIC DATA:
${buildDiagnosticDataBlock(result, research)}

OUTPUT FORMAT:
- Markdown starting with H2: ## Structural Constraints
- Use H3 subheaders for each focus area
- 400-600 words total
- Conclude with a paragraph identifying the single highest-leverage structural change the organization could make.`,
  };
}

// ---------------------------------------------------------------------------
// 4. Financial Impact
// ---------------------------------------------------------------------------

export function financialImpactPrompt(result: DiagnosticResult, research?: CompanyResearchProfile): PromptTemplate {
  const econ = result.economicEstimate;

  return {
    system: SYSTEM_MESSAGE,
    user: `Write the Financial Impact section for ${result.companyProfile.companyName}. This must read as if a CFO wrote it for other CFOs.

The economic model shows:
- This ${formatCurrency(result.companyProfile.revenue)}-revenue organization could unlock ${econ.productivityPotentialPercent}% productivity improvement through AI
- Currently capturing only ${econ.currentCapturePercent}% of that potential
- Unrealized value: ${formatCurrency(econ.unrealizedValueLow)} – ${formatCurrency(econ.unrealizedValueHigh)} annually
- ${econ.annualWastedHours.toLocaleString()} hours/year wasted on tasks AI could automate or augment
- Per-employee cost of AI underperformance: ${formatCurrency(econ.costPerEmployee)}/year
- Industry benchmark context: ${econ.industryBenchmark}

Frame this section around three financial narratives:
1. The Cost of Inaction — what the organization loses each quarter it delays
2. The Capture Gap — the delta between current capture (${econ.currentCapturePercent}%) and what Stage ${Math.min(result.stageClassification.primaryStage + 1, 5)} organizations in ${formatIndustryLabel(result.companyProfile.industry)} typically capture
3. The ROI Frame — position the unrealized value against typical AI investment costs to show the return multiple

Use specific dollar amounts, percentages, and timeframes. No vague "significant savings" language.${research?.financialHighlights ? `\n\nPublic financial data is available. Reference their actual R&D spend, technology budget, or recent financial performance where it strengthens the financial narrative.` : ''}

DIAGNOSTIC DATA:
${buildDiagnosticDataBlock(result, research)}

OUTPUT FORMAT:
- Markdown starting with H2: ## Financial Impact
- Use H3 subheaders for each financial narrative
- 400-600 words total
- Include at least one comparison to the industry benchmark
- End with a single sentence that quantifies the quarterly cost of delay.`,
  };
}

// ---------------------------------------------------------------------------
// 5. P&L Business Case
// ---------------------------------------------------------------------------

export function pnlBusinessCasePrompt(result: DiagnosticResult, research?: CompanyResearchProfile): PromptTemplate {
  const econ = result.economicEstimate;
  const stage = result.stageClassification.primaryStage;
  const revenue = result.companyProfile.revenue;

  const stageFrame = stage >= 4
    ? `This is a HIGH scorer (Stage ${stage}). Frame the narrative around protecting their AI edge. What happens to their P&L if they coast? How quickly do competitors close the gap?`
    : stage === 3
    ? `This is a MID scorer (Stage 3) at the inflection point. The capture rate roughly doubles from Stage 3 to 4 (25% to 55%). Frame around the asymmetric upside of investing vs. the cost of standing still.`
    : `This is a LOW scorer (Stage ${stage}). Frame around urgency and compounding damage. At ${econ.currentCapturePercent}% capture, they are forfeiting ${100 - econ.currentCapturePercent}% of AI-addressable value each year.`;

  return {
    system: SYSTEM_MESSAGE,
    user: `Write the P&L Business Case section for ${result.companyProfile.companyName}. This section translates unrealized AI value into specific profit-and-loss outcomes that a CFO or board can evaluate.

The diagnostic established:
- Revenue: ${formatCurrency(revenue)}
- Unrealized value: ${formatCurrency(econ.unrealizedValueLow)} to ${formatCurrency(econ.unrealizedValueHigh)} annually
- Current capture rate: ${econ.currentCapturePercent}%
- Stage: ${stage} ("${result.stageClassification.stageName}")
- Industry: ${formatIndustryLabel(result.companyProfile.industry)}

${stageFrame}

Write specific P&L impacts across these categories:
1. Revenue Growth: new revenue streams, faster time-to-market, customer experience improvements. Use their actual revenue to calculate dollar impacts (e.g., "a 2% revenue uplift equals ${formatCurrency(Math.round(revenue * 0.02))}").
2. Operating Margin: automation, efficiency, error reduction. Quantify margin improvement in basis points and dollars.
3. Cost Structure: how AI shifts the fixed/variable cost mix over 24 months. What does the structural cost advantage look like?
4. Talent Economics: retention, attraction, productivity. AI-mature orgs see measurably lower turnover.
5. Risk Quantification: compliance exposure, operational failures, shadow AI incidents.

For EACH category, present both the invest scenario (what they gain) and the stand-still scenario (what they lose). Be specific with dollar amounts derived from their ${formatCurrency(revenue)} revenue base.${research ? '\n\nCompany-specific research data is available. Reference their actual competitive position, margins, and recent financial performance to make the business case more credible.' : ''}

DIAGNOSTIC DATA:
${buildDiagnosticDataBlock(result, research)}

OUTPUT FORMAT:
- Markdown starting with H2: ## The Business Case
- Use H3 subheaders for each P&L category
- 400-600 words total
- Every paragraph must contain at least one specific dollar figure or percentage tied to their data
- End with a one-sentence summary of total P&L impact range over 24 months.`,
  };
}

// ---------------------------------------------------------------------------
// 6. Competitive Positioning
// ---------------------------------------------------------------------------

export function competitivePositioningPrompt(result: DiagnosticResult, research?: CompanyResearchProfile): PromptTemplate {
  return {
    system: SYSTEM_MESSAGE,
    user: `Write the Competitive Positioning section for ${result.companyProfile.companyName}.

This section must answer the board's real question: "Are we falling behind?"

Analysis framework:
1. Stage Context — Stage ${result.stageClassification.primaryStage} ("${result.stageClassification.stageName}") organizations in ${formatIndustryLabel(result.companyProfile.industry)} represent what share of the market? What are leaders in this industry doing at Stage 4-5?
2. Dimension Comparison — Where is the organization ahead of industry norms and where is it behind? Use the dimension scores and industry context to make specific comparisons.
3. Window Analysis — Based on the organization's current stage and the pace of AI adoption in ${formatIndustryLabel(result.companyProfile.industry)}, how long before the gap becomes structurally difficult to close?

Be direct about competitive risk. If the organization is behind, say so plainly. If it has advantages, name them specifically.

The organization is ${result.companyProfile.publicOrPrivate}. ${result.companyProfile.publicOrPrivate === 'public' ? 'Consider shareholder and analyst expectations around AI investment.' : 'Consider how private-company advantages (longer time horizons, less quarterly pressure) can be leveraged.'}${research?.competitorAIActivity?.length ? '\n\nCRITICAL: You have specific competitor AI activity data. Name these competitors and their moves. This is what makes this section worth $50K — the customer sees their actual competitive landscape, not generic benchmarks.' : ''}

DIAGNOSTIC DATA:
${buildDiagnosticDataBlock(result, research)}

OUTPUT FORMAT:
- Markdown starting with H2: ## Competitive Positioning
- Use H3 subheaders for each analysis area
- 400-500 words total
- Must include at least one specific reference to what leading organizations in their industry are doing differently
- End with a clear verdict: ahead, at pace, or behind — and by how much.`,
  };
}

// ---------------------------------------------------------------------------
// 6. Security & Governance Risk
// ---------------------------------------------------------------------------

export function securityGovernanceRiskPrompt(result: DiagnosticResult, research?: CompanyResearchProfile): PromptTemplate {
  const profile = result.companyProfile;
  const workflowScore =
    result.dimensionScores.find((d) => d.dimension === 'workflow_integration')
      ?.normalizedScore ?? 0;
  const authorityScore =
    result.dimensionScores.find((d) => d.dimension === 'authority_structure')
      ?.normalizedScore ?? 0;

  return {
    system: SYSTEM_MESSAGE,
    user: `Write the Security & Governance Risk section for ${profile.companyName}.

This section must be calibrated to their specific risk profile:
- Industry: ${formatIndustryLabel(profile.industry)}
- Regulatory Intensity: ${profile.regulatoryIntensity}
- Public/Private: ${profile.publicOrPrivate}
- Workflow Integration Score: ${workflowScore}/100 (low scores suggest shadow AI risk)
- Authority Structure Score: ${authorityScore}/100 (low scores suggest governance gaps)

Address these risk domains:
1. Shadow AI Exposure — With a Workflow Integration score of ${workflowScore}/100 and Authority Structure at ${authorityScore}/100, estimate the degree to which employees are using unapproved AI tools. Low integration + low authority = high shadow AI risk.
2. Compliance & Regulatory Risk — Given ${profile.regulatoryIntensity} regulatory intensity in ${formatIndustryLabel(profile.industry)}, what specific regulatory frameworks apply (e.g., EU AI Act, SOX implications, HIPAA, industry-specific regulations)? Where is the organization most exposed?
3. Data Governance Gaps — Based on the workflow integration and adoption patterns, what data is likely flowing through AI tools without proper governance?
4. Board Liability — What questions should the board be asking that they probably are not? What governance structures should exist?

Be specific to their industry and regulatory context. Generic "AI ethics" guidance is worthless here.${research?.regulatoryDevelopments?.length ? '\n\nYou have specific regulatory intelligence. Reference actual regulations and their implications for this company.' : ''}

DIAGNOSTIC DATA:
${buildDiagnosticDataBlock(result, research)}

OUTPUT FORMAT:
- Markdown starting with H2: ## Security & Governance Risk
- Use H3 subheaders for each risk domain
- 400-600 words total
- Rate each risk domain as Critical / High / Moderate / Low based on the data
- End with the single most urgent governance action the board should take.`,
  };
}

// ---------------------------------------------------------------------------
// 7. Vendor Landscape Analysis
// ---------------------------------------------------------------------------

export function vendorLandscapePrompt(result: DiagnosticResult, research?: CompanyResearchProfile): PromptTemplate {
  const profile = result.companyProfile;
  const useCases = profile.primaryAIUseCases.join(', ');

  const vendorDataBlock = research?.vendorAnalysis
    ? `
VENDOR INTELLIGENCE (from research):
- Market Landscape: ${research.vendorAnalysis.marketLandscape || 'N/A'}
- Vendors Identified: ${research.vendorAnalysis.vendorsIdentified.map((v) => `${v.vendorName} (${v.category}, ${v.marketPosition}): ${v.verdict}`).join('; ')}
- Recommendations: ${research.vendorAnalysis.recommendations.join('; ')}
- Risk Flags: ${research.vendorAnalysis.riskFlags.join('; ')}
`
    : '\nNo vendor-specific research data available. Base your analysis on the company profile, industry, and stated use cases.';

  return {
    system: `You are a Gartner-level technology analyst who has spent 15 years evaluating AI/ML vendor ecosystems, negotiating enterprise contracts, and advising Fortune 500 procurement teams. You have deep knowledge of vendor pricing models, lock-in mechanisms, capability roadmaps, and competitive dynamics. You call out vendor BS when you see it and give procurement teams the intelligence they need to negotiate from strength.

Rules:
- Do not use the word "journey."
- Do not hedge. State clear buy/build/partner verdicts.
- Name specific vendors and products. Generic "consider a vendor" advice is worthless.
- Never use em dashes or double dashes. Use commas, periods, or colons.
- Tone: authoritative, direct, peer-level. You are advising the CTO and CFO together.`,
    user: `Write the Vendor Landscape Analysis section for ${profile.companyName}.

This section gives the board a clear picture of the AI vendor ecosystem relevant to their business and tells them exactly where to spend, where to build internally, and where to partner.

COMPANY CONTEXT:
- Industry: ${formatIndustryLabel(profile.industry)}
- Revenue: ${formatCurrency(profile.revenue)}
- Employees: ${profile.employeeCount.toLocaleString()}
- Primary AI Use Cases: ${useCases}
- Current AI Stage: ${result.stageClassification.primaryStage} ("${result.stageClassification.stageName}")
${vendorDataBlock}

Analysis framework:
1. Vendor Stack Assessment: Based on the company's use cases (${useCases}), map the relevant vendor categories (foundation models, cloud AI platforms, vertical AI solutions, automation/RPA, data infrastructure). Name the top 2-3 vendors per category (e.g., OpenAI, Anthropic, Google for foundation models; Microsoft, AWS, GCP for cloud AI; Salesforce Einstein, ServiceNow for CRM/ITSM AI; UiPath, Automation Anywhere for RPA). Assess which are most relevant for this company's stage and industry.

2. Buy/Build/Partner Recommendations: For each major AI capability the company needs, provide a clear verdict:
   - BUY: Off-the-shelf solutions that are mature enough and cost-effective
   - BUILD: Capabilities where internal development creates lasting competitive advantage
   - PARTNER: Areas where a strategic vendor relationship (not just procurement) is the right model
   Justify each recommendation with specifics.

3. Vendor Risk Assessment: Flag specific risks including:
   - Lock-in risk (which vendors make it hardest to switch, and the switching cost)
   - Pricing trajectory (which vendors are raising prices fastest, which are in a price war)
   - Capability gaps (where vendor promises outrun delivery)
   - Concentration risk (over-dependence on a single vendor ecosystem)
   - Regulatory/compliance risk (which vendors have the weakest data governance)

4. Negotiation Intelligence: Provide 2-3 specific procurement tactics for the vendor relationships that matter most to this company.

DIAGNOSTIC DATA:
${buildDiagnosticDataBlock(result, research)}

OUTPUT FORMAT:
- Markdown starting with H2: ## Vendor Landscape Analysis
- Use H3 subheaders for each analysis area
- 500-700 words total
- Name at least 5 specific vendors with concrete assessments
- End with a summary table or ranked list of the top 3 vendor decisions the board should make in the next quarter.`,
  };
}

// ---------------------------------------------------------------------------
// 8. 90-Day Action Plan
// ---------------------------------------------------------------------------

export function ninetyDayActionPlanPrompt(result: DiagnosticResult, research?: CompanyResearchProfile): PromptTemplate {
  const sortedDimensions = [...result.dimensionScores].sort(
    (a, b) => a.normalizedScore - b.normalizedScore
  );
  const weakestDimension = sortedDimensions[0];
  const secondWeakest = sortedDimensions[1];
  const strongestDimension = sortedDimensions[sortedDimensions.length - 1];

  // Find the 5 lowest-scoring individual questions for hyper-specific action items
  const lowestQuestions = [...result.responses]
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((r) => {
      const q = DIAGNOSTIC_QUESTIONS.find((dq) => dq.id === r.questionId);
      return q ? `- ${r.questionId} (score ${r.score}/5): "${q.text}" [${formatDimensionLabel(q.dimension)}]` : '';
    })
    .filter(Boolean)
    .join('\n');

  // Find highest-scoring questions to identify strengths to leverage
  const highestQuestions = [...result.responses]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => {
      const q = DIAGNOSTIC_QUESTIONS.find((dq) => dq.id === r.questionId);
      return q ? `- ${r.questionId} (score ${r.score}/5): "${q.text}" [${formatDimensionLabel(q.dimension)}]` : '';
    })
    .filter(Boolean)
    .join('\n');

  // Composite index context
  const compositeContext = result.compositeIndices
    .map((ci) => `- ${ci.name}: ${ci.score}/100 — ${ci.interpretation}`)
    .join('\n');

  const ind = formatIndustryLabel(result.companyProfile.industry);
  const empCount = result.companyProfile.employeeCount;
  const isSmall = empCount <= 100;
  const isMid = empCount > 100 && empCount <= 1000;

  // Size-specific guidance
  const sizeContext = isSmall
    ? `This is a small organization (${empCount} employees). Actions must be achievable without dedicated AI teams. The CEO or a senior partner likely owns most decisions. Skip recommendations that assume large IT departments, enterprise procurement processes, or dedicated AI governance staff. Focus on lightweight, high-leverage moves: a single AI champion, 1-2 tool pilots, and simple measurement.`
    : isMid
    ? `This is a mid-market organization (${empCount} employees). Actions should be scoped for teams of 1-3 leading AI initiatives, not enterprise-scale programs. Some formal governance is appropriate but heavy-weight enterprise frameworks (AI CoE with 10+ FTEs, multi-layer approval committees) will stall progress. Focus on agile, owner-driven execution.`
    : `This is a large organization (${empCount.toLocaleString()} employees). Enterprise-scale governance, cross-functional AI councils, and formal change management are appropriate and necessary. Actions can assume dedicated AI teams, procurement processes, and multi-stakeholder governance.`;

  return {
    system: SYSTEM_MESSAGE,
    user: `Write the 90-Day Action Plan for ${result.companyProfile.companyName}, a ${ind} organization.

This is the section the board will actually use. Every action must be executable, not aspirational.
If an action would be generic across any industry, it does not belong in this plan. Every recommendation must reflect ${ind} specifically.

COMPANY SIZE CONTEXT:
${sizeContext}

DIMENSION SCORES (sorted weakest → strongest):
${sortedDimensions.map((d) => `- ${formatDimensionLabel(d.dimension)}: ${d.normalizedScore}/100`).join('\n')}

COMPOSITE INDICES:
${compositeContext}

FIVE LOWEST-SCORING BEHAVIORAL QUESTIONS (these are the specific gaps to address):
${lowestQuestions}

THREE HIGHEST-SCORING QUESTIONS (these are strengths to leverage):
${highestQuestions}

PRIORITIZATION CONTEXT:
- Weakest dimension: ${formatDimensionLabel(weakestDimension.dimension)} at ${weakestDimension.normalizedScore}/100
- Second weakest: ${formatDimensionLabel(secondWeakest.dimension)} at ${secondWeakest.normalizedScore}/100
- Strongest dimension: ${formatDimensionLabel(strongestDimension.dimension)} at ${strongestDimension.normalizedScore}/100
- Current stage: ${result.stageClassification.primaryStage} ("${result.stageClassification.stageName}")
- Unrealized value: ${formatCurrency(result.economicEstimate.unrealizedValueLow)} to ${formatCurrency(result.economicEstimate.unrealizedValueHigh)}
- Industry: ${ind} with ${result.companyProfile.regulatoryIntensity} regulatory intensity
- Company size: ${empCount.toLocaleString()} employees, ${formatCurrency(result.companyProfile.revenue)} revenue
- AI use cases they identified: ${result.companyProfile.primaryAIUseCases?.join(', ') || 'not specified'}

INDUSTRY-SPECIFIC INSTRUCTIONS:
You MUST make this plan unmistakably specific to ${ind}. For each action:
1. Explain WHY this action matters specifically in ${ind} (not in general). Reference industry-specific dynamics, regulatory requirements, competitive pressures, or client expectations.
2. If an action would be irrelevant, premature, or lower-priority in ${ind}, say so explicitly. For example: "In ${ind}, formal AI governance committees are [essential/premature/overkill] because [specific reason]."
3. Reference specific tools, platforms, frameworks, or certifications relevant to ${ind}. Do not recommend generic "AI platforms" when you can name what ${ind} firms actually use.
4. If the company's regulatory intensity is "${result.companyProfile.regulatoryIntensity}", calibrate governance recommendations accordingly. Heavy-regulation industries need compliance-first actions; light-regulation industries should not waste 90 days building governance when they could be deploying.
5. Connect each action to the specific lowest-scoring questions above. The action should directly address the behavioral gap revealed by that question.

Produce 4-6 prioritized actions. Each action MUST include:
- A specific, measurable action tied to a specific lowest-scoring question (not "improve AI governance" but "appoint a Chief AI Officer reporting to the CEO and publish an AI acceptable-use policy within 30 days, directly addressing the governance vacuum revealed by your score of ${weakestDimension.normalizedScore}/100 in ${formatDimensionLabel(weakestDimension.dimension)}")
- Owner by role (e.g., CIO, CFO, CHRO, CEO, Head of Data, Managing Partner, Practice Lead) — use titles appropriate for ${ind}
- Timeframe within the 90-day window (Days 1-30, Days 31-60, Days 61-90)
- Expected outcome with a measurable indicator specific to ${ind}
- A 1-2 sentence "${ind} context" note explaining why this specific action matters more (or less) in this industry than in others
- Connection to which dimension or constraint this action addresses

Prioritize based on: (1) highest financial impact given their ${formatCurrency(result.companyProfile.revenue)} revenue, (2) lowest implementation friction for a ${empCount}-person organization, (3) addresses the specific lowest-scoring questions above. Front-load quick wins in Days 1-30.

DIAGNOSTIC DATA:
${buildDiagnosticDataBlock(result, research)}

OUTPUT FORMAT:
- Markdown starting with H2: ## 90-Day Action Plan
- Number each action (### Action 1: [Title], ### Action 2: [Title], etc.)
- Within each action, use bold labels: **Owner:**, **Timeframe:**, **Expected Outcome:**, **Addresses:**, **${ind} Context:**
- 700-900 words total
- Close with a single paragraph on how to track progress and when to reassess, referencing their specific composite index scores as leading indicators.`,
  };
}

// ---------------------------------------------------------------------------
// Section registry — maps slugs to prompt functions
// ---------------------------------------------------------------------------

export const SECTION_PROMPTS: Record<
  string,
  (result: DiagnosticResult, research?: CompanyResearchProfile) => PromptTemplate
> = {
  'executive-summary': executiveSummaryPrompt,
  'ai-posture-diagnosis': aiPostureDiagnosisPrompt,
  'structural-constraints': structuralConstraintsPrompt,
  'financial-impact': financialImpactPrompt,
  'pnl-business-case': pnlBusinessCasePrompt,
  'competitive-positioning': competitivePositioningPrompt,
  'security-governance-risk': securityGovernanceRiskPrompt,
  'vendor-landscape': vendorLandscapePrompt,
  '90-day-action-plan': ninetyDayActionPlanPrompt,
};

export const SECTION_TITLES: Record<string, string> = {
  'executive-summary': 'Executive Summary',
  'ai-posture-diagnosis': 'AI Posture Diagnosis',
  'structural-constraints': 'Structural Constraints',
  'financial-impact': 'Financial Impact',
  'pnl-business-case': 'P&L Business Case',
  'competitive-positioning': 'Competitive Positioning',
  'security-governance-risk': 'Security & Governance Risk',
  'vendor-landscape': 'Vendor Landscape Analysis',
  '90-day-action-plan': '90-Day Action Plan',
};

export const SECTION_ORDER: string[] = [
  'executive-summary',
  'ai-posture-diagnosis',
  'structural-constraints',
  'competitive-positioning',
  'financial-impact',
  'pnl-business-case',
  'security-governance-risk',
  'vendor-landscape',
  '90-day-action-plan',
];
