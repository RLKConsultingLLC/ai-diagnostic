// =============================================================================
// RLK AI Board Brief — Prompt Templates for Narrative Generation
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
- Tone: authoritative, direct, peer-level. No jargon. No filler.`;

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
  return industry
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
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
- Primary AI Use Cases: ${profile.primaryAIUseCases.join(', ')}`;
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
- Unrealized Value Range: ${formatCurrency(econ.unrealizedValueLow)} – ${formatCurrency(econ.unrealizedValueHigh)}
- Annual Wasted Hours: ${econ.annualWastedHours.toLocaleString()}
- Cost Per Employee: ${formatCurrency(econ.costPerEmployee)}
- Industry Benchmark: ${econ.industryBenchmark}`;
}

function buildDiagnosticDataBlock(result: DiagnosticResult, research?: CompanyResearchProfile): string {
  let block = `
${serializeCompanyContext(result.companyProfile)}

OVERALL SCORE: ${result.overallScore}/100

${serializeDimensionScores(result.dimensionScores)}

${serializeCompositeIndices(result.compositeIndices)}

${serializeStageClassification(result.stageClassification)}

${serializeEconomicEstimate(result.economicEstimate)}`;

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
// 5. Competitive Positioning
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
// 7. 90-Day Action Plan
// ---------------------------------------------------------------------------

export function ninetyDayActionPlanPrompt(result: DiagnosticResult, research?: CompanyResearchProfile): PromptTemplate {
  const weakestDimension = [...result.dimensionScores].sort(
    (a, b) => a.normalizedScore - b.normalizedScore
  )[0];
  const strongestDimension = [...result.dimensionScores].sort(
    (a, b) => b.normalizedScore - a.normalizedScore
  )[0];

  return {
    system: SYSTEM_MESSAGE,
    user: `Write the 90-Day Action Plan for ${result.companyProfile.companyName}.

This is the section the board will actually use. Every action must be executable, not aspirational.

Context for prioritization:
- Weakest dimension: ${formatDimensionLabel(weakestDimension.dimension)} at ${weakestDimension.normalizedScore}/100
- Strongest dimension: ${formatDimensionLabel(strongestDimension.dimension)} at ${strongestDimension.normalizedScore}/100
- Current stage: ${result.stageClassification.primaryStage} ("${result.stageClassification.stageName}")
- Unrealized value at stake: ${formatCurrency(result.economicEstimate.unrealizedValueLow)} – ${formatCurrency(result.economicEstimate.unrealizedValueHigh)}
- Industry: ${formatIndustryLabel(result.companyProfile.industry)} with ${result.companyProfile.regulatoryIntensity} regulatory intensity
- Company size: ${result.companyProfile.employeeCount.toLocaleString()} employees, ${formatCurrency(result.companyProfile.revenue)} revenue

Produce 3-5 prioritized actions. Each action MUST include:
- A specific, measurable action (not "improve AI governance" but "appoint a Chief AI Officer reporting to the CEO and publish an AI acceptable-use policy within 30 days")
- Owner by role (e.g., CIO, CFO, CHRO, CEO, Head of Data) — not by name
- Timeframe within the 90-day window (Days 1-30, Days 31-60, Days 61-90)
- Expected outcome with a measurable indicator
- Connection to which dimension or constraint this action addresses

Prioritize based on: (1) highest financial impact, (2) lowest implementation friction, (3) addresses the weakest dimension. Front-load quick wins in Days 1-30.

DIAGNOSTIC DATA:
${buildDiagnosticDataBlock(result, research)}

OUTPUT FORMAT:
- Markdown starting with H2: ## 90-Day Action Plan
- Number each action (### Action 1: [Title], ### Action 2: [Title], etc.)
- Within each action, use bold labels: **Owner:**, **Timeframe:**, **Expected Outcome:**, **Addresses:**
- 500-700 words total
- Close with a single paragraph on how to track progress and when to reassess.`,
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
  'competitive-positioning': competitivePositioningPrompt,
  'security-governance-risk': securityGovernanceRiskPrompt,
  '90-day-action-plan': ninetyDayActionPlanPrompt,
};

export const SECTION_TITLES: Record<string, string> = {
  'executive-summary': 'Executive Summary',
  'ai-posture-diagnosis': 'AI Posture Diagnosis',
  'structural-constraints': 'Structural Constraints',
  'financial-impact': 'Financial Impact',
  'competitive-positioning': 'Competitive Positioning',
  'security-governance-risk': 'Security & Governance Risk',
  '90-day-action-plan': '90-Day Action Plan',
};

export const SECTION_ORDER: string[] = [
  'executive-summary',
  'ai-posture-diagnosis',
  'structural-constraints',
  'financial-impact',
  'competitive-positioning',
  'security-governance-risk',
  '90-day-action-plan',
];
