// =============================================================================
// RLK AI Diagnostic — Economic Value Estimation Model
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
  // Financial Services
  insurance: { low: 0.18, high: 0.32, avgLaborCostPercent: 0.40 },
  banking: { low: 0.20, high: 0.35, avgLaborCostPercent: 0.45 },
  capital_markets: { low: 0.20, high: 0.35, avgLaborCostPercent: 0.45 },
  asset_wealth_management: { low: 0.20, high: 0.35, avgLaborCostPercent: 0.45 },
  investment_banking: { low: 0.18, high: 0.30, avgLaborCostPercent: 0.50 },
  private_equity: { low: 0.16, high: 0.28, avgLaborCostPercent: 0.55 },
  venture_capital: { low: 0.16, high: 0.28, avgLaborCostPercent: 0.55 },
  hedge_funds: { low: 0.18, high: 0.30, avgLaborCostPercent: 0.50 },
  // Healthcare & Life Sciences
  healthcare_providers: { low: 0.15, high: 0.28, avgLaborCostPercent: 0.55 },
  healthcare_payers: { low: 0.15, high: 0.28, avgLaborCostPercent: 0.55 },
  healthcare_services: { low: 0.14, high: 0.26, avgLaborCostPercent: 0.50 },
  life_sciences_pharma: { low: 0.15, high: 0.28, avgLaborCostPercent: 0.55 },
  // Consumer & Retail
  retail: { low: 0.15, high: 0.30, avgLaborCostPercent: 0.50 },
  ecommerce_digital: { low: 0.15, high: 0.30, avgLaborCostPercent: 0.35 },
  cpg: { low: 0.15, high: 0.30, avgLaborCostPercent: 0.50 },
  dtc: { low: 0.15, high: 0.30, avgLaborCostPercent: 0.35 },
  food_beverage: { low: 0.13, high: 0.27, avgLaborCostPercent: 0.45 },
  // Industrial & Energy
  manufacturing_discrete: { low: 0.12, high: 0.25, avgLaborCostPercent: 0.25 },
  manufacturing_process: { low: 0.12, high: 0.25, avgLaborCostPercent: 0.25 },
  automotive: { low: 0.12, high: 0.25, avgLaborCostPercent: 0.25 },
  aerospace_defense: { low: 0.14, high: 0.26, avgLaborCostPercent: 0.45 },
  energy_oil_gas: { low: 0.10, high: 0.22, avgLaborCostPercent: 0.30 },
  utilities: { low: 0.10, high: 0.22, avgLaborCostPercent: 0.30 },
  chemicals_materials: { low: 0.11, high: 0.24, avgLaborCostPercent: 0.22 },
  industrial_services: { low: 0.13, high: 0.26, avgLaborCostPercent: 0.35 },
  // Technology
  software_saas: { low: 0.22, high: 0.35, avgLaborCostPercent: 0.50 },
  it_services: { low: 0.20, high: 0.33, avgLaborCostPercent: 0.55 },
  hardware_electronics: { low: 0.22, high: 0.35, avgLaborCostPercent: 0.50 },
  // Infrastructure & Logistics
  transportation: { low: 0.15, high: 0.28, avgLaborCostPercent: 0.55 },
  shipping_logistics: { low: 0.15, high: 0.28, avgLaborCostPercent: 0.55 },
  infrastructure_transport: { low: 0.12, high: 0.24, avgLaborCostPercent: 0.28 },
  construction_engineering: { low: 0.12, high: 0.25, avgLaborCostPercent: 0.25 },
  real_estate_commercial: { low: 0.14, high: 0.25, avgLaborCostPercent: 0.50 },
  real_estate_residential: { low: 0.12, high: 0.23, avgLaborCostPercent: 0.45 },
  // Media & Telecom
  telecommunications: { low: 0.18, high: 0.32, avgLaborCostPercent: 0.40 },
  media_entertainment: { low: 0.18, high: 0.32, avgLaborCostPercent: 0.35 },
  // Public Sector & Non-Profit
  government_federal: { low: 0.12, high: 0.22, avgLaborCostPercent: 0.70 },
  government_state_local: { low: 0.12, high: 0.22, avgLaborCostPercent: 0.72 },
  defense_contractors: { low: 0.14, high: 0.26, avgLaborCostPercent: 0.48 },
  nonprofit_ngo: { low: 0.10, high: 0.20, avgLaborCostPercent: 0.65 },
  // Professional Services
  consulting_services: { low: 0.25, high: 0.35, avgLaborCostPercent: 0.60 },
  legal_services: { low: 0.22, high: 0.35, avgLaborCostPercent: 0.55 },
  accounting_audit: { low: 0.22, high: 0.34, avgLaborCostPercent: 0.58 },
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
  // Financial Services
  insurance: 115000,
  banking: 135000,
  capital_markets: 135000,
  asset_wealth_management: 135000,
  investment_banking: 225000,
  private_equity: 250000,
  venture_capital: 200000,
  hedge_funds: 240000,
  // Healthcare & Life Sciences
  healthcare_providers: 95000,
  healthcare_payers: 95000,
  healthcare_services: 65000,
  life_sciences_pharma: 95000,
  // Consumer & Retail
  retail: 55000,
  ecommerce_digital: 65000,
  cpg: 55000,
  dtc: 65000,
  food_beverage: 50000,
  // Industrial & Energy
  manufacturing_discrete: 85000,
  manufacturing_process: 85000,
  automotive: 85000,
  aerospace_defense: 120000,
  energy_oil_gas: 110000,
  utilities: 110000,
  chemicals_materials: 90000,
  industrial_services: 80000,
  // Technology
  software_saas: 165000,
  it_services: 120000,
  hardware_electronics: 165000,
  // Infrastructure & Logistics
  transportation: 90000,
  shipping_logistics: 90000,
  infrastructure_transport: 85000,
  construction_engineering: 85000,
  real_estate_commercial: 80000,
  real_estate_residential: 75000,
  // Media & Telecom
  telecommunications: 110000,
  media_entertainment: 105000,
  // Public Sector & Non-Profit
  government_federal: 105000,
  government_state_local: 85000,
  defense_contractors: 140000,
  nonprofit_ngo: 65000,
  // Professional Services
  consulting_services: 145000,
  legal_services: 160000,
  accounting_audit: 120000,
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
    `${formatCurrency(unrealizedLow)} to ${formatCurrency(unrealizedHigh)} in unrealized annual value, ` +
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
    `Unrealized Value: ${formatCurrency(estimate.unrealizedValueLow)} to ${formatCurrency(estimate.unrealizedValueHigh)} annually\n` +
    `Wasted Hours: ${estimate.annualWastedHours.toLocaleString()} hours/year`
  );
}

export { formatCurrency };
