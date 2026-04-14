// =============================================================================
// RLK AI Diagnostic — Internal Consistency Cross-Checks
// =============================================================================
// Detects contradictory response patterns that undermine diagnostic accuracy.
// E.g., claiming fast decision velocity while reporting 6+ month approval times.
// =============================================================================

import type { AssessmentResponse, ConsistencyFlag } from '@/types/diagnostic';

interface ContradictionRule {
  questionA: string;
  questionB: string;
  // Returns true if the pair is contradictory
  check: (scoreA: number, scoreB: number) => boolean;
  type: 'contradiction' | 'unlikely';
  severity: 'high' | 'moderate';
  explanation: string;
}

const CONTRADICTION_RULES: ContradictionRule[] = [
  {
    questionA: 'DV-01', // Idea to funded pilot (slow = low score)
    questionB: 'DV-04', // Competitive response (fast = high score)
    check: (a, b) => a <= 1 && b >= 4,
    type: 'contradiction',
    severity: 'high',
    explanation:
      'Reported slow pilot funding (6+ months) contradicts claimed rapid competitive response. If piloting takes 6+ months, it is unlikely your organization responds to competitive AI announcements within weeks.',
  },
  {
    questionA: 'AB-05', // Workforce AI usage > 50%
    questionB: 'WI-01', // Workflow integration (low = not integrated)
    check: (a, b) => a >= 4 && b <= 1,
    type: 'contradiction',
    severity: 'high',
    explanation:
      'High workforce AI adoption is inconsistent with minimal workflow integration. If over 50% of employees use AI, integration scores should reflect systematic embedding, not ad hoc usage.',
  },
  {
    questionA: 'AS-01', // Approval layers (many = low score)
    questionB: 'DV-02', // Pilot to scale (fast = high score)
    check: (a, b) => a <= 1 && b >= 4,
    type: 'unlikely',
    severity: 'moderate',
    explanation:
      'Five or more approval layers make it unlikely that AI pilots scale in under 60 days. Consider whether the reported scaling speed accounts for all governance checkpoints.',
  },
  {
    questionA: 'ET-01', // Financial measurement (none = low score)
    questionB: 'ET-04', // Measurable economic translation (high)
    check: (a, b) => a <= 1 && b >= 4,
    type: 'contradiction',
    severity: 'high',
    explanation:
      'Reported absence of AI financial measurement contradicts claims of measurable economic translation. If no measurement infrastructure exists, economic impact cannot be systematically quantified.',
  },
  {
    questionA: 'AB-02', // Employee awareness (low)
    questionB: 'WI-02', // Workflow integration depth (high)
    check: (a, b) => a <= 1 && b >= 4,
    type: 'contradiction',
    severity: 'moderate',
    explanation:
      'Low employee awareness of AI tools is inconsistent with deep workflow integration. Employees cannot be deeply integrated with AI tools they are largely unaware of.',
  },
  {
    questionA: 'AS-05', // Legal/compliance as blocker (slow = low score)
    questionB: 'DV-05', // Procurement speed (fast = high score)
    check: (a, b) => a <= 1 && b >= 4,
    type: 'unlikely',
    severity: 'moderate',
    explanation:
      'Legal and compliance processes described as major blockers are inconsistent with rapid AI procurement. Procurement speed is typically constrained by the slowest approval gate.',
  },
  {
    questionA: 'ET-05', // Finance team perspective (disconnected = low)
    questionB: 'ET-03', // Board justification (strong = high)
    check: (a, b) => a <= 1 && b >= 4,
    type: 'unlikely',
    severity: 'moderate',
    explanation:
      'A disconnected finance team makes strong board-level AI justification unlikely. Board reporting typically requires finance involvement in validating ROI claims.',
  },
];

export function checkConsistency(
  responses: AssessmentResponse[]
): ConsistencyFlag[] {
  const scoreMap = new Map<string, number>();
  for (const r of responses) {
    scoreMap.set(r.questionId, r.score);
  }

  const flags: ConsistencyFlag[] = [];

  for (const rule of CONTRADICTION_RULES) {
    const scoreA = scoreMap.get(rule.questionA);
    const scoreB = scoreMap.get(rule.questionB);

    if (scoreA === undefined || scoreB === undefined) continue;

    if (rule.check(scoreA, scoreB)) {
      flags.push({
        questionPairIds: [rule.questionA, rule.questionB],
        type: rule.type,
        severity: rule.severity,
        explanation: rule.explanation,
      });
    }
  }

  return flags;
}
