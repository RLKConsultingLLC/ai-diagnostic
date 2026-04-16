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
      { citation: 'McKinsey & Company, "The State of AI in Early 2024," Global AI Survey, 2024', lastVerified: '2025-04-15' },
      { citation: 'BCG, "From Potential to Profit with GenAI," BCG AI Radar, January 2024', lastVerified: '2025-04-15' },
      { citation: 'Deloitte, "State of Generative AI in the Enterprise," Now Decides Next survey, 2024', lastVerified: '2025-04-15' },
      { citation: 'Gartner, "Gartner AI Maturity Model," November 2024', lastVerified: '2025-04-15' },
      { citation: 'Accenture, "Technology Vision 2024: Human by Design"', lastVerified: '2025-04-15' },
      { citation: 'Goldman Sachs, "The Potentially Large Effects of Artificial Intelligence on Economic Growth," Global Economics Research, March 2023', lastVerified: '2025-04-15' },
    ],
  },
  {
    category: 'Governance & Board Oversight',
    sources: [
      { citation: 'National Association of Corporate Directors (NACD), "Technology Leadership in the Boardroom: Driving Trust and Value," Blue Ribbon Commission Report, October 2024', lastVerified: '2025-04-15' },
      { citation: 'World Economic Forum, "AI Governance Alliance: Briefing Paper Series," Presidio AI Framework, January 2024', lastVerified: '2025-04-15' },
      { citation: 'Gartner, "AI Trust, Risk and Security Management (AI TRiSM)," 2024', lastVerified: '2025-04-15' },
      { citation: 'IBM, "Cost of a Data Breach Report," July 2024', lastVerified: '2025-04-15' },
    ],
  },
  {
    category: 'Regulatory & Compliance',
    sources: [
      { citation: 'European Union, "EU AI Act" (Regulation 2024/1689), entered into force August 1, 2024; GPAI obligations August 2, 2025', lastVerified: '2025-04-15' },
      { citation: 'State of Colorado, "Colorado AI Act" (SB24-205), consumer protections for high-risk AI systems, signed May 2024', lastVerified: '2025-04-15' },
      { citation: 'California Legislature, "California AI Transparency Act" (SB-942), signed September 2024', lastVerified: '2025-04-15' },
      { citation: 'White House Executive Order 14110 on Safe, Secure, and Trustworthy AI, October 30, 2023', lastVerified: '2025-04-15' },
    ],
  },
  {
    category: 'Vendor & Market Intelligence',
    sources: [
      { citation: 'Gartner Magic Quadrant for Cloud AI Developer Services, April 2024', lastVerified: '2025-04-15' },
      { citation: 'Forrester Wave: AI Foundation Models for Language, Q2 2024', lastVerified: '2025-04-15' },
      { citation: 'Forrester Wave: AI Services, Q2 2024', lastVerified: '2025-04-15' },
      { citation: 'Gartner Market Guide for AI Trust, Risk and Security Management, February 2025', lastVerified: '2025-04-15' },
    ],
  },
  {
    category: 'Economic Methodology',
    sources: [
      { citation: 'Bureau of Labor Statistics, Occupational Employment and Wage Statistics, May 2024', lastVerified: '2025-04-15' },
      { citation: 'McKinsey Global Institute, "The Economic Potential of Generative AI: The Next Productivity Frontier," June 2023', lastVerified: '2025-04-15' },
      { citation: 'BCG, "Where\'s the Value in AI?" October 2024', lastVerified: '2025-04-15' },
      { citation: 'Deloitte, "AI Dossier," Deloitte AI Institute, 2024', lastVerified: '2025-04-15' },
    ],
  },
  {
    category: 'Company-Specific Research Methods',
    sources: [
      { citation: 'Company 10-K and 10-Q filings via SEC EDGAR (for public company analysis)', lastVerified: '2025-04-15' },
      { citation: 'Google News intelligence aggregation (company and industry signals)', lastVerified: '2025-04-15' },
      { citation: 'Industry analyst reports and conference proceedings (sector-specific)', lastVerified: '2025-04-15' },
      { citation: 'Patent filings and R&D disclosures (competitive intelligence)', lastVerified: '2025-04-15' },
    ],
  },
];
