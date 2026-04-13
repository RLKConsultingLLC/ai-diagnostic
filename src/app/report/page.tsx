"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type {
  DiagnosticResult,
  GeneratedReport,
  DimensionScore,
  CompositeIndex,
  StageClassification,
  EconomicEstimate,
  ReportSection,
} from "@/types/diagnostic";

// ---------------------------------------------------------------------------
// Wrapper -- useSearchParams requires Suspense in Next.js app router
// ---------------------------------------------------------------------------

export default function ReportPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-offwhite flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <ReportPage />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

type Phase = "loading" | "preview" | "full";

function ReportPage() {
  const params = useSearchParams();
  const sessionId = params.get("sessionId");

  const [phase, setPhase] = useState<Phase>("loading");
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Fetch session data first (diagnostic results), then try report generation
  useEffect(() => {
    if (!sessionId) {
      setError("No session ID provided.");
      setPhase("preview");
      return;
    }

    let cancelled = false;

    (async () => {
      // Step 1: Try to get the session with diagnostic results
      try {
        const sessionRes = await fetch(`/api/assessment/session?sessionId=${sessionId}`);
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          if (!cancelled && sessionData.session?.diagnosticResult) {
            setResult(sessionData.session.diagnosticResult);
            setPhase("preview");
            if (sessionData.session.generatedReport) {
              setReport(sessionData.session.generatedReport);
            }
          }
        }
      } catch {
        // Session fetch failed, continue to report generation
      }

      // Step 2: Try to generate the AI report (requires ANTHROPIC_API_KEY)
      try {
        const res = await fetch("/api/report/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (cancelled) return;
          if (data.report) setReport(data.report);
          // Update result if returned
          if (data.report?.companyProfile) {
            setResult((prev) => prev ? { ...prev, companyProfile: data.report.companyProfile } : prev);
          }
          setPhase(data.paid ? "full" : "preview");
        } else {
          // Report generation failed (likely no API key), but we still have diagnostic data
          if (!cancelled) setPhase("preview");
        }
      } catch {
        if (!cancelled) setPhase("preview");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Payment handler
  const handleCheckout = useCallback(async () => {
    if (!sessionId) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/payment/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error("Checkout failed.");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("Unable to start checkout. Please try again.");
      setCheckoutLoading(false);
    }
  }, [sessionId]);

  // ---------- Loading state ----------
  if (phase === "loading") {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <Spinner size="lg" />
          <h2 className="mt-6 text-xl font-semibold text-secondary">
            Generating Your Diagnostic Report
          </h2>
          <p className="mt-2 text-sm text-tertiary max-w-sm">
            Our engine is analyzing your responses across five behavioral
            dimensions and building your board-ready briefing.
          </p>
          <div className="mt-8 flex gap-8 text-xs text-tertiary">
            <LoadingStep label="Scoring dimensions" />
            <LoadingStep label="Economic modeling" />
            <LoadingStep label="Generating narrative" />
          </div>
        </div>
      </Shell>
    );
  }

  // ---------- Error fallback ----------
  if (error && !result) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-14 h-14 bg-red-50 flex items-center justify-center mb-4">
            <svg
              className="w-7 h-7 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-secondary">{error}</h2>
          <Link
            href="/assessment"
            className="mt-6 text-sm text-navy font-semibold hover:text-secondary transition-colors"
          >
            Return to Assessment
          </Link>
        </div>
      </Shell>
    );
  }

  // ---------- Results ----------
  return (
    <Shell>
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-800 text-sm px-5 py-3">
          {error}
        </div>
      )}

      {/* Overall Score Hero */}
      {result && (
        <section className="bg-white border border-light p-8 md:p-10 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div>
              <p className="text-xs font-semibold text-tertiary tracking-widest uppercase mb-1">
                {result.companyProfile.companyName}
              </p>
              <h1 className="text-2xl md:text-3xl mb-1">
                AI Maturity Diagnostic
              </h1>
              <p className="text-sm text-foreground/50">
                Completed{" "}
                {new Date(result.completedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <ScoreGauge score={result.overallScore} />
          </div>
        </section>
      )}

      {/* Stage Classification */}
      {result && (
        <section className="bg-white border border-light p-8 md:p-10 mb-8">
          <h2 className="text-lg mb-4">Stage Classification</h2>
          <StageDisplay stage={result.stageClassification} />
        </section>
      )}

      {/* Dimension Scores */}
      {result && (
        <section className="bg-white border border-light p-8 md:p-10 mb-8">
          <h2 className="text-lg mb-6">Dimension Scores</h2>
          <div className="space-y-5">
            {result.dimensionScores.map((ds) => (
              <DimensionBar key={ds.dimension} score={ds} />
            ))}
          </div>
        </section>
      )}

      {/* Composite Indices */}
      {result && result.compositeIndices.length > 0 && (
        <section className="bg-white border border-light p-8 md:p-10 mb-8">
          <h2 className="text-lg mb-6">Composite Indices</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {result.compositeIndices.map((ci) => (
              <CompositeCard key={ci.slug} index={ci} />
            ))}
          </div>
        </section>
      )}

      {/* Economic Impact */}
      {result && (
        <section className="bg-white border border-light p-8 md:p-10 mb-8">
          <h2 className="text-lg mb-6">Economic Impact Summary</h2>
          <EconomicSummary estimate={result.economicEstimate} />
        </section>
      )}

      {/* Mixed Stage Narrative */}
      {result && result.stageClassification.mixedStageNarrative && (
        <section className="bg-white border border-light p-8 md:p-10 mb-8">
          <h2 className="text-lg mb-4">Maturity Analysis</h2>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
            {result.stageClassification.mixedStageNarrative}
          </p>
        </section>
      )}

      {/* Paywall / Full Report */}
      {phase === "preview" && (
        <section className="bg-navy text-white p-8 md:p-10 mb-8">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-xl md:text-2xl font-bold text-white mb-3">
                Your Diagnostic Data is Ready.
                <br />
                The Full Analysis Goes Deeper.
              </h2>
              <p className="text-white/70 text-sm leading-relaxed max-w-lg mx-auto">
                The scores above are the starting point. The full AI Board Brief
                translates these numbers into a board-ready narrative your
                leadership team can act on immediately.
              </p>
            </div>

            {/* What's included grid */}
            <div className="grid sm:grid-cols-2 gap-4 mb-8 text-left">
              <div className="bg-white/10 border border-white/10 p-4">
                <p className="text-white text-sm font-semibold mb-1">
                  AI Posture Diagnosis
                </p>
                <p className="text-white/50 text-xs leading-relaxed">
                  What your behavioral patterns reveal about how AI actually
                  operates inside your organization, not how leadership thinks
                  it does.
                </p>
              </div>
              <div className="bg-white/10 border border-white/10 p-4">
                <p className="text-white text-sm font-semibold mb-1">
                  Structural Constraints
                </p>
                <p className="text-white/50 text-xs leading-relaxed">
                  The specific authority structures, governance bottlenecks, and
                  approval dynamics preventing your AI investments from scaling.
                </p>
              </div>
              <div className="bg-white/10 border border-white/10 p-4">
                <p className="text-white text-sm font-semibold mb-1">
                  Financial Impact Analysis
                </p>
                <p className="text-white/50 text-xs leading-relaxed">
                  Dollar-denominated cost of inaction, capture gap analysis, and
                  ROI framing your CFO can present to the board.
                </p>
              </div>
              <div className="bg-white/10 border border-white/10 p-4">
                <p className="text-white text-sm font-semibold mb-1">
                  Competitive Positioning
                </p>
                <p className="text-white/50 text-xs leading-relaxed">
                  Where you stand vs. industry peers with named competitor
                  analysis and competitive window assessment.
                </p>
              </div>
              <div className="bg-white/10 border border-white/10 p-4">
                <p className="text-white text-sm font-semibold mb-1">
                  Vendor Landscape Assessment
                </p>
                <p className="text-white/50 text-xs leading-relaxed">
                  Are your AI vendors worth what you are paying? Independent
                  analysis of your vendor stack with buy/build/partner
                  recommendations.
                </p>
              </div>
              <div className="bg-white/10 border border-white/10 p-4">
                <p className="text-white text-sm font-semibold mb-1">
                  Security & Governance Risks
                </p>
                <p className="text-white/50 text-xs leading-relaxed">
                  Shadow AI exposure, compliance gaps, and the board-level
                  governance questions you should be asking but likely are not.
                </p>
              </div>
              <div className="sm:col-span-2 bg-white/10 border border-white/10 p-4">
                <p className="text-white text-sm font-semibold mb-1">
                  90-Day Action Plan
                </p>
                <p className="text-white/50 text-xs leading-relaxed">
                  3 to 5 prioritized actions with named owners by role (CIO,
                  CFO, CHRO), specific timeframes (Days 1-30, 31-60, 61-90),
                  and measurable outcomes. Not aspirational. Executable.
                </p>
              </div>
            </div>

            {/* Enrichment callout */}
            <div className="bg-white/5 border border-white/10 p-4 mb-8 text-center">
              <p className="text-white/80 text-xs font-semibold tracking-widest uppercase mb-1">
                Enriched with public intelligence
              </p>
              <p className="text-white/50 text-xs leading-relaxed">
                Your report is not generated from survey data alone. Our AI
                researches your company using SEC filings, news, leadership
                signals, competitor activity, and regulatory developments to
                produce analysis specific to{" "}
                <span className="text-white font-medium">
                  {result?.companyProfile.companyName || "your organization"}
                </span>
                .
              </p>
            </div>

            {/* CTA */}
            <div className="text-center">
              <button
                onClick={handleCheckout}
                disabled={checkoutLoading}
                className="bg-white text-navy px-10 py-4 text-base font-semibold hover:bg-offwhite transition-colors disabled:opacity-60 inline-flex items-center gap-2"
              >
                {checkoutLoading ? (
                  <>
                    <Spinner />
                    Redirecting to Checkout...
                  </>
                ) : (
                  "Get Your Full Board Report: $497"
                )}
              </button>
              <p className="text-white/40 text-xs mt-4">
                Secure payment via Stripe. Includes downloadable PDF
                formatted for board presentation.
              </p>
              <p className="text-white/30 text-xs mt-2">
                Built on the same frameworks Ryan King developed across a
                decade at McKinsey and Deloitte.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Full Report Sections (post-payment) */}
      {phase === "full" && report && (
        <div className="space-y-8 mb-8">
          <div className="rlk-gradient-bar-thick mb-2" />
          <div className="text-center mb-4">
            <h2 className="text-2xl font-bold text-navy">
              AI Board Brief
            </h2>
            <p className="text-xs text-tertiary mt-1">
              Confidential report prepared for{" "}
              {result?.companyProfile.companyName}
            </p>
          </div>
          {report.sections.map((section) => (
            <ReportSectionCard key={section.slug} section={section} />
          ))}
        </div>
      )}

      {/* Back link */}
      <div className="text-center py-6">
        <Link
          href="/"
          className="text-sm text-tertiary hover:text-navy transition-colors"
        >
          Return to RLK Consulting
        </Link>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-offwhite">
      <div className="rlk-gradient-bar" />
      <header className="bg-white border-b border-light">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-navy text-sm font-bold tracking-[0.3em] uppercase"
          >
            RLK Consulting
          </Link>
          <span className="text-xs text-tertiary">AI Board Brief</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10 md:py-14">
        {children}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Score Gauge
// ---------------------------------------------------------------------------

function ScoreGauge({ score }: { score: number }) {
  const label =
    score >= 80
      ? "Advanced"
      : score >= 60
      ? "Established"
      : score >= 40
      ? "Developing"
      : score >= 20
      ? "Emerging"
      : "Initial";

  const color =
    score >= 80
      ? "#0B1D3A"
      : score >= 60
      ? "#364E6E"
      : score >= 40
      ? "#6B7F99"
      : score >= 20
      ? "#A8B5C4"
      : "#CED5DD";

  return (
    <div className="flex flex-col items-center">
      <div
        className="w-28 h-28 rounded-full border-[6px] flex items-center justify-center"
        style={{ borderColor: color }}
      >
        <div className="text-center">
          <div className="text-3xl font-bold" style={{ color }}>
            {score}
          </div>
          <div className="text-[10px] text-tertiary -mt-0.5">/ 100</div>
        </div>
      </div>
      <div
        className="mt-2 text-xs font-semibold tracking-wider uppercase"
        style={{ color }}
      >
        {label}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage Display
// ---------------------------------------------------------------------------

function StageDisplay({ stage }: { stage: StageClassification }) {
  const stages = [1, 2, 3, 4, 5];
  const stageColors = ["#CED5DD", "#A8B5C4", "#6B7F99", "#364E6E", "#0B1D3A"];

  return (
    <div>
      {/* Stage progress indicator */}
      <div className="flex gap-2 mb-5">
        {stages.map((s) => (
          <div
            key={s}
            className="flex-1 h-2"
            style={{
              backgroundColor:
                s <= stage.primaryStage ? stageColors[s - 1] : "#F0F1F3",
            }}
          />
        ))}
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold text-navy">
          Stage {stage.primaryStage}
        </span>
        <span className="text-lg text-secondary font-semibold">
          {stage.stageName}
        </span>
      </div>
      <p className="text-sm text-foreground/70 leading-relaxed max-w-2xl">
        {stage.stageDescription}
      </p>
      {stage.confidence < 0.7 && (
        <p className="text-xs text-tertiary mt-3">
          Confidence: {Math.round(stage.confidence * 100)}%. Dimension
          scores show significant variance, suggesting mixed maturity across
          organizational areas.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dimension Bar
// ---------------------------------------------------------------------------

function DimensionBar({ score }: { score: DimensionScore }) {
  const barColor =
    score.normalizedScore >= 80
      ? "#0B1D3A"
      : score.normalizedScore >= 60
      ? "#364E6E"
      : score.normalizedScore >= 40
      ? "#6B7F99"
      : score.normalizedScore >= 20
      ? "#A8B5C4"
      : "#CED5DD";

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-foreground/80">
          {dimensionLabel(score.dimension)}
        </span>
        <span className="text-sm font-semibold" style={{ color: barColor }}>
          {score.normalizedScore}
        </span>
      </div>
      <div className="h-3 bg-offwhite border border-light overflow-hidden">
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{
            width: `${score.normalizedScore}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composite Index Card
// ---------------------------------------------------------------------------

function CompositeCard({ index }: { index: CompositeIndex }) {
  const color =
    index.score >= 70
      ? "#0B1D3A"
      : index.score >= 40
      ? "#6B7F99"
      : "#A8B5C4";

  return (
    <div className="bg-offwhite border border-light p-5">
      <div className="text-xs font-semibold text-tertiary tracking-wider uppercase mb-3">
        {index.name}
      </div>
      <div className="text-3xl font-bold mb-2" style={{ color }}>
        {index.score}
      </div>
      <p className="text-xs text-foreground/60 leading-relaxed">
        {index.interpretation}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Economic Summary
// ---------------------------------------------------------------------------

function EconomicSummary({ estimate }: { estimate: EconomicEstimate }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div>
      {/* Unrealized value highlight */}
      <div className="bg-navy/5 border border-navy/10 p-6 mb-6">
        <p className="text-xs font-semibold text-tertiary tracking-widest uppercase mb-2">
          Estimated Unrealized Annual Value
        </p>
        <div className="text-2xl md:text-3xl font-bold text-navy">
          {fmt(estimate.unrealizedValueLow)} to{" "}
          {fmt(estimate.unrealizedValueHigh)}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
        <Metric
          label="Productivity Potential"
          value={`${estimate.productivityPotentialPercent}%`}
        />
        <Metric
          label="Current Capture"
          value={`${estimate.currentCapturePercent}%`}
        />
        <Metric
          label="Annual Wasted Hours"
          value={estimate.annualWastedHours.toLocaleString()}
        />
        <Metric
          label="Cost per Employee"
          value={fmt(estimate.costPerEmployee)}
        />
      </div>
      {estimate.industryBenchmark && (
        <p className="text-xs text-tertiary mt-5 leading-relaxed">
          {estimate.industryBenchmark}
        </p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-tertiary mb-1">{label}</p>
      <p className="text-lg font-bold text-navy">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report Section Card
// ---------------------------------------------------------------------------

function ReportSectionCard({ section }: { section: ReportSection }) {
  return (
    <section className="bg-white border border-light p-8 md:p-10">
      <h2 className="text-lg font-semibold text-secondary mb-4">
        {section.title}
      </h2>
      <div className="prose prose-sm max-w-none text-foreground/80 leading-relaxed whitespace-pre-line">
        {section.content}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function Spinner({ size = "sm" }: { size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "w-8 h-8" : "w-4 h-4";
  return (
    <svg className={`animate-spin ${cls}`} fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function LoadingStep({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
      {label}
    </span>
  );
}

function dimensionLabel(dim: string): string {
  const map: Record<string, string> = {
    adoption_behavior: "Adoption Behavior",
    authority_structure: "Authority Structure",
    workflow_integration: "Workflow Integration",
    decision_velocity: "Decision Velocity",
    economic_translation: "Economic Translation",
  };
  return map[dim] ?? dim;
}
