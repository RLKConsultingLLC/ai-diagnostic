// =============================================================================
// RLK AI Diagnostic — Sensitivity Analysis
// =============================================================================
// For each question, hypothetically increases the score by +1 and re-runs the
// scoring pipeline to measure the delta. Returns the top 10 highest-impact
// questions — "which answers have the most leverage on the overall result?"
// =============================================================================

import type {
  AssessmentResponse,
  CompanyProfile,
  DimensionScore,
  SensitivityItem,
  SensitivityResult,
} from '@/types/diagnostic';
import { computeDimensionScores, computeAllIndices, computeOverallScore } from './scoring';
import { classifyStage } from './stages';
import { DIAGNOSTIC_QUESTIONS } from './questions';

export function computeSensitivityAnalysis(
  responses: AssessmentResponse[],
  profile: CompanyProfile
): SensitivityResult {
  // Compute baseline scores
  const baselineDimScores = computeDimensionScores(responses, profile);
  const baselineIndices = computeAllIndices(responses);
  const baselineOverall = computeOverallScore(baselineDimScores);
  const baselineStage = classifyStage(baselineDimScores, baselineIndices);

  const items: SensitivityItem[] = [];

  for (const response of responses) {
    const question = DIAGNOSTIC_QUESTIONS.find((q) => q.id === response.questionId);
    if (!question) continue;

    // Max score is 5 — skip if already at max
    const maxOption = Math.max(...question.options.map((o) => o.score));
    if (response.score >= maxOption) continue;

    // Find the next higher score option
    const availableScores = question.options
      .map((o) => o.score)
      .filter((s) => s > response.score)
      .sort((a, b) => a - b);
    if (availableScores.length === 0) continue;

    const hypotheticalScore = availableScores[0];

    // Create modified responses with this question scored +1 step
    const modifiedResponses = responses.map((r) =>
      r.questionId === response.questionId
        ? { ...r, score: hypotheticalScore }
        : r
    );

    // Re-run scoring pipeline
    const modDimScores = computeDimensionScores(modifiedResponses, profile);
    const modIndices = computeAllIndices(modifiedResponses);
    const modOverall = computeOverallScore(modDimScores);
    const modStage = classifyStage(modDimScores, modIndices);

    // Compute dimension delta
    const baseDim = baselineDimScores.find(
      (d) => d.dimension === question.dimension
    ) as DimensionScore;
    const modDim = modDimScores.find(
      (d) => d.dimension === question.dimension
    ) as DimensionScore;

    items.push({
      questionId: response.questionId,
      questionText: question.text,
      dimension: question.dimension,
      currentScore: response.score,
      hypotheticalScore,
      overallDelta: Math.round((modOverall - baselineOverall) * 100) / 100,
      stageDelta: modStage.primaryStage - baselineStage.primaryStage,
      dimensionDelta: modDim.normalizedScore - baseDim.normalizedScore,
    });
  }

  // Sort by overall delta descending, take top 10
  items.sort((a, b) => b.overallDelta - a.overallDelta);
  const topImpactQuestions = items.slice(0, 10);

  // Find which dimension has the most leverage
  const dimensionDeltas: Record<string, number> = {};
  for (const item of items) {
    dimensionDeltas[item.dimension] =
      (dimensionDeltas[item.dimension] || 0) + item.overallDelta;
  }
  const highestLeverageDimension =
    Object.entries(dimensionDeltas).sort(([, a], [, b]) => b - a)[0]?.[0] ||
    'adoption_behavior';

  const averageDelta =
    items.length > 0
      ? Math.round(
          (items.reduce((sum, i) => sum + i.overallDelta, 0) / items.length) *
            100
        ) / 100
      : 0;

  return {
    topImpactQuestions,
    highestLeverageDimension,
    averageDelta,
  };
}
