// =============================================================================
// RLK AI Board Brief — Economic Value Estimation Model
// =============================================================================
// Calculates unrealized AI value based on company profile, stage, and
// industry benchmarks. Produces board-ready financial framing.
// =============================================================================

import {
  CompanyProfile,
  EconomicEstimate,
  Industry,
  StageClassification,
  StageNumber,
} from '@/types/diagnostic';

// ---------------------------------------------------------------------------
// INDUSTRY PRODUCTIVITY POTENTIAL
// ---------------------------------------------------------------------------
// Estimated % of total labor cost addressable by AI (conservative range)

const INDUSTRY_PRODUCTIVITY_POTENTIAL: Record<Industry, { low: number; high: number; avgLaborCostPercent: number }> = {
  financial_services: { low: 0.20, high: 0.35, avgLaborCostPercent: 0.45 },
  insurance: { low: 0.18, high: 0.32, avgLaborCostPercent: 0.40 },
  healthcare: { low: 0.15, high: 0.28, avgLaborCostPercent: 0.55 },
  manufacturing: { low: 0.12, high: 0.25, avgLaborCostPercent: 0.25 },
  technology: { low: 0.22, high: 0.35, avgLaborCostPercent: 0.50 },
  retail_ecommerce: { low: 0.15, high: 0.30, avgLaborCostPercent: 0.35 },
  professional_services: { low: 0.25, high: 0.35, avgLaborCostPercent: 0.60 },
  energy_utilities: { low: 0.10, high: 0.22, avgLaborCostPercent: 0.30 },
  government: { low: 0.12, high: 0.25, avgLaborCostPercent: 0.50 },
  education: { low: 0.10, high: 0.22, avgLaborCostPercent: 0.55 },
  media_entertainment: { low: 0.18, high: 0.32, avgLaborCostPercent: 0.35 },
  other: { low: 0.15, high: 0.30, avgLaborCostPercent: 0.40 },
};

// ---------------------------------------------------------------------------
// STAGE-BASED CAPTURE RATES
// ---------------------------------------------------------------------------
// What % of theoretical AI productivity potential the org is actually capturing

const STAGE_CAPTURE_RATES: Record<StageNumber, number> = {
  1: 0.02, // 2% — almost nothing captured
  2: 0.10, // 10% — some pilot value
  3: 0.25, // 25% — pockets of real value
  4: 0.55, // 55% — significant capture
  5: 0.80, // 80% — near-full capture
};

// ---------------------------------------------------------------------------
// COMPANY SIZE ADJUSTMENTS
// ---------------------------------------------------------------------------

function getSizeMultiplier(employeeCount: number): number {
  if (employeeCount < 100) return 0.7;       // Small — less overhead to capture
  if (employeeCount < 500) return 0.85;
  if (employeeCount < 2000) return 1.0;
  if (employeeCount < 10000) return 1.1;      // Larger orgs have more opportunities
  if (employeeCount < 50000) return 1.15;
  return 1.2;                                  // Enterprise scale
}

// ---------------------------------------------------------------------------
// AVERAGE COST PER EMPLOYEE BY INDUSTRY
// ---------------------------------------------------------------------------

const AVG_COST_PER_EMPLOYEE: Record<Industry, number> = {
  financial_services: 135000,
  insurance: 115000,
  healthcare: 95000,
  manufacturing: 85000,
  technology: 165000,
  retail_ecommerce: 65000,
  professional_services: 145000,
  energy_utilities: 110000,
  government: 90000,
  education: 75000,
  media_entertainment: 105000,
  other: 100000,
};

// ---------------------------------------------------------------------------
// ECONOMIC VALUE ESTIMATION
// ---------------------------------------------------------------------------

export function computeEconomicEstimate(
  profile: CompanyProfile,
  stage: StageClassification
): EconomicEstimate {
  const industry = profile.industry;
  const potential = INDUSTRY_PRODUCTIVITY_POTENTIAL[industry];
  const captureRate = STAGE_CAPTURE_RATES[stage.primaryStage];
  const sizeMultiplier = getSizeMultiplier(profile.employeeCount);
  const costPerEmployee = AVG_COST_PER_EMPLOYEE[industry];

  // Total labor cost estimate
  const totalLaborCost = profile.employeeCount * costPerEmployee;

  // If revenue is provided and reasonable, use it as a cross-check
  const laborCostFromRevenue = profile.revenue * potential.avgLaborCostPercent;
  const effectiveLaborCost = Math.min(totalLaborCost, laborCostFromRevenue * 1.2);

  // Theoretical AI-addressable productivity value
  const productivityPotentialLow = effectiveLaborCost * potential.low * sizeMultiplier;
  const productivityPotentialHigh = effectiveLaborCost * potential.high * sizeMultiplier;
  const midpointPotential = (productivityPotentialLow + productivityPotentialHigh) / 2;

  // Average productivity potential as percentage
  const productivityPotentialPercent = ((potential.low + potential.high) / 2) * 100;

  // Value currently being captured
  const currentCapturePercent = captureRate * 100;
  const capturedValue = midpointPotential * captureRate;

  // Unrealized value
  const unrealizedLow = productivityPotentialLow * (1 - captureRate);
  const unrealizedHigh = productivityPotentialHigh * (1 - captureRate);

  // Wasted hours calculation
  const hoursPerEmployee = 2080; // Standard work year
  const potentialHoursSaved = profile.employeeCount *
    hoursPerEmployee *
    ((potential.low + potential.high) / 2);
  const hoursCaptured = potentialHoursSaved * captureRate;
  const annualWastedHours = Math.round(potentialHoursSaved - hoursCaptured);

  // Industry benchmark narrative
  const industryBenchmark = buildBenchmarkNarrative(
    industry,
    stage.primaryStage,
    unrealizedLow,
    unrealizedHigh,
    profile.revenue
  );

  return {
    productivityPotentialPercent: Math.round(productivityPotentialPercent),
    currentCapturePercent: Math.round(currentCapturePercent),
    unrealizedValueLow: roundToSignificantFigures(unrealizedLow, 2),
    unrealizedValueHigh: roundToSignificantFigures(unrealizedHigh, 2),
    annualWastedHours,
    costPerEmployee,
    industryBenchmark,
  };
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function roundToSignificantFigures(num: number, figures: number): number {
  if (num === 0) return 0;
  const d = Math.ceil(Math.log10(Math.abs(num)));
  const power = figures - d;
  const magnitude = Math.pow(10, power);
  return Math.round(num * magnitude) / magnitude;
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function buildBenchmarkNarrative(
  industry: Industry,
  stage: StageNumber,
  unrealizedLow: number,
  unrealizedHigh: number,
  revenue: number
): string {
  const unrealizedPercent = ((unrealizedLow + unrealizedHigh) / 2 / revenue) * 100;
  const stageLabel = [
    '',
    'Tool Curiosity',
    'Pilot Proliferation',
    'Managed Deployment',
    'Operational Integration',
    'AI-Native Enterprise',
  ][stage];

  const capturePercent = STAGE_CAPTURE_RATES[stage] * 100;

  return (
    `Organizations at the "${stageLabel}" stage in your industry typically capture ` +
    `approximately ${capturePercent}% of their potential AI value. ` +
    `For an organization of your size and industry, this represents an estimated ` +
    `${formatCurrency(unrealizedLow)}–${formatCurrency(unrealizedHigh)} in unrealized annual value, ` +
    `equivalent to approximately ${unrealizedPercent.toFixed(1)}% of revenue. ` +
    `Advancing one stage would roughly double your capture rate.`
  );
}

// ---------------------------------------------------------------------------
// PUBLIC FORMAT HELPERS (used by prompt templates and PDF)
// ---------------------------------------------------------------------------

export function formatEconomicSummary(estimate: EconomicEstimate): string {
  return (
    `Productivity Potential: ${estimate.productivityPotentialPercent}% of addressable labor cost\n` +
    `Current Capture Rate: ${estimate.currentCapturePercent}%\n` +
    `Unrealized Value: ${formatCurrency(estimate.unrealizedValueLow)}–${formatCurrency(estimate.unrealizedValueHigh)} annually\n` +
    `Wasted Hours: ${estimate.annualWastedHours.toLocaleString()} hours/year`
  );
}

export { formatCurrency };
