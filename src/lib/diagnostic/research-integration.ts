// =============================================================================
// RLK AI Diagnostic — Research → Scoring Integration
// =============================================================================
// Detects discrepancies between public research data and self-reported
// diagnostic responses. Modulates confidence and can adjust dimension scores
// when research data contradicts survey answers.
// =============================================================================

import type { DiagnosticResult, Dimension } from '@/types/diagnostic';
import type { CompanyResearchProfile } from '@/types/research';

export interface ResearchAdjustment {
  confidenceModifier: number; // -0.10 to +0.10
  discrepancies: ResearchDiscrepancy[];
  dimensionAdjustments: Partial<Record<Dimension, number>>; // -5 to +5 on 0-100 scale
  narrative: string; // Summary for AI prompt context
}

interface ResearchDiscrepancy {
  dimension: Dimension;
  direction: 'research_higher' | 'research_lower';
  evidence: string;
  severity: 'minor' | 'significant';
}

export function computeResearchAdjustments(
  result: DiagnosticResult,
  research: CompanyResearchProfile
): ResearchAdjustment {
  const discrepancies: ResearchDiscrepancy[] = [];
  const dimensionAdjustments: Partial<Record<Dimension, number>> = {};

  // --- Adoption behavior checks ---
  const adoptionScore =
    result.dimensionScores.find((d) => d.dimension === 'adoption_behavior')
      ?.normalizedScore ?? 50;

  const hasPublicAISignals =
    research.aiMentions.length > 2 ||
    research.aiInvestments.length > 1 ||
    (research.aiPostureAssessment && research.aiPostureAssessment.length > 100);

  // Low self-reported adoption but strong public AI signals
  if (adoptionScore < 35 && hasPublicAISignals) {
    discrepancies.push({
      dimension: 'adoption_behavior',
      direction: 'research_higher',
      evidence: `Public data shows ${research.aiMentions.length} AI mentions and ${research.aiInvestments.length} AI investments, suggesting higher adoption than self-reported scores indicate.`,
      severity: 'significant',
    });
    dimensionAdjustments.adoption_behavior = 5;
  }

  // High self-reported adoption but no public evidence
  if (adoptionScore > 70 && !hasPublicAISignals && research.sourcesConsulted > 10) {
    discrepancies.push({
      dimension: 'adoption_behavior',
      direction: 'research_lower',
      evidence: `Despite ${research.sourcesConsulted} sources consulted, no significant public AI activity was found, which is unusual for the claimed adoption level.`,
      severity: 'minor',
    });
  }

  // --- Economic translation checks ---
  const economicScore =
    result.dimensionScores.find((d) => d.dimension === 'economic_translation')
      ?.normalizedScore ?? 50;

  const hasFinancialAIData =
    research.financialHighlights?.technologySpend ||
    research.financialHighlights?.rAndDSpend ||
    research.recentEarnings?.some((e) => e.aiMentions.length > 0);

  // Low economic translation but earnings calls mention AI ROI
  if (economicScore < 30 && hasFinancialAIData) {
    const aiEarningsMentions = research.recentEarnings
      ?.filter((e) => e.aiMentions.length > 0)
      .length ?? 0;

    if (aiEarningsMentions > 0) {
      discrepancies.push({
        dimension: 'economic_translation',
        direction: 'research_higher',
        evidence: `Earnings calls in ${aiEarningsMentions} quarter(s) mention AI with financial context, suggesting more economic translation capability than survey responses indicate.`,
        severity: 'minor',
      });
      dimensionAdjustments.economic_translation = 3;
    }
  }

  // --- Decision velocity checks ---
  const velocityScore =
    result.dimensionScores.find((d) => d.dimension === 'decision_velocity')
      ?.normalizedScore ?? 50;

  const hasRecentAIInitiatives =
    research.strategicInitiatives.filter(
      (i) => i.status === 'in_progress' || i.status === 'announced'
    ).length >= 2;

  // Low velocity but multiple active AI initiatives in public record
  if (velocityScore < 30 && hasRecentAIInitiatives) {
    discrepancies.push({
      dimension: 'decision_velocity',
      direction: 'research_higher',
      evidence: `${research.strategicInitiatives.filter((i) => i.status === 'in_progress').length} in-progress AI initiatives suggest faster decision-making than survey scores indicate.`,
      severity: 'minor',
    });
  }

  // --- Compute confidence modifier ---
  let confidenceModifier = 0;

  if (research.confidenceLevel === 'high') {
    // Rich research data generally increases confidence
    confidenceModifier += 0.05;
  } else if (research.confidenceLevel === 'low') {
    confidenceModifier -= 0.03;
  }

  // Discrepancies reduce confidence (data sources disagree)
  const significantDiscrepancies = discrepancies.filter(
    (d) => d.severity === 'significant'
  ).length;
  confidenceModifier -= significantDiscrepancies * 0.05;
  confidenceModifier -= (discrepancies.length - significantDiscrepancies) * 0.02;

  // Clamp to [-0.10, +0.10]
  confidenceModifier = Math.max(-0.1, Math.min(0.1, confidenceModifier));

  // --- Build narrative for AI context ---
  const narrativeParts: string[] = [];

  if (discrepancies.length === 0) {
    narrativeParts.push(
      'Research data is broadly consistent with self-reported diagnostic responses.'
    );
  } else {
    narrativeParts.push(
      `Research data reveals ${discrepancies.length} discrepancy(ies) with self-reported responses:`
    );
    for (const d of discrepancies) {
      narrativeParts.push(`- ${d.evidence}`);
    }
  }

  if (research.confidenceLevel === 'high') {
    narrativeParts.push(
      'Research confidence is HIGH — public data is abundant and should be weighted accordingly.'
    );
  }

  return {
    confidenceModifier,
    discrepancies,
    dimensionAdjustments,
    narrative: narrativeParts.join('\n'),
  };
}
