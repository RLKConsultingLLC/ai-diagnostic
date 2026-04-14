"use client";

import type { SensitivityResult } from "@/types/diagnostic";

interface SensitivitySectionProps {
  sensitivity: SensitivityResult;
  sectionNumber: number;
}

const DIMENSION_LABELS: Record<string, string> = {
  adoption_behavior: "Adoption Behavior",
  authority_structure: "Authority Structure",
  workflow_integration: "Workflow Integration",
  decision_velocity: "Decision Velocity",
  economic_translation: "Economic Translation",
};

export default function SensitivitySection({ sensitivity, sectionNumber }: SensitivitySectionProps) {
  if (!sensitivity.topImpactQuestions.length) return null;

  const maxDelta = Math.max(...sensitivity.topImpactQuestions.map((q) => q.overallDelta));

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
            Sensitivity Analysis
          </h3>
        </div>
        <div className="mt-4 h-px bg-gradient-to-r from-navy/20 via-navy/8 to-transparent" />
      </div>

      <p className="text-sm text-foreground/60 mt-2 mb-6">
        Which diagnostic responses have the most leverage on your overall score? This analysis
        identifies the areas where a single improvement would produce the largest measurable
        change in your AI maturity classification.
      </p>

      {/* Impact ladder */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-3 mb-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-tertiary">
            Impact Ladder
          </p>
          <p className="text-[11px] text-foreground/40">
            Highest-leverage dimension: {DIMENSION_LABELS[sensitivity.highestLeverageDimension] || sensitivity.highestLeverageDimension}
          </p>
        </div>

        {sensitivity.topImpactQuestions.map((item, idx) => {
          const barWidth = maxDelta > 0 ? (item.overallDelta / maxDelta) * 100 : 0;
          return (
            <div key={item.questionId} className="flex items-center gap-3">
              <span className="text-[11px] font-mono text-tertiary w-6 text-right flex-shrink-0">
                {idx + 1}.
              </span>
              <span className="text-[10px] font-mono text-navy/60 w-12 flex-shrink-0">
                {item.questionId}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-5 bg-offwhite border border-light overflow-hidden relative">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.max(barWidth, 2)}%`,
                        backgroundColor: item.stageDelta > 0 ? "#16a34a" : "#0B1D3A",
                      }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium truncate"
                      style={{ color: barWidth > 50 ? "#fff" : "#374151" }}
                    >
                      {item.questionText.slice(0, 80)}{item.questionText.length > 80 ? "..." : ""}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-secondary w-14 text-right flex-shrink-0">
                    +{item.overallDelta.toFixed(1)}
                  </span>
                </div>
                <div className="flex gap-3 mt-0.5">
                  <span className="text-[10px] text-foreground/35">
                    {DIMENSION_LABELS[item.dimension] || item.dimension}
                  </span>
                  <span className="text-[10px] text-foreground/35">
                    Current: {item.currentScore}/5
                  </span>
                  {item.stageDelta > 0 && (
                    <span className="text-[10px] font-semibold text-green-600">
                      Stage +{item.stageDelta}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-offwhite border border-light">
        <p className="text-xs font-semibold text-secondary mb-1">How to Read This</p>
        <p className="text-[11px] text-tertiary leading-relaxed">
          Each bar shows the overall score increase if that single question improved by one level.
          Questions with green bars would trigger a full stage advancement. Focus improvement
          efforts on the top 3-5 items for maximum impact on your AI maturity classification.
        </p>
      </div>
    </section>
  );
}
