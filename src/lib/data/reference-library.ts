// =============================================================================
// RLK AI Diagnostic — Industry Reference Library
// =============================================================================
// Centralized, verified reference citations used across the report.
// Labeled as "Industry Reference Library" — not "Sources Consulted" — to
// distinguish from company-specific research data.
// =============================================================================

export interface ReferenceEntry {
  citation: string;
  lastVerified: string; // YYYY-MM-DD
}

export interface ReferenceCategory {
  category: string;
  sources: ReferenceEntry[];
}

export const REFERENCE_LIBRARY: ReferenceCategory[] = [
  {
    category: 'Industry Research',
    sources: [
      { citation: 'McKinsey & Company, "The State of AI in 2024: Gen AI\'s Breakout Year," Global AI Survey, 2024', lastVerified: '2025-03-01' },
      { citation: 'BCG Henderson Institute, "From Potential to Profit: The AI Advantage Report," 2024', lastVerified: '2025-03-01' },
      { citation: 'Deloitte, "State of AI in the Enterprise, 6th Edition," 2024', lastVerified: '2025-03-01' },
      { citation: 'Gartner, "AI Maturity Model for Enterprise Organizations," 2024', lastVerified: '2025-03-01' },
      { citation: 'Accenture, "Technology Vision 2024: Human by Design"', lastVerified: '2025-03-01' },
      { citation: 'Goldman Sachs, "Generative AI: The Economic Impact," Global Economics Research, 2024', lastVerified: '2025-03-01' },
    ],
  },
  {
    category: 'Governance & Board Oversight',
    sources: [
      { citation: 'National Association of Corporate Directors (NACD), "Board Oversight of AI," 2024', lastVerified: '2025-03-01' },
      { citation: 'World Economic Forum, "AI Governance Alliance: Responsible AI Framework," 2024', lastVerified: '2025-03-01' },
      { citation: 'Gartner, "AI Trust, Risk and Security Management (AI TRiSM)," 2024', lastVerified: '2025-03-01' },
      { citation: 'IBM, "Cost of a Data Breach Report," 2024', lastVerified: '2025-03-01' },
    ],
  },
  {
    category: 'Regulatory & Compliance',
    sources: [
      { citation: 'European Union, "EU AI Act" (Regulation 2024/1689), effective August 2025', lastVerified: '2025-03-01' },
      { citation: 'State of Colorado, "Colorado AI Act" (SB21-169), consumer protections', lastVerified: '2025-03-01' },
      { citation: 'California Legislature, "AI Transparency Act" and related proposals', lastVerified: '2025-03-01' },
      { citation: 'White House Executive Order on Safe, Secure, and Trustworthy AI, October 2023', lastVerified: '2025-03-01' },
    ],
  },
  {
    category: 'Vendor & Market Intelligence',
    sources: [
      { citation: 'Gartner Magic Quadrant for Cloud AI Developer Services, 2024', lastVerified: '2025-03-01' },
      { citation: 'Forrester Wave: AI Foundation Models, 2024', lastVerified: '2025-03-01' },
      { citation: 'Forrester Wave: AI Strategy Consulting, 2024', lastVerified: '2025-03-01' },
      { citation: 'Gartner Market Guide for AI Trust, Risk and Security Management, 2024', lastVerified: '2025-03-01' },
    ],
  },
  {
    category: 'Economic Methodology',
    sources: [
      { citation: 'Bureau of Labor Statistics, Occupational Employment and Wage Statistics, 2024', lastVerified: '2025-03-01' },
      { citation: 'McKinsey Global Institute, "The Economic Potential of Generative AI," 2024', lastVerified: '2025-03-01' },
      { citation: 'BCG, "Where Value Comes from in AI," 2024', lastVerified: '2025-03-01' },
      { citation: 'Deloitte, "Measuring AI ROI: A Practical Guide for Enterprises," 2024', lastVerified: '2025-03-01' },
    ],
  },
  {
    category: 'Company-Specific Research Methods',
    sources: [
      { citation: 'Company 10-K and 10-Q filings via SEC EDGAR (for public company analysis)', lastVerified: '2025-03-01' },
      { citation: 'Google News intelligence aggregation (company and industry signals)', lastVerified: '2025-03-01' },
      { citation: 'Industry analyst reports and conference proceedings (sector-specific)', lastVerified: '2025-03-01' },
      { citation: 'Patent filings and R&D disclosures (competitive intelligence)', lastVerified: '2025-03-01' },
    ],
  },
];
