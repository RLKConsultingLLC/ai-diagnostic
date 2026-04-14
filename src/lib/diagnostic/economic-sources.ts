// =============================================================================
// RLK AI Diagnostic — Economic Model Source Citations
// =============================================================================
// Provenance for every constant in the economic model. Makes the $497 product
// defensible when a CFO asks "where did you get these numbers?"
// =============================================================================

import type { Industry, StageNumber } from '@/types/diagnostic';

export interface EconomicSource {
  name: string;
  metric: string;
  year: number;
  url?: string;
}

// ---------------------------------------------------------------------------
// PRODUCTIVITY POTENTIAL SOURCES
// ---------------------------------------------------------------------------
// These estimates are derived from cross-referencing multiple industry reports
// on the percentage of labor tasks that are AI-addressable.

const PRODUCTIVITY_SOURCES_BASE: EconomicSource[] = [
  {
    name: 'McKinsey Global Institute — A New Future of Work',
    metric: 'Share of work activities automatable by AI',
    year: 2024,
    url: 'https://www.mckinsey.com/mgi/our-research',
  },
  {
    name: 'Goldman Sachs — The Potentially Large Effects of AI on Economic Growth',
    metric: 'Percentage of work tasks exposed to automation by AI',
    year: 2023,
    url: 'https://www.goldmansachs.com/insights/pages/generative-ai-could-raise-global-gdp-by-7-percent.html',
  },
  {
    name: 'World Economic Forum — Future of Jobs Report',
    metric: 'Task displacement and augmentation rates',
    year: 2024,
    url: 'https://www.weforum.org/publications/the-future-of-jobs-report-2025/',
  },
];

const INDUSTRY_SPECIFIC_SOURCES: Partial<Record<Industry, EconomicSource[]>> = {
  banking: [
    { name: 'Accenture — Banking on AI', metric: 'AI-addressable FTE hours in banking', year: 2024 },
  ],
  insurance: [
    { name: 'Deloitte — AI in Insurance', metric: 'Claims and underwriting automation potential', year: 2024 },
  ],
  healthcare_providers: [
    { name: 'Harvard Business Review — AI in Healthcare Operations', metric: 'Administrative task automation rate', year: 2024 },
  ],
  software_saas: [
    { name: 'GitHub — Octoverse Developer Survey', metric: 'Developer productivity gains from AI coding tools', year: 2024 },
  ],
  manufacturing_discrete: [
    { name: 'Deloitte — Smart Factory Study', metric: 'Predictive maintenance and quality AI potential', year: 2024 },
  ],
  retail: [
    { name: 'NRF — State of Retail Technology', metric: 'AI adoption in demand forecasting and personalization', year: 2024 },
  ],
  consulting_services: [
    { name: 'BCG — How Consulting Firms Use AI', metric: 'Proposal and research automation rates', year: 2024 },
  ],
};

// ---------------------------------------------------------------------------
// LABOR COST SOURCES
// ---------------------------------------------------------------------------

const LABOR_COST_SOURCES: EconomicSource[] = [
  {
    name: 'U.S. Bureau of Labor Statistics — Occupational Employment and Wage Statistics',
    metric: 'Median annual wages by industry sector',
    year: 2024,
    url: 'https://www.bls.gov/oes/',
  },
  {
    name: 'U.S. Bureau of Labor Statistics — Employer Costs for Employee Compensation',
    metric: 'Total compensation including benefits (1.3–1.4x base salary)',
    year: 2024,
    url: 'https://www.bls.gov/ncs/ect/',
  },
];

// ---------------------------------------------------------------------------
// CAPTURE RATE SOURCES
// ---------------------------------------------------------------------------

const CAPTURE_RATE_SOURCES: EconomicSource[] = [
  {
    name: 'McKinsey — The State of AI in 2024',
    metric: 'Percentage of organizations reporting measurable ROI from AI by maturity level',
    year: 2024,
    url: 'https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai',
  },
  {
    name: 'MIT Sloan Management Review — AI Maturity and Value Capture',
    metric: 'Value realization rates across AI maturity stages',
    year: 2024,
  },
  {
    name: 'Gartner — AI Maturity Model',
    metric: 'ROI benchmarks by AI adoption stage',
    year: 2024,
  },
];

// ---------------------------------------------------------------------------
// PUBLIC API
// ---------------------------------------------------------------------------

export function getSourcesForIndustry(industry: Industry): EconomicSource[] {
  return [
    ...PRODUCTIVITY_SOURCES_BASE,
    ...(INDUSTRY_SPECIFIC_SOURCES[industry] || []),
    ...LABOR_COST_SOURCES,
  ];
}

export function getSourcesForCaptureRates(): EconomicSource[] {
  return CAPTURE_RATE_SOURCES;
}

export function getAllSources(industry: Industry): EconomicSource[] {
  return [
    ...getSourcesForIndustry(industry),
    ...getSourcesForCaptureRates(),
  ];
}
