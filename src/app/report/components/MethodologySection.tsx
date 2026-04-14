"use client";

import type { DiagnosticResult, CompositeIndex } from "@/types/diagnostic";
import {
  AUTHORITY_FRICTION_COMPONENTS,
  DECISION_VELOCITY_COMPONENTS,
  ECONOMIC_TRANSLATION_COMPONENTS,
} from "@/lib/diagnostic/scoring";
import { STAGE_DEFINITIONS } from "@/lib/diagnostic/stages";
import { REFERENCE_LIBRARY } from "@/lib/data/reference-library";

interface MethodologySectionProps {
  result: DiagnosticResult;
  sectionNumber: number;
}

const COMPOSITE_INDEX_META: Record<string, { questionId: string; weight: number }[]> = {
  authority_friction: AUTHORITY_FRICTION_COMPONENTS,
  decision_velocity: DECISION_VELOCITY_COMPONENTS,
  economic_translation: ECONOMIC_TRANSLATION_COMPONENTS,
};

export default function MethodologySection({ result, sectionNumber }: MethodologySectionProps) {
  const conf = Math.min(99, Math.max(65, Math.round(result.stageClassification.confidence * 100)));

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

          {/* Confidence indicator */}
          <div className="mt-6 p-4 border border-light">
            <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
              Report Confidence Level
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-offwhite border border-light overflow-hidden">
                <div className="h-full" style={{ width: `${conf}%`, backgroundColor: "#0B1D3A" }} />
              </div>
              <span className="text-sm font-bold text-secondary">{conf}%</span>
            </div>
            <p className="text-[11px] text-tertiary mt-2">
              {conf >= 90
                ? "High confidence. Dimension scores are highly consistent, indicating coherent organizational AI posture across all five behavioral dimensions."
                : conf >= 75
                ? "Strong confidence. Dimension scores show some variance across organizational areas, which is typical in organizations where AI maturity has progressed unevenly across departments."
                : "Moderate confidence. Notable variance across dimensions or response quality factors. Findings are triangulated against industry benchmarks and research data."}
            </p>
            {result.stageClassification.confidenceFactors && (
              <div className="mt-3 space-y-1">
                {Object.entries(result.stageClassification.confidenceFactors).map(([factor, value]) => (
                  <p key={factor} className="text-[10px] text-foreground/35 font-mono">
                    {factor}: {(value as number) > 0 ? '+' : ''}{((value as number) * 100).toFixed(1)}%
                  </p>
                ))}
              </div>
            )}
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
