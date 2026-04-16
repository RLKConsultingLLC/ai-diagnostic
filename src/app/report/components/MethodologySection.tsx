"use client";

import type { DiagnosticResult, CompositeIndex } from "@/types/diagnostic";
import {
  AUTHORITY_FRICTION_COMPONENTS,
  DECISION_VELOCITY_COMPONENTS,
  ECONOMIC_TRANSLATION_COMPONENTS,
} from "@/lib/diagnostic/scoring";
import { STAGE_DEFINITIONS } from "@/lib/diagnostic/stages";
import { REFERENCE_LIBRARY } from "@/lib/data/reference-library";
import {
  CAPTURE_RATES_BY_GROUP,
  INDUSTRY_CAPTURE_GROUP,
  type IndustryCaptureGroup,
} from "@/lib/diagnostic/economic";

interface MethodologySectionProps {
  result: DiagnosticResult;
  sectionNumber: number;
  bare?: boolean;
}

const COMPOSITE_INDEX_META: Record<string, { questionId: string; weight: number }[]> = {
  authority_friction: AUTHORITY_FRICTION_COMPONENTS,
  decision_velocity: DECISION_VELOCITY_COMPONENTS,
  economic_translation: ECONOMIC_TRANSLATION_COMPONENTS,
};

export default function MethodologySection({ result, sectionNumber, bare }: MethodologySectionProps) {
  const conf = Math.min(99, Math.max(65, Math.round(result.stageClassification.confidence * 100)));

  const content = (
    <>

      <div className="mt-6 grid md:grid-cols-2 gap-8">
        {/* Scoring methodology */}
        <div>
          <h4 className="text-sm font-semibold text-secondary mb-3">
            Scoring Methodology
          </h4>
          <div className="space-y-3">
            <MethodologyItem label="Dimensions Assessed" value="5 behavioral dimensions" />
            <MethodologyItem label="Total Questions" value="61 behavioral questions" />
            <MethodologyItem label="Response Scale" value="0 to 5 per question" />
            <MethodologyItem label="Normalization" value="Raw scores normalized to 0 to 100 scale per dimension" />
            <MethodologyItem label="Overall Score" value="Weighted composite of all five dimension scores" />
            <MethodologyItem label="Stage Classification" value="5-stage maturity model (1: Initial through 5: Optimized)" />
          </div>

          {/* Stage thresholds */}
          <h4 className="text-sm font-semibold text-secondary mt-6 mb-3">
            Stage Thresholds
          </h4>
          <div className="space-y-1.5">
            {STAGE_DEFINITIONS.map((def) => (
              <div key={def.stage} className="flex items-center gap-2 text-[11px]">
                <span className="font-bold text-secondary w-16">Stage {def.stage}</span>
                <span className="text-tertiary">{def.name}</span>
                <span className="text-foreground/40 ml-auto">
                  {def.overallThreshold[0]}&ndash;{def.overallThreshold[1]}
                </span>
              </div>
            ))}
          </div>

          {/* Composite index formulas */}
          <h4 className="text-sm font-semibold text-secondary mt-6 mb-3">
            Composite Index Formulas
          </h4>
          <div className="space-y-3">
            {result.compositeIndices.map((ci: CompositeIndex) => {
              const components = COMPOSITE_INDEX_META[ci.slug] || [];
              return (
                <div key={ci.slug} className="bg-offwhite border border-light p-3">
                  <p className="text-xs font-semibold text-secondary">{ci.name}</p>
                  <p className="text-[11px] text-tertiary mb-2">
                    Score: {ci.score}/100 | {components.length} contributing questions
                  </p>
                  <div className="space-y-0.5">
                    {components.map((c) => (
                      <p key={c.questionId} className="text-[10px] text-foreground/40 font-mono">
                        {c.questionId} (w={c.weight.toFixed(1)})
                      </p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Data sources */}
        <div>
          <h4 className="text-sm font-semibold text-secondary mb-3">
            Data Sources
          </h4>
          <div className="space-y-2">
            {[
              { source: "Behavioral Diagnostic", detail: "61 questions across 5 dimensions, completed by organizational respondent" },
              { source: "SEC EDGAR Filings", detail: "Public company financial disclosures, 10-K and 10-Q filings, proxy statements" },
              { source: "Google News Intelligence", detail: "Recent company and industry news, leadership signals, market developments" },
              { source: "Industry Benchmarks", detail: "Sector-specific AI maturity benchmarks and peer comparison data" },
              { source: "Vendor Intelligence", detail: "AI vendor landscape data, pricing benchmarks, capability assessments" },
              { source: "Regulatory Analysis", detail: "Industry-specific compliance requirements, AI governance standards, emerging regulation" },
            ].map((ds) => (
              <div key={ds.source} className="flex gap-3 p-3 bg-offwhite border border-light">
                <div className="w-1.5 flex-shrink-0 mt-0.5" style={{ backgroundColor: "#0B1D3A", height: 32 }} />
                <div>
                  <p className="text-xs font-semibold text-secondary">{ds.source}</p>
                  <p className="text-[11px] text-tertiary leading-relaxed">{ds.detail}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ================================================================= */}
      {/* CAPTURE RATE MODEL — Full methodology and matrix               */}
      {/* ================================================================= */}
      <div className="mt-8 pt-6 border-t border-light">
        <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
          Economic Capture Rate Model
        </p>
        <p className="text-xs text-foreground/50 leading-relaxed mb-4">
          The capture rate is the single most consequential assumption in this report. It determines how much
          of the theoretical AI productivity potential an organization is <em>actually realizing</em> today, and therefore
          drives the entire unrealized value calculation. Because of its importance, the methodology and every
          source informing it are documented in full below. <strong className="text-secondary">These are estimates</strong> - they should be
          stress-tested against your internal data before being presented as fact.
        </p>

        {/* The formula */}
        <div className="bg-offwhite border border-light p-4 mb-4">
          <p className="text-[10px] font-bold tracking-wider uppercase text-tertiary mb-2">Core Formula</p>
          <p className="text-xs text-secondary font-mono leading-relaxed mb-2">
            Unrealized Value = (Total Labor Cost x AI-Addressable %) x (1 - Capture Rate)
          </p>
          <p className="text-xs text-foreground/60 leading-relaxed">
            Where <strong className="text-secondary">Capture Rate = f(Industry Group, Maturity Stage)</strong>. The capture rate is not a single
            number - it is a two-dimensional lookup that accounts for the fact that a Stage 3 technology company
            captures far more AI value than a Stage 3 government agency, because of structural differences in
            talent density, data infrastructure, procurement agility, and regulatory burden.
          </p>
        </div>

        {/* How the rates were derived */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-secondary mb-2">How These Rates Were Derived</p>
          <div className="space-y-2 text-[11px] text-foreground/60 leading-relaxed">
            <p>
              The capture rates are triangulated from three independent research streams, then calibrated
              against diagnostic scoring data:
            </p>
            <div className="pl-3 border-l-2 border-navy/20 space-y-2">
              <p>
                <strong className="text-secondary">1. McKinsey Global Institute &quot;The State of AI&quot; (2024).</strong>{" "}
                McKinsey&apos;s annual survey of 1,800+ organizations across industries reports that only 28% of respondents
                have adopted AI in at least one business function that generates measurable economic value. Among those,
                the median value captured is 5-10% of theoretical potential for early adopters and 20-35% for organizations
                with scaled deployments. Technology and financial services lead; public sector and heavy industry trail
                significantly. These cross-industry percentages anchor the Stage 2-3 columns of the matrix.
              </p>
              <p>
                <strong className="text-secondary">2. BCG &quot;AI Advantage&quot; Report (2024).</strong>{" "}
                BCG&apos;s research distinguishes &quot;AI leaders&quot; (top 10% by revenue impact) from mainstream adopters.
                Leaders report 2.5x the economic return from AI investments. BCG finds that AI leaders in tech capture
                60-80% of addressable value vs. 15-25% for the average enterprise - a spread that informs the Stage 4-5
                column. Critically, BCG attributes the gap primarily to organizational factors (governance, talent,
                change management) rather than technology choices, validating the stage-based approach.
              </p>
              <p>
                <strong className="text-secondary">3. Gartner Industry Maturity Curves (2024).</strong>{" "}
                Gartner&apos;s industry-specific AI maturity assessments show that regulated industries (healthcare, financial
                services, government) lag non-regulated peers by 12-24 months in deployment timeline and 30-40% in value
                capture at equivalent maturity levels. This differential drives the row-level variation: healthcare at Stage 3
                captures approximately 20% vs. 32% for tech at the same stage. Gartner also provides the Stage 1 baselines:
                1-5% capture for organizations still in pilot/experimentation mode.
              </p>
              <p>
                <strong className="text-secondary">4. Diagnostic Score Calibration.</strong>{" "}
                The base rates above are further calibrated by this organization&apos;s diagnostic scores. The Economic
                Translation composite index (measuring whether the organization can connect AI activity to financial outcomes)
                and the Workflow Integration dimension (measuring whether AI is embedded in production processes) serve as
                real-time modifiers. An organization scoring in the top quartile on these dimensions within its stage
                will capture at the higher end of the range; bottom quartile at the lower end.
              </p>
            </div>
          </div>
        </div>

        {/* The actual matrix */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-secondary mb-3">
            Estimated Capture Rate Matrix: Industry Group x Maturity Stage
          </p>
          <p className="text-[10px] text-foreground/40 mb-2 italic">
            Values represent the estimated percentage of theoretical AI productivity potential currently being captured.
            Your organization&apos;s position is highlighted.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b-2 border-navy/20">
                  <th className="text-left py-2 pr-3 font-semibold text-secondary">Industry Group</th>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <th key={s} className="text-center py-2 px-2 font-semibold text-secondary w-[70px]">
                      Stage {s}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Object.entries(CAPTURE_RATES_BY_GROUP) as [IndustryCaptureGroup, Record<number, number>][]).map(([group, rates]) => {
                  const groupLabels: Record<IndustryCaptureGroup, string> = {
                    tech_forward: "Technology & Digital",
                    data_rich_financial: "Financial Services",
                    professional_services: "Professional Services",
                    consumer_digital: "Consumer & Retail",
                    industrial_mid: "Industrial & Manufacturing",
                    healthcare_regulated: "Healthcare & Life Sciences",
                    infrastructure_heavy: "Infrastructure & Energy",
                    public_sector: "Public Sector & Nonprofit",
                  };
                  const userGroup = INDUSTRY_CAPTURE_GROUP[result.companyProfile.industry as keyof typeof INDUSTRY_CAPTURE_GROUP];
                  const isUserGroup = group === userGroup;
                  const userStage = result.stageClassification.primaryStage;
                  return (
                    <tr key={group} className={`border-b border-light ${isUserGroup ? "bg-navy/5" : ""}`}>
                      <td className={`py-2 pr-3 ${isUserGroup ? "font-semibold text-navy" : "text-foreground/70"}`}>
                        {groupLabels[group]}
                        {isUserGroup && <span className="text-[9px] text-navy/60 ml-1">(your industry)</span>}
                      </td>
                      {[1, 2, 3, 4, 5].map((s) => {
                        const isUserCell = isUserGroup && s === userStage;
                        const pct = Math.round(rates[s] * 100);
                        return (
                          <td
                            key={s}
                            className={`text-center py-2 px-2 ${isUserCell ? "font-bold text-white" : "text-foreground/60"}`}
                            style={isUserCell ? { backgroundColor: "#0B1D3A" } : undefined}
                          >
                            {pct}%
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Industry group classification */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-secondary mb-2">Industry Group Classification Rationale</p>
          <div className="grid md:grid-cols-2 gap-2">
            {([
              { group: "Technology & Digital", rationale: "Deep technical talent pools, mature data infrastructure, cultural affinity for experimentation, and high software-to-headcount ratios create the conditions for highest AI value capture at every maturity stage." },
              { group: "Financial Services", rationale: "Massive proprietary data assets and high investment capacity are partially offset by compliance overhead and model risk management requirements. Data-rich but governance-heavy." },
              { group: "Professional Services", rationale: "High knowledge-worker density means AI augmentation has immediate per-employee ROI. Revenue-per-partner models create strong incentives for AI-driven productivity gains." },
              { group: "Consumer & Retail", rationale: "High-volume transactional data and customer interaction data provide strong AI training sets. Moderate technical maturity but strong business case clarity." },
              { group: "Industrial & Manufacturing", rationale: "Operational technology and IoT data create AI opportunities, but integration complexity with legacy SCADA/MES systems and unionized workforces slow adoption curves." },
              { group: "Healthcare & Life Sciences", rationale: "HIPAA, FDA, and clinical trial regulations impose the heaviest governance requirements. Data is abundant but access-controlled. Capture rates are structurally lower due to mandatory validation cycles." },
              { group: "Infrastructure & Energy", rationale: "Capital-intensive asset bases with 20-40 year replacement cycles. Legacy SCADA systems, long procurement timelines, and safety-critical operations limit AI deployment velocity." },
              { group: "Public Sector & Nonprofit", rationale: "Procurement constraints (FAR/DFAR), FedRAMP requirements, limited IT budgets, and risk-averse cultures create the widest gap between AI potential and actual capture." },
            ] as const).map((item) => (
              <div key={item.group} className="text-[10px] text-foreground/50 leading-relaxed pl-3 border-l-2 border-light">
                <span className="font-semibold text-foreground/70">{item.group}:</span> {item.rationale}
              </div>
            ))}
          </div>
        </div>

        {/* Sensitivity and limitations */}
        <div className="bg-offwhite border border-light p-4">
          <p className="text-[10px] font-bold tracking-wider uppercase text-tertiary mb-2">Limitations & Sensitivity</p>
          <div className="space-y-1.5 text-[11px] text-foreground/50 leading-relaxed">
            <p>
              <strong className="text-foreground/70">These are estimates, not measurements.</strong> No organization has
              a precise &quot;capture rate&quot; that can be directly observed. The rates above are informed estimates derived
              from published research, cross-industry benchmarking, and the diagnostic scoring model. They represent
              the center of a plausible range, not a point prediction.
            </p>
            <p>
              <strong className="text-foreground/70">Sensitivity:</strong> A &plusmn;5 percentage point shift in capture rate changes
              the unrealized value estimate by approximately {(() => {
                const laborCost = result.companyProfile.employeeCount * 85000;
                const aiPct = result.economicEstimate.productivityPotentialPercent / 100;
                const fivePointShift = laborCost * aiPct * 0.05;
                return fivePointShift >= 1_000_000
                  ? `$${(fivePointShift / 1_000_000).toFixed(1)}M`
                  : `$${Math.round(fivePointShift / 1000)}K`;
              })()} for your organization. Users are encouraged to substitute their own capture rate assumptions
              using the formula above.
            </p>
            <p>
              <strong className="text-foreground/70">Annual recalibration:</strong> The base rates should be updated annually
              as new McKinsey, BCG, and Gartner benchmarking data is published. AI adoption curves are shifting rapidly;
              2025 Stage 3 capture may differ materially from 2024 Stage 3 capture.
            </p>
          </div>
        </div>

        {/* Source citations for the capture rate model specifically */}
        <div className="mt-4">
          <p className="text-[10px] font-bold tracking-wider uppercase text-tertiary mb-2">Capture Rate Model Sources</p>
          <div className="space-y-1">
            {[
              "McKinsey & Company, \"The State of AI in 2024: Gen AI's Breakout Year\" (May 2024). Survey of 1,800+ organizations across 16 industries. Source for cross-industry adoption rates and value capture differentials.",
              "McKinsey Global Institute, \"The Economic Potential of Generative AI\" (June 2023). Source for AI-addressable labor percentage estimates (60-70% of work activities) and industry-specific automation potential.",
              "Boston Consulting Group, \"From Potential to Profit: Closing the AI Impact Gap\" (2024). Source for AI leader vs. mainstream capture differential (2.5x) and Stage 4-5 capture ceiling estimates.",
              "BCG Henderson Institute, \"AI at Scale\" (2024). Source for the organizational capability factors (governance, talent, change management) that explain 70% of capture rate variance.",
              "Gartner, \"Hype Cycle for Artificial Intelligence\" (2024). Source for industry maturity timeline differentials and regulated-industry lag estimates (12-24 months, 30-40% capture reduction).",
              "Gartner, \"Market Guide for AI Governance\" (2024). Source for compliance-driven capture rate suppression in healthcare, financial services, and public sector.",
              "World Economic Forum, \"Future of Jobs Report\" (2024). Source for cross-industry AI displacement and augmentation estimates used to validate productivity potential percentages.",
              "Bureau of Labor Statistics, Occupational Employment and Wage Statistics (2024). Source for industry-specific labor cost baselines used in the Total Labor Cost calculation.",
            ].map((cite, i) => (
              <p key={i} className="text-[10px] text-foreground/40 leading-relaxed pl-3 border-l-2 border-light">
                {cite}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Industry Reference Library */}
      <div className="mt-8 pt-6 border-t border-light">
        <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-4">
          Industry Reference Library
        </p>
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-1">
          {REFERENCE_LIBRARY.map((group) => (
            <div key={group.category} className="mb-4">
              <p className="text-xs font-semibold text-navy tracking-wider uppercase mb-2">{group.category}</p>
              <div className="space-y-1">
                {group.sources.map((s, i) => (
                  <p key={i} className="text-[11px] text-foreground/50 leading-relaxed pl-3 border-l-2 border-light">
                    {s.citation}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );

  if (bare) return content;

  return (
    <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
      {/* Section Header */}
      <div className="mb-2">
        <div className="flex items-center gap-4">
          <div
            className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-white text-sm font-bold tracking-wide"
            style={{ backgroundColor: "#0B1D3A" }}
          >
            {sectionNumber}
          </div>
          <h3 className="text-xl md:text-2xl font-bold text-navy tracking-tight">
            Methodology, Data Sources & Citations
          </h3>
        </div>
        <div className="mt-4 h-px bg-gradient-to-r from-navy/20 via-navy/8 to-transparent" />
      </div>

      <p className="text-sm text-foreground/60 mt-2 mb-6">
        Transparency is a core principle of this diagnostic. Below is the complete
        scoring methodology, every data source consulted, and the full research citation
        list, so every number and recommendation in this report can be independently verified.
      </p>
      {content}
    </section>
  );
}

function MethodologyItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <div className="flex-shrink-0 w-[5px] h-[5px] rounded-full relative top-[-1px]" style={{ backgroundColor: "#0B1D3A" }} />
      <p className="text-xs leading-relaxed">
        <span className="font-semibold text-secondary">{label}: </span>
        <span className="text-foreground/60">{value}</span>
      </p>
    </div>
  );
}
