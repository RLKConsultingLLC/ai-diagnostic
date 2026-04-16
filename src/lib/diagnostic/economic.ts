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
import { getAllSources } from './economic-sources';

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
// INDUSTRY x STAGE CAPTURE RATES (2D lookup)
// ---------------------------------------------------------------------------
// What % of theoretical AI productivity potential the org is actually capturing.
// Varies by BOTH maturity stage AND industry — tech-forward industries capture
// more at every stage; heavily regulated / resource-constrained industries
// capture less. Based on McKinsey 2024 Global AI Survey cross-tabs,
// BCG AI Advantage Report peer analytics, and Gartner industry maturity curves.

export type IndustryCaptureGroup = 'tech_forward' | 'data_rich_financial' | 'professional_services' | 'consumer_digital' | 'industrial_mid' | 'healthcare_regulated' | 'infrastructure_heavy' | 'public_sector';

export const INDUSTRY_CAPTURE_GROUP: Record<Industry, IndustryCaptureGroup> = {
  // Tech-forward: deep technical talent, data infrastructure, cultural readiness
  software_saas: 'tech_forward',
  it_services: 'tech_forward',
  hardware_electronics: 'tech_forward',
  ecommerce_digital: 'tech_forward',
  media_entertainment: 'tech_forward',
  dtc: 'tech_forward',
  // Data-rich financial: massive data assets, high investment capacity, moderate regulation
  banking: 'data_rich_financial',
  capital_markets: 'data_rich_financial',
  asset_wealth_management: 'data_rich_financial',
  insurance: 'data_rich_financial',
  investment_banking: 'data_rich_financial',
  private_equity: 'data_rich_financial',
  venture_capital: 'data_rich_financial',
  hedge_funds: 'data_rich_financial',
  // Professional services: high knowledge-worker ratio, strong ROI from AI augmentation
  consulting_services: 'professional_services',
  legal_services: 'professional_services',
  accounting_audit: 'professional_services',
  // Consumer / retail: moderate technical maturity, high volume data
  retail: 'consumer_digital',
  cpg: 'consumer_digital',
  food_beverage: 'consumer_digital',
  telecommunications: 'consumer_digital',
  // Industrial mid-tier: operational technology, growing AI adoption
  manufacturing_discrete: 'industrial_mid',
  manufacturing_process: 'industrial_mid',
  automotive: 'industrial_mid',
  aerospace_defense: 'industrial_mid',
  defense_contractors: 'industrial_mid',
  chemicals_materials: 'industrial_mid',
  industrial_services: 'industrial_mid',
  construction_engineering: 'industrial_mid',
  shipping_logistics: 'industrial_mid',
  transportation: 'industrial_mid',
  // Healthcare regulated: high compliance burden, complex data governance
  healthcare_providers: 'healthcare_regulated',
  healthcare_payers: 'healthcare_regulated',
  healthcare_services: 'healthcare_regulated',
  life_sciences_pharma: 'healthcare_regulated',
  // Infrastructure heavy: legacy systems, capital-intensive, slow procurement
  energy_oil_gas: 'infrastructure_heavy',
  utilities: 'infrastructure_heavy',
  infrastructure_transport: 'infrastructure_heavy',
  real_estate_commercial: 'infrastructure_heavy',
  real_estate_residential: 'infrastructure_heavy',
  // Public sector: procurement constraints, limited budgets, risk aversion
  government_federal: 'public_sector',
  government_state_local: 'public_sector',
  nonprofit_ngo: 'public_sector',
};

export const CAPTURE_RATES_BY_GROUP: Record<IndustryCaptureGroup, Record<StageNumber, number>> = {
  // Tech companies capture more at every stage — talent, infra, and culture already exist
  tech_forward:          { 1: 0.05, 2: 0.15, 3: 0.32, 4: 0.62, 5: 0.85 },
  // Financial services: massive data and investment capacity, but compliance slows deployment
  data_rich_financial:   { 1: 0.03, 2: 0.12, 3: 0.28, 4: 0.58, 5: 0.82 },
  // Professional services: knowledge workers see immediate ROI from AI augmentation
  professional_services: { 1: 0.04, 2: 0.14, 3: 0.30, 4: 0.60, 5: 0.84 },
  // Consumer: decent data infrastructure, moderate tech maturity
  consumer_digital:      { 1: 0.03, 2: 0.11, 3: 0.26, 4: 0.54, 5: 0.80 },
  // Industrial: operational AI growing, but integration complexity is higher
  industrial_mid:        { 1: 0.02, 2: 0.08, 3: 0.22, 4: 0.48, 5: 0.75 },
  // Healthcare: regulatory burden and data privacy constraints slow capture
  healthcare_regulated:  { 1: 0.02, 2: 0.07, 3: 0.20, 4: 0.45, 5: 0.72 },
  // Infrastructure: legacy systems and capital intensity limit AI velocity
  infrastructure_heavy:  { 1: 0.01, 2: 0.06, 3: 0.18, 4: 0.42, 5: 0.70 },
  // Public sector: procurement, budget, and risk aversion create the widest capture gap
  public_sector:         { 1: 0.01, 2: 0.05, 3: 0.15, 4: 0.38, 5: 0.65 },
};

function getCaptureRate(industry: Industry, stage: StageNumber): number {
  const group = INDUSTRY_CAPTURE_GROUP[industry];
  return CAPTURE_RATES_BY_GROUP[group][stage];
}

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
  const warnings: string[] = [];
  const industry = profile.industry;
  const potential = INDUSTRY_PRODUCTIVITY_POTENTIAL[industry];
  const captureRate = getCaptureRate(industry, stage.primaryStage);
  const sizeMultiplier = getSizeMultiplier(profile.employeeCount);
  let costPerEmployee = AVG_COST_PER_EMPLOYEE[industry];

  // --- GUARDRAILS ---
  const revenuePerEmployee = profile.revenue / Math.max(profile.employeeCount, 1);

  // Revenue-per-employee sanity check: clamp effective labor cost
  if (revenuePerEmployee < 10_000) {
    warnings.push('Revenue per employee is unusually low. Economic estimates have been adjusted.');
    costPerEmployee = Math.min(costPerEmployee, revenuePerEmployee * 3);
  } else if (revenuePerEmployee > 5_000_000) {
    warnings.push('Revenue per employee is unusually high. Economic estimates have been adjusted.');
  }

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

  // Unrealized value — floor at $0, cap at 50% of revenue
  let unrealizedLow = Math.max(0, productivityPotentialLow * (1 - captureRate));
  let unrealizedHigh = Math.max(0, productivityPotentialHigh * (1 - captureRate));
  const revenueCap = profile.revenue * 0.5;
  if (unrealizedHigh > revenueCap) {
    warnings.push('Unrealized value estimates capped at 50% of revenue.');
    unrealizedHigh = revenueCap;
    unrealizedLow = Math.min(unrealizedLow, revenueCap * 0.7);
  }

  // Wasted hours calculation — cap at 50% of total available hours
  const hoursPerEmployee = 2080; // Standard work year
  const maxWasteableHours = profile.employeeCount * hoursPerEmployee * 0.5;
  const potentialHoursSaved = profile.employeeCount *
    hoursPerEmployee *
    ((potential.low + potential.high) / 2);
  const hoursCaptured = potentialHoursSaved * captureRate;
  let annualWastedHours = Math.round(potentialHoursSaved - hoursCaptured);
  if (annualWastedHours > maxWasteableHours) {
    annualWastedHours = Math.round(maxWasteableHours);
    warnings.push('Wasted hours capped at 50% of total available labor hours.');
  }

  // Industry benchmark narrative
  const industryBenchmark = buildBenchmarkNarrative(
    industry,
    stage.primaryStage,
    unrealizedLow,
    unrealizedHigh,
    profile.revenue
  );

  // Suppress capturedValue usage warning
  void capturedValue;

  return {
    productivityPotentialPercent: Math.round(productivityPotentialPercent),
    currentCapturePercent: Math.round(currentCapturePercent),
    unrealizedValueLow: roundToSignificantFigures(unrealizedLow, 2),
    unrealizedValueHigh: roundToSignificantFigures(unrealizedHigh, 2),
    annualWastedHours,
    costPerEmployee,
    industryBenchmark,
    warnings: warnings.length > 0 ? warnings : undefined,
    sources: getAllSources(industry),
  };
}

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function formatIndustryName(industry: Industry): string {
  const labels: Partial<Record<Industry, string>> = {
    insurance: 'Insurance', banking: 'Banking', capital_markets: 'Capital Markets',
    asset_wealth_management: 'Asset & Wealth Management', investment_banking: 'Investment Banking',
    private_equity: 'Private Equity', venture_capital: 'Venture Capital', hedge_funds: 'Hedge Funds',
    healthcare_providers: 'Healthcare', healthcare_payers: 'Healthcare Payer',
    healthcare_services: 'Healthcare Services', life_sciences_pharma: 'Life Sciences & Pharma',
    retail: 'Retail', ecommerce_digital: 'E-Commerce', cpg: 'Consumer Packaged Goods',
    dtc: 'Direct-to-Consumer', food_beverage: 'Food & Beverage',
    manufacturing_discrete: 'Manufacturing', manufacturing_process: 'Process Manufacturing',
    automotive: 'Automotive', aerospace_defense: 'Aerospace & Defense',
    energy_oil_gas: 'Energy', utilities: 'Utilities',
    chemicals_materials: 'Chemicals & Materials', industrial_services: 'Industrial Services',
    software_saas: 'Software & SaaS', it_services: 'IT Services',
    hardware_electronics: 'Technology Hardware', transportation: 'Transportation',
    shipping_logistics: 'Shipping & Logistics', infrastructure_transport: 'Infrastructure & Transport',
    construction_engineering: 'Construction & Engineering',
    real_estate_commercial: 'Commercial Real Estate', real_estate_residential: 'Residential Real Estate',
    telecommunications: 'Telecommunications', media_entertainment: 'Media & Entertainment',
    government_federal: 'Federal Government', government_state_local: 'State & Local Government',
    defense_contractors: 'Defense Contracting', nonprofit_ngo: 'Non-Profit',
    consulting_services: 'Consulting & Professional Services',
    legal_services: 'Legal Services', accounting_audit: 'Accounting & Audit',
  };
  return labels[industry] || industry.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

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
  const unrealizedPercent = revenue > 0
    ? ((unrealizedLow + unrealizedHigh) / 2 / revenue) * 100
    : 0;
  const stageLabel = [
    '',
    'Tool Curiosity',
    'Pilot Proliferation',
    'Managed Deployment',
    'Operational Integration',
    'AI-Native Enterprise',
  ][stage];

  const capturePercent = getCaptureRate(industry, stage) * 100;

  const label = formatIndustryName(industry);

  return (
    `${label} organizations at the "${stageLabel}" stage typically capture ` +
    `approximately ${capturePercent}% of their potential AI value, based on McKinsey and BCG industry benchmarks. ` +
    `For a ${label.toLowerCase()} organization of your size, this represents an estimated ` +
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
