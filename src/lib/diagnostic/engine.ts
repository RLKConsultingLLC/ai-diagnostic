// =============================================================================
// RLK AI Diagnostic — Diagnostic Engine Orchestrator
// =============================================================================
// Main entry point that runs the full diagnostic pipeline:
//   responses → dimension scores → indices → stage → economics → result
// =============================================================================

import { v4 as uuidv4 } from 'uuid';
import {
  AssessmentResponse,
  CompanyProfile,
  DiagnosticResult,
} from '@/types/diagnostic';
import { computeDimensionScores, computeAllIndices, computeOverallScore } from './scoring';
import { classifyStage } from './stages';
import { computeEconomicEstimate } from './economic';
import { assessResponseQuality } from './quality';
import { checkConsistency } from './consistency';
import { computeSensitivityAnalysis } from './sensitivity';
import { DIAGNOSTIC_QUESTIONS } from './questions';

export function runDiagnostic(
  responses: AssessmentResponse[],
  profile: CompanyProfile
): DiagnosticResult {
  // Step 1: Assess response quality and consistency
  const responseQuality = assessResponseQuality(responses);
  const consistencyFlags = checkConsistency(responses);

  // Step 2: Compute dimension scores (industry-weighted)
  const dimensionScores = computeDimensionScores(responses, profile);

  // Step 3: Compute composite indices (cross-dimension)
  const compositeIndices = computeAllIndices(responses);

  // Step 4: Classify stage (uses dimensions + indices + quality signals)
  const stageClassification = classifyStage(dimensionScores, compositeIndices, {
    qualityMetrics: responseQuality,
    consistencyFlags,
    totalQuestions: DIAGNOSTIC_QUESTIONS.length,
    answeredQuestions: responses.length,
  });

  // Step 5: Compute economic estimate
  const economicEstimate = computeEconomicEstimate(profile, stageClassification, dimensionScores);

  // Step 6: Compute overall score
  const overallScore = computeOverallScore(dimensionScores);

  // Step 7: Sensitivity analysis — which questions have the most leverage?
  const sensitivityAnalysis = computeSensitivityAnalysis(responses, profile);

  return {
    id: uuidv4(),
    completedAt: new Date().toISOString(),
    companyProfile: profile,
    responses,
    dimensionScores,
    compositeIndices,
    stageClassification,
    economicEstimate,
    overallScore,
    responseQuality,
    consistencyFlags,
    sensitivityAnalysis,
  };
}
