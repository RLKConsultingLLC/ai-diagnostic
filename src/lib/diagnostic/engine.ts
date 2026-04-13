// =============================================================================
// RLK AI Board Brief — Diagnostic Engine Orchestrator
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

export function runDiagnostic(
  responses: AssessmentResponse[],
  profile: CompanyProfile
): DiagnosticResult {
  // Step 1: Compute dimension scores (industry-weighted)
  const dimensionScores = computeDimensionScores(responses, profile);

  // Step 2: Compute composite indices (cross-dimension)
  const compositeIndices = computeAllIndices(responses);

  // Step 3: Classify stage (uses both dimensions + indices)
  const stageClassification = classifyStage(dimensionScores, compositeIndices);

  // Step 4: Compute economic estimate
  const economicEstimate = computeEconomicEstimate(profile, stageClassification);

  // Step 5: Compute overall score
  const overallScore = computeOverallScore(dimensionScores);

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
  };
}
