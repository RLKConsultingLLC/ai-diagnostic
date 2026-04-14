// =============================================================================
// RLK AI Diagnostic — Response Quality Assessment
// =============================================================================
// Detects speed-clicking, straight-lining, and other indicators of low-quality
// responses. Flags suspect data before it enters the scoring engine.
// =============================================================================

import type { AssessmentResponse, ResponseQualityMetrics } from '@/types/diagnostic';

const FAST_THRESHOLD_MS = 3000; // Responses under 3s are suspiciously fast
const STRAIGHT_LINE_THRESHOLD = 10; // Same answer 10+ times in a row
const MIN_TOTAL_TIME_MS = 5 * 60 * 1000; // 5 minutes for entire assessment
const FAST_PERCENT_THRESHOLD = 0.4; // >40% fast responses = suspect

export function assessResponseQuality(
  responses: AssessmentResponse[]
): ResponseQualityMetrics {
  const responsesWithTiming = responses.filter((r) => r.durationMs !== undefined);

  // Total and average duration
  const totalDurationMs = responsesWithTiming.reduce(
    (sum, r) => sum + (r.durationMs || 0),
    0
  );
  const averageQuestionTimeMs =
    responsesWithTiming.length > 0
      ? totalDurationMs / responsesWithTiming.length
      : 0;

  // Speed-click detection
  const fastResponseCount = responsesWithTiming.filter(
    (r) => (r.durationMs || 0) < FAST_THRESHOLD_MS
  ).length;

  // Straight-line detection: same selectedOptionIndex N+ times in a row
  let straightLineDetected = false;
  let streak = 1;
  for (let i = 1; i < responses.length; i++) {
    if (responses[i].selectedOptionIndex === responses[i - 1].selectedOptionIndex) {
      streak++;
      if (streak >= STRAIGHT_LINE_THRESHOLD) {
        straightLineDetected = true;
        break;
      }
    } else {
      streak = 1;
    }
  }

  // Compute quality grade
  let qualityGrade: ResponseQualityMetrics['qualityGrade'] = 'high';

  const hasTiming = responsesWithTiming.length > 0;

  if (hasTiming) {
    const fastPercent = fastResponseCount / responsesWithTiming.length;

    if (fastPercent > FAST_PERCENT_THRESHOLD || totalDurationMs < MIN_TOTAL_TIME_MS) {
      qualityGrade = 'suspect';
    } else if (straightLineDetected) {
      qualityGrade = 'suspect';
    } else if (fastPercent > 0.2 || averageQuestionTimeMs < 5000) {
      qualityGrade = 'low';
    } else if (fastPercent > 0.1 || averageQuestionTimeMs < 8000) {
      qualityGrade = 'acceptable';
    }
  } else {
    // No timing data (legacy responses) — cannot assess speed, check straight-lining only
    if (straightLineDetected) {
      qualityGrade = 'low';
    } else {
      qualityGrade = 'acceptable';
    }
  }

  return {
    totalDurationMs,
    averageQuestionTimeMs: Math.round(averageQuestionTimeMs),
    fastResponseCount,
    straightLineDetected,
    qualityGrade,
  };
}
