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
  CompanyProfile,
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
      {phase === "full" && report && result && (
        <div className="mb-8">
          {/* ================================================================= */}
          {/* REPORT COVER / TITLE BLOCK                                        */}
          {/* ================================================================= */}
          <div className="rlk-gradient-bar-thick mb-0" />
          <section className="bg-navy text-white p-10 md:p-14 mb-10">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-xs font-semibold tracking-[0.35em] uppercase text-white/40 mb-3">
                Confidential
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
                AI Board Brief
              </h2>
              <p className="text-sm text-white/60 mb-6">
                Prepared exclusively for{" "}
                <span className="text-white font-semibold">
                  {result.companyProfile.companyName}
                </span>
              </p>
              <div className="flex flex-wrap justify-center gap-6 text-xs text-white/40">
                <span>
                  {new Date(report.generatedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <span>|</span>
                <span>
                  {result.companyProfile.industry
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
                <span>|</span>
                <span>
                  {result.companyProfile.employeeCount.toLocaleString()} employees
                </span>
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* SECTION 1: EXECUTIVE SUMMARY                                      */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-8 md:p-10 mb-8">
            <SectionHeader number={1} title="Executive Summary" />
            <div className="grid md:grid-cols-3 gap-8 mt-6">
              {/* Main narrative */}
              <div className="md:col-span-2">
                <MarkdownContent
                  content={
                    report.sections.find(
                      (s) => s.slug === "executive-summary"
                    )?.content || ""
                  }
                />
              </div>
              {/* Key Findings Sidebar */}
              <div className="bg-offwhite border border-light p-6">
                <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-4">
                  Key Findings
                </p>
                <div className="space-y-5">
                  <KeyMetric
                    label="Overall AI Maturity"
                    value={`${result.overallScore}/100`}
                    color={
                      result.overallScore >= 60
                        ? "#0B1D3A"
                        : result.overallScore >= 40
                        ? "#6B7F99"
                        : "#A8B5C4"
                    }
                  />
                  <KeyMetric
                    label="Maturity Stage"
                    value={`Stage ${result.stageClassification.primaryStage}: ${result.stageClassification.stageName}`}
                    color="#364E6E"
                  />
                  <KeyMetric
                    label="Unrealized Annual Value"
                    value={`${fmtUSD(result.economicEstimate.unrealizedValueLow)} to ${fmtUSD(result.economicEstimate.unrealizedValueHigh)}`}
                    color="#0B1D3A"
                  />
                  <KeyMetric
                    label="Weakest Dimension"
                    value={dimensionLabel(
                      [...result.dimensionScores].sort(
                        (a, b) => a.normalizedScore - b.normalizedScore
                      )[0]?.dimension || ""
                    )}
                    subvalue={`Score: ${[...result.dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore)[0]?.normalizedScore}/100`}
                    color="#A8B5C4"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* SECTION 2: DIMENSION RADAR / SPIDER DISPLAY                       */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-8 md:p-10 mb-8">
            <SectionHeader
              number={2}
              title="AI Maturity Dimension Analysis"
            />

            {/* Pentagon radar visualization */}
            <div className="mt-8 mb-10 flex justify-center">
              <PentagonRadar dimensions={result.dimensionScores} />
            </div>

            {/* Dimension data table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-navy">
                    <th className="text-left py-3 px-4 text-xs font-semibold tracking-wider uppercase text-tertiary">
                      Dimension
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold tracking-wider uppercase text-tertiary">
                      Score
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold tracking-wider uppercase text-tertiary">
                      Stage
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold tracking-wider uppercase text-tertiary">
                      Visual
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold tracking-wider uppercase text-tertiary">
                      Interpretation
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.dimensionScores.map((ds) => {
                    const stage =
                      result.stageClassification.dimensionStages[ds.dimension];
                    const barColor =
                      ds.normalizedScore >= 80
                        ? "#0B1D3A"
                        : ds.normalizedScore >= 60
                        ? "#364E6E"
                        : ds.normalizedScore >= 40
                        ? "#6B7F99"
                        : ds.normalizedScore >= 20
                        ? "#A8B5C4"
                        : "#CED5DD";
                    return (
                      <tr
                        key={ds.dimension}
                        className="border-b border-light"
                      >
                        <td className="py-3 px-4 font-medium text-secondary">
                          {dimensionLabel(ds.dimension)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className="text-lg font-bold"
                            style={{ color: barColor }}
                          >
                            {ds.normalizedScore}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className="inline-block px-2 py-0.5 text-xs font-semibold text-white"
                            style={{ backgroundColor: barColor }}
                          >
                            Stage {stage}
                          </span>
                        </td>
                        <td className="py-3 px-4" style={{ minWidth: 160 }}>
                          <div className="h-3 bg-offwhite border border-light overflow-hidden">
                            <div
                              className="h-full"
                              style={{
                                width: `${ds.normalizedScore}%`,
                                backgroundColor: barColor,
                              }}
                            />
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-foreground/60">
                          {dimensionInterpretation(ds.dimension, ds.normalizedScore)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* AI narrative for AI Posture Diagnosis */}
            <div className="mt-8 pt-6 border-t border-light">
              <MarkdownContent
                content={
                  report.sections.find(
                    (s) => s.slug === "ai-posture-diagnosis"
                  )?.content || ""
                }
              />
            </div>
          </section>

          {/* ================================================================= */}
          {/* SECTION 3: COMPOSITE INDEX DEEP DIVE                              */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-8 md:p-10 mb-8">
            <SectionHeader number={3} title="Composite Index Deep Dive" />
            <p className="text-sm text-foreground/60 mt-2 mb-8">
              Three composite indices distill your 36 question responses into
              actionable measures of organizational AI capability.
            </p>

            <div className="space-y-10">
              {result.compositeIndices.map((ci) => {
                const ciColor =
                  ci.score >= 70
                    ? "#0B1D3A"
                    : ci.score >= 40
                    ? "#6B7F99"
                    : "#A8B5C4";
                return (
                  <div
                    key={ci.slug}
                    className="border border-light p-6"
                  >
                    <div className="flex flex-col md:flex-row md:items-start gap-6">
                      {/* Score prominence */}
                      <div className="flex-shrink-0 text-center md:text-left">
                        <div
                          className="text-5xl font-bold"
                          style={{ color: ciColor }}
                        >
                          {ci.score}
                        </div>
                        <p className="text-xs text-tertiary mt-1">/ 100</p>
                      </div>

                      {/* Details */}
                      <div className="flex-1">
                        <h4 className="text-base font-semibold text-secondary mb-3">
                          {ci.name}
                        </h4>

                        {/* Horizontal bar */}
                        <div className="h-4 bg-offwhite border border-light overflow-hidden mb-4">
                          <div
                            className="h-full"
                            style={{
                              width: `${ci.score}%`,
                              backgroundColor: ciColor,
                            }}
                          />
                        </div>

                        {/* Component breakdown */}
                        <p className="text-xs font-semibold text-tertiary tracking-wider uppercase mb-2">
                          Component Breakdown
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {ci.components.map((comp, idx) => (
                            <div
                              key={idx}
                              className="bg-offwhite border border-light p-2"
                            >
                              <p className="text-[10px] text-tertiary truncate">
                                Q{comp.questionId.replace(/\D/g, "").slice(-2) || idx + 1}
                              </p>
                              <p className="text-sm font-bold text-secondary">
                                {comp.score}
                                <span className="text-[10px] text-tertiary font-normal">
                                  /5
                                </span>
                              </p>
                              <div className="h-1 bg-light mt-1 overflow-hidden">
                                <div
                                  className="h-full"
                                  style={{
                                    width: `${(comp.score / 5) * 100}%`,
                                    backgroundColor: ciColor,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* What this means callout */}
                    <div
                      className="mt-4 p-4"
                      style={{
                        backgroundColor: `${ciColor}08`,
                        borderLeft: `3px solid ${ciColor}`,
                      }}
                    >
                      <p className="text-xs font-semibold text-secondary mb-1">
                        What this means
                      </p>
                      <p className="text-sm text-foreground/70 leading-relaxed">
                        {ci.interpretation}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Structural constraints narrative */}
            <div className="mt-8 pt-6 border-t border-light">
              <MarkdownContent
                content={
                  report.sections.find(
                    (s) => s.slug === "structural-constraints"
                  )?.content || ""
                }
              />
            </div>
          </section>

          {/* ================================================================= */}
          {/* SECTION 4: ECONOMIC MODEL (Show the Math)                         */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-8 md:p-10 mb-8">
            <SectionHeader number={4} title="Economic Impact Model" />
            <p className="text-sm text-foreground/60 mt-2 mb-8">
              A transparent, step-by-step breakdown of how AI-driven
              productivity translates into unrealized economic value for your
              organization.
            </p>

            {/* Waterfall / Funnel visualization */}
            <EconomicWaterfall estimate={result.economicEstimate} profile={result.companyProfile} />

            {/* Cost of delay */}
            <div className="mt-8 grid sm:grid-cols-2 gap-6">
              <div className="bg-navy/5 border border-navy/10 p-6">
                <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
                  Quarterly Cost of Inaction
                </p>
                <p className="text-2xl font-bold text-navy">
                  {fmtUSD(
                    Math.round(
                      (result.economicEstimate.unrealizedValueLow +
                        result.economicEstimate.unrealizedValueHigh) /
                        2 /
                        4
                    )
                  )}
                </p>
                <p className="text-xs text-foreground/50 mt-2">
                  Every quarter without action, your organization forfeits this
                  value. Calculated as the midpoint of the unrealized annual
                  value range divided by four.
                </p>
              </div>
              <div className="bg-navy/5 border border-navy/10 p-6">
                <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
                  Annual Cost per Employee
                </p>
                <p className="text-2xl font-bold text-navy">
                  {fmtUSD(result.economicEstimate.costPerEmployee)}
                </p>
                <p className="text-xs text-foreground/50 mt-2">
                  Per-employee value left on the table annually due to
                  under-captured AI productivity across{" "}
                  {result.companyProfile.employeeCount.toLocaleString()} employees.
                </p>
              </div>
            </div>

            {/* Industry benchmark bar */}
            {result.economicEstimate.industryBenchmark && (
              <div className="mt-6 bg-offwhite border border-light p-5">
                <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
                  Industry Benchmark Context
                </p>
                <p className="text-sm text-foreground/70 leading-relaxed">
                  {result.economicEstimate.industryBenchmark}
                </p>
              </div>
            )}

            {/* Financial impact narrative */}
            <div className="mt-8 pt-6 border-t border-light">
              <MarkdownContent
                content={
                  report.sections.find(
                    (s) => s.slug === "financial-impact"
                  )?.content || ""
                }
              />
            </div>
          </section>

          {/* ================================================================= */}
          {/* SECTION 5: COMPETITIVE POSITIONING MAP                            */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-8 md:p-10 mb-8">
            <SectionHeader number={5} title="Competitive Positioning" />
            <p className="text-sm text-foreground/60 mt-2 mb-8">
              Your position on the AI Capability vs. Organizational Readiness
              matrix, benchmarked against industry maturity norms.
            </p>

            {/* 2x2 Matrix */}
            <CompetitiveMatrix
              capabilityScore={
                (result.dimensionScores.find(
                  (d) => d.dimension === "adoption_behavior"
                )?.normalizedScore || 0) * 0.5 +
                (result.dimensionScores.find(
                  (d) => d.dimension === "workflow_integration"
                )?.normalizedScore || 0) * 0.5
              }
              readinessScore={
                (result.dimensionScores.find(
                  (d) => d.dimension === "authority_structure"
                )?.normalizedScore || 0) * 0.4 +
                (result.dimensionScores.find(
                  (d) => d.dimension === "decision_velocity"
                )?.normalizedScore || 0) * 0.3 +
                (result.dimensionScores.find(
                  (d) => d.dimension === "economic_translation"
                )?.normalizedScore || 0) * 0.3
              }
              companyName={result.companyProfile.companyName}
            />

            {/* Competitive positioning narrative */}
            <div className="mt-8 pt-6 border-t border-light">
              <MarkdownContent
                content={
                  report.sections.find(
                    (s) => s.slug === "competitive-positioning"
                  )?.content || ""
                }
              />
            </div>
          </section>

          {/* ================================================================= */}
          {/* SECTION 6: VENDOR LANDSCAPE TABLE                                 */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-8 md:p-10 mb-8">
            <SectionHeader number={6} title="Vendor Landscape Assessment" />
            <p className="text-sm text-foreground/60 mt-2 mb-8">
              Independent analysis of AI vendor positioning, buy/build/partner
              recommendations, and stack optimization opportunities.
            </p>

            {report.sections.find((s) => s.slug === "vendor-landscape")
              ?.content ? (
              <div>
                {/* Vendor evaluation criteria header */}
                <div className="grid grid-cols-4 gap-3 mb-6">
                  {[
                    { label: "Fit", desc: "Alignment to your use cases" },
                    { label: "Scale", desc: "Enterprise deployment readiness" },
                    { label: "Cost", desc: "TCO and pricing structure" },
                    { label: "Risk", desc: "Vendor lock-in and continuity" },
                  ].map((crit) => (
                    <div
                      key={crit.label}
                      className="bg-offwhite border border-light p-3 text-center"
                    >
                      <p className="text-sm font-semibold text-secondary">
                        {crit.label}
                      </p>
                      <p className="text-[10px] text-tertiary mt-0.5">
                        {crit.desc}
                      </p>
                    </div>
                  ))}
                </div>

                <MarkdownContent
                  content={
                    report.sections.find(
                      (s) => s.slug === "vendor-landscape"
                    )?.content || ""
                  }
                />
              </div>
            ) : (
              <div className="bg-offwhite border border-light p-8 text-center">
                <p className="text-sm text-tertiary">
                  Vendor landscape analysis was included as part of the report
                  generation process. The detailed vendor assessment is
                  integrated across the competitive positioning and action plan
                  sections of this report.
                </p>
              </div>
            )}
          </section>

          {/* ================================================================= */}
          {/* SECTION 7: SECURITY & GOVERNANCE RISK MATRIX                      */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-8 md:p-10 mb-8">
            <SectionHeader
              number={7}
              title="Security and Governance Risk Matrix"
            />
            <p className="text-sm text-foreground/60 mt-2 mb-8">
              Risk exposure mapped across likelihood and impact, derived from
              your diagnostic dimension scores and governance posture.
            </p>

            {/* Risk Matrix visualization */}
            <RiskMatrix dimensionScores={result.dimensionScores} />

            {/* Security narrative */}
            <div className="mt-8 pt-6 border-t border-light">
              <MarkdownContent
                content={
                  report.sections.find(
                    (s) => s.slug === "security-governance-risk"
                  )?.content || ""
                }
              />
            </div>
          </section>

          {/* ================================================================= */}
          {/* SECTION 8: 90-DAY ACTION PLAN (Timeline Visual)                   */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-8 md:p-10 mb-8">
            <SectionHeader number={8} title="90-Day Action Plan" />
            <p className="text-sm text-foreground/60 mt-2 mb-8">
              Prioritized, time-bound actions with role-specific ownership.
              Designed for immediate executive mobilization.
            </p>

            {/* Timeline visual */}
            <ActionTimeline
              overallScore={result.overallScore}
              weakestDimension={
                [...result.dimensionScores].sort(
                  (a, b) => a.normalizedScore - b.normalizedScore
                )[0]?.dimension || "adoption_behavior"
              }
            />

            {/* AI narrative */}
            <div className="mt-8 pt-6 border-t border-light">
              <MarkdownContent
                content={
                  report.sections.find(
                    (s) => s.slug === "90-day-action-plan"
                  )?.content || ""
                }
              />
            </div>

            {/* Data sources callout */}
            <div className="mt-6 bg-offwhite border border-light p-5">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
                Data Sources Informing This Plan
              </p>
              <p className="text-sm text-foreground/60 leading-relaxed">
                This action plan is informed by: diagnostic scores across 36
                behavioral questions, industry benchmarks for{" "}
                {result.companyProfile.industry
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
                , competitive intelligence, SEC EDGAR filings, Google News
                signals, vendor intelligence, and regulatory analysis specific
                to your sector and company profile.
              </p>
            </div>
          </section>

          {/* ================================================================= */}
          {/* SECTION 9: METHODOLOGY & DATA SOURCES                             */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-8 md:p-10 mb-8">
            <SectionHeader number={9} title="Methodology and Data Sources" />

            <div className="mt-6 grid md:grid-cols-2 gap-8">
              {/* Scoring methodology */}
              <div>
                <h4 className="text-sm font-semibold text-secondary mb-3">
                  Scoring Methodology
                </h4>
                <div className="space-y-3">
                  <MethodologyItem
                    label="Dimensions Assessed"
                    value="5 behavioral dimensions"
                  />
                  <MethodologyItem
                    label="Total Questions"
                    value="36 behavioral questions"
                  />
                  <MethodologyItem
                    label="Response Scale"
                    value="0 to 5 per question"
                  />
                  <MethodologyItem
                    label="Normalization"
                    value="Raw scores normalized to 0 to 100 scale per dimension"
                  />
                  <MethodologyItem
                    label="Overall Score"
                    value="Weighted composite of all five dimension scores"
                  />
                  <MethodologyItem
                    label="Stage Classification"
                    value="5-stage maturity model (1: Initial through 5: Optimized)"
                  />
                </div>

                <h4 className="text-sm font-semibold text-secondary mt-6 mb-3">
                  Composite Index Formulas
                </h4>
                <div className="space-y-2">
                  {result.compositeIndices.map((ci) => (
                    <div
                      key={ci.slug}
                      className="bg-offwhite border border-light p-3"
                    >
                      <p className="text-xs font-semibold text-secondary">
                        {ci.name}
                      </p>
                      <p className="text-[11px] text-tertiary">
                        Derived from {ci.components.length} questions, weighted
                        by behavioral significance
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Data sources */}
              <div>
                <h4 className="text-sm font-semibold text-secondary mb-3">
                  Data Sources
                </h4>
                <div className="space-y-2">
                  {[
                    {
                      source: "Behavioral Diagnostic",
                      detail:
                        "36 questions across 5 dimensions, completed by organizational respondent",
                    },
                    {
                      source: "SEC EDGAR Filings",
                      detail:
                        "Public company financial disclosures, 10-K and 10-Q filings, proxy statements",
                    },
                    {
                      source: "Google News Intelligence",
                      detail:
                        "Recent company and industry news, leadership signals, market developments",
                    },
                    {
                      source: "Industry Benchmarks",
                      detail:
                        "Sector-specific AI maturity benchmarks and peer comparison data",
                    },
                    {
                      source: "Vendor Intelligence",
                      detail:
                        "AI vendor landscape data, pricing benchmarks, capability assessments",
                    },
                    {
                      source: "Regulatory Analysis",
                      detail:
                        "Industry-specific compliance requirements, AI governance standards, emerging regulation",
                    },
                  ].map((ds) => (
                    <div
                      key={ds.source}
                      className="flex gap-3 p-3 bg-offwhite border border-light"
                    >
                      <div
                        className="w-1.5 flex-shrink-0 mt-0.5"
                        style={{
                          backgroundColor: "#0B1D3A",
                          height: 32,
                        }}
                      />
                      <div>
                        <p className="text-xs font-semibold text-secondary">
                          {ds.source}
                        </p>
                        <p className="text-[11px] text-tertiary leading-relaxed">
                          {ds.detail}
                        </p>
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
                      <div
                        className="h-full"
                        style={{
                          width: `${Math.round(result.stageClassification.confidence * 100)}%`,
                          backgroundColor:
                            result.stageClassification.confidence >= 0.7
                              ? "#0B1D3A"
                              : result.stageClassification.confidence >= 0.5
                              ? "#6B7F99"
                              : "#A8B5C4",
                        }}
                      />
                    </div>
                    <span className="text-sm font-bold text-secondary">
                      {Math.round(
                        result.stageClassification.confidence * 100
                      )}
                      %
                    </span>
                  </div>
                  <p className="text-[11px] text-tertiary mt-2">
                    {result.stageClassification.confidence >= 0.7
                      ? "High confidence. Dimension scores are consistent, indicating coherent organizational AI posture."
                      : "Moderate confidence. Dimension scores show variance, suggesting mixed maturity across organizational areas. This is common in large organizations with decentralized AI adoption."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* REPORT FOOTER                                                     */}
          {/* ================================================================= */}
          <div className="rlk-gradient-bar-thick mt-2 mb-4" />
          <div className="text-center py-4">
            <p className="text-xs text-tertiary">
              This report is confidential and prepared solely for{" "}
              {result.companyProfile.companyName}. Methodology developed by
              Ryan King based on frameworks refined across a decade of
              management consulting at McKinsey and Deloitte.
            </p>
            <p className="text-[10px] text-tertiary/60 mt-2">
              RLK AI Diagnostic | {new Date().getFullYear()} | All rights
              reserved
            </p>
          </div>
        </div>
      )}

      {/* Back link */}
      <div className="text-center py-6">
        <Link
          href="/"
          className="text-sm text-tertiary hover:text-navy transition-colors"
        >
          Return to RLK AI Diagnostic
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
            RLK AI Diagnostic
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
// Currency formatter (used by full report sections)
// ---------------------------------------------------------------------------

function fmtUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

// ---------------------------------------------------------------------------
// Section Header (numbered McKinsey-style)
// ---------------------------------------------------------------------------

function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-4">
      <div
        className="flex-shrink-0 w-9 h-9 flex items-center justify-center text-white text-sm font-bold"
        style={{ backgroundColor: "#0B1D3A" }}
      >
        {number}
      </div>
      <h3 className="text-lg md:text-xl font-semibold text-navy">
        {title}
      </h3>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Key Metric (sidebar metric block)
// ---------------------------------------------------------------------------

function KeyMetric({
  label,
  value,
  subvalue,
  color,
}: {
  label: string;
  value: string;
  subvalue?: string;
  color: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-wider uppercase text-tertiary mb-1">
        {label}
      </p>
      <p className="text-sm font-bold" style={{ color }}>
        {value}
      </p>
      {subvalue && (
        <p className="text-[11px] text-tertiary mt-0.5">{subvalue}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Markdown Content Renderer (basic markdown to JSX)
// ---------------------------------------------------------------------------

function MarkdownContent({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul
          key={`list-${listKey++}`}
          className="list-disc list-outside pl-5 space-y-1 text-sm text-foreground/70 leading-relaxed mb-4"
        >
          {listItems.map((item, i) => (
            <li key={i}>
              <InlineMarkdown text={item} />
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Headings
    if (trimmed.startsWith("### ")) {
      flushList();
      elements.push(
        <h5
          key={idx}
          className="text-sm font-semibold text-secondary mt-5 mb-2"
        >
          <InlineMarkdown text={trimmed.slice(4)} />
        </h5>
      );
      return;
    }
    if (trimmed.startsWith("## ")) {
      flushList();
      elements.push(
        <h4
          key={idx}
          className="text-base font-semibold text-navy mt-6 mb-3"
        >
          <InlineMarkdown text={trimmed.slice(3)} />
        </h4>
      );
      return;
    }
    if (trimmed.startsWith("# ")) {
      flushList();
      elements.push(
        <h3
          key={idx}
          className="text-lg font-semibold text-navy mt-6 mb-3"
        >
          <InlineMarkdown text={trimmed.slice(2)} />
        </h3>
      );
      return;
    }

    // List items
    if (/^[-*]\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-*]\s+/, ""));
      return;
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^\d+\.\s+/, ""));
      return;
    }

    // Empty line
    if (!trimmed) {
      flushList();
      return;
    }

    // Paragraph
    flushList();
    elements.push(
      <p
        key={idx}
        className="text-sm text-foreground/70 leading-relaxed mb-3"
      >
        <InlineMarkdown text={trimmed} />
      </p>
    );
  });

  flushList();

  return <div>{elements}</div>;
}

function InlineMarkdown({ text }: { text: string }) {
  // Parse **bold** inline
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-secondary">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Pentagon Radar Visualization (CSS-based)
// ---------------------------------------------------------------------------

function PentagonRadar({ dimensions }: { dimensions: DimensionScore[] }) {
  // Order: top, top-right, bottom-right, bottom-left, top-left
  const ordered: (DimensionScore | undefined)[] = [
    dimensions.find((d) => d.dimension === "adoption_behavior"),
    dimensions.find((d) => d.dimension === "workflow_integration"),
    dimensions.find((d) => d.dimension === "economic_translation"),
    dimensions.find((d) => d.dimension === "authority_structure"),
    dimensions.find((d) => d.dimension === "decision_velocity"),
  ];

  const labels = [
    "Adoption\nBehavior",
    "Workflow\nIntegration",
    "Economic\nTranslation",
    "Authority\nStructure",
    "Decision\nVelocity",
  ];

  // Pentagon positions (approximate for a 300x300 box)
  const positions = [
    { x: 150, y: 20 },   // top
    { x: 280, y: 110 },  // top-right
    { x: 230, y: 250 },  // bottom-right
    { x: 70, y: 250 },   // bottom-left
    { x: 20, y: 110 },   // top-left
  ];

  const center = { x: 150, y: 145 };

  return (
    <div className="relative" style={{ width: 340, height: 300 }}>
      {/* Pentagon wireframe rings */}
      {[0.25, 0.5, 0.75, 1.0].map((scale, ringIdx) => (
        <svg
          key={ringIdx}
          className="absolute inset-0"
          style={{ width: 340, height: 300 }}
          viewBox="0 0 340 300"
        >
          <polygon
            points={positions
              .map(
                (p) =>
                  `${center.x + (p.x - center.x) * scale * 0.7},${center.y + (p.y - center.y) * scale * 0.7}`
              )
              .join(" ")}
            fill="none"
            stroke="#CED5DD"
            strokeWidth={ringIdx === 3 ? 1.5 : 0.5}
            strokeDasharray={ringIdx < 3 ? "3,3" : "none"}
          />
        </svg>
      ))}

      {/* Axis lines from center to each vertex */}
      <svg
        className="absolute inset-0"
        style={{ width: 340, height: 300 }}
        viewBox="0 0 340 300"
      >
        {positions.map((p, i) => (
          <line
            key={i}
            x1={center.x}
            y1={center.y}
            x2={center.x + (p.x - center.x) * 0.7}
            y2={center.y + (p.y - center.y) * 0.7}
            stroke="#CED5DD"
            strokeWidth={0.5}
          />
        ))}
      </svg>

      {/* Data polygon */}
      <svg
        className="absolute inset-0"
        style={{ width: 340, height: 300 }}
        viewBox="0 0 340 300"
      >
        <polygon
          points={ordered
            .map((ds, i) => {
              const score = (ds?.normalizedScore || 0) / 100;
              const p = positions[i];
              return `${center.x + (p.x - center.x) * score * 0.7},${center.y + (p.y - center.y) * score * 0.7}`;
            })
            .join(" ")}
          fill="rgba(11, 29, 58, 0.12)"
          stroke="#0B1D3A"
          strokeWidth={2}
        />
        {/* Score dots */}
        {ordered.map((ds, i) => {
          const score = (ds?.normalizedScore || 0) / 100;
          const p = positions[i];
          const cx = center.x + (p.x - center.x) * score * 0.7;
          const cy = center.y + (p.y - center.y) * score * 0.7;
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={4}
              fill="#0B1D3A"
              stroke="#fff"
              strokeWidth={2}
            />
          );
        })}
      </svg>

      {/* Labels with scores */}
      {positions.map((p, i) => {
        const ds = ordered[i];
        const score = ds?.normalizedScore || 0;
        // Position labels outside the pentagon
        const labelX = center.x + (p.x - center.x) * 1.05;
        const labelY = center.y + (p.y - center.y) * 1.05;
        const textAnchor =
          i === 0
            ? "middle"
            : i === 1 || i === 2
            ? "start"
            : "end";
        return (
          <div
            key={i}
            className="absolute text-center"
            style={{
              left: labelX - (textAnchor === "middle" ? 40 : textAnchor === "start" ? -4 : 76),
              top: labelY - (i === 0 ? 28 : i >= 3 ? -2 : 4),
              width: 80,
            }}
          >
            <p className="text-[10px] text-tertiary leading-tight whitespace-pre-line">
              {labels[i]}
            </p>
            <p
              className="text-xs font-bold"
              style={{
                color:
                  score >= 60 ? "#0B1D3A" : score >= 40 ? "#6B7F99" : "#A8B5C4",
              }}
            >
              {score}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dimension Interpretation Helper
// ---------------------------------------------------------------------------

function dimensionInterpretation(dim: string, score: number): string {
  if (score >= 80) {
    const high: Record<string, string> = {
      adoption_behavior: "AI is embedded in daily workflows across the organization.",
      authority_structure: "Clear governance enables rapid, decentralized AI decisions.",
      workflow_integration: "AI tools are deeply integrated into core business processes.",
      decision_velocity: "AI-informed decisions move quickly through the organization.",
      economic_translation: "AI value is quantified and tied directly to business outcomes.",
    };
    return high[dim] || "Strong performance across this dimension.";
  }
  if (score >= 60) {
    const mid: Record<string, string> = {
      adoption_behavior: "Growing adoption with pockets of consistent AI use.",
      authority_structure: "Governance exists but bottlenecks slow scaling.",
      workflow_integration: "Some workflows leverage AI; others remain manual.",
      decision_velocity: "Decisions benefit from AI input but face approval friction.",
      economic_translation: "Value is recognized but not fully captured in financial terms.",
    };
    return mid[dim] || "Moderate capability with room for improvement.";
  }
  if (score >= 40) {
    const developing: Record<string, string> = {
      adoption_behavior: "Experimentation phase; AI use is sporadic and inconsistent.",
      authority_structure: "Approval structures create friction for AI initiatives.",
      workflow_integration: "AI is adjacent to workflows, not embedded within them.",
      decision_velocity: "Decisions involving AI face significant organizational lag.",
      economic_translation: "Limited ability to connect AI activity to financial returns.",
    };
    return developing[dim] || "Developing capability requiring focused investment.";
  }
  const low: Record<string, string> = {
    adoption_behavior: "Minimal AI usage; resistance or lack of awareness.",
    authority_structure: "No clear AI governance; decisions are ad hoc.",
    workflow_integration: "AI is not present in business workflows.",
    decision_velocity: "AI decisions are stalled by organizational inertia.",
    economic_translation: "No framework to measure AI economic impact.",
  };
  return low[dim] || "Significant gap requiring foundational investment.";
}

// ---------------------------------------------------------------------------
// Economic Waterfall / Funnel Visualization
// ---------------------------------------------------------------------------

function EconomicWaterfall({
  estimate,
  profile,
}: {
  estimate: EconomicEstimate;
  profile: CompanyProfile;
}) {
  const totalLaborCost = Math.round(profile.employeeCount * 85000);
  const aiAddressablePercent = estimate.productivityPotentialPercent;
  const aiAddressableValue = Math.round(
    totalLaborCost * (aiAddressablePercent / 100)
  );
  const currentCapture = estimate.currentCapturePercent;
  const capturedValue = Math.round(aiAddressableValue * (currentCapture / 100));
  const unrealizedMid = Math.round(
    (estimate.unrealizedValueLow + estimate.unrealizedValueHigh) / 2
  );

  const steps = [
    {
      label: "Total Labor Cost",
      value: totalLaborCost,
      percent: 100,
      color: "#0B1D3A",
      detail: `${profile.employeeCount.toLocaleString()} employees x ~$85K avg`,
    },
    {
      label: "AI-Addressable Labor",
      value: aiAddressableValue,
      percent: aiAddressablePercent,
      color: "#364E6E",
      detail: `${aiAddressablePercent}% of labor cost is AI-addressable`,
    },
    {
      label: "Currently Captured",
      value: capturedValue,
      percent: currentCapture,
      color: "#6B7F99",
      detail: `Only ${currentCapture}% of potential is currently captured`,
    },
    {
      label: "Unrealized Value",
      value: unrealizedMid,
      percent: Math.round(
        ((aiAddressableValue - capturedValue) / totalLaborCost) * 100
      ),
      color: "#A8B5C4",
      detail: `${fmtUSD(estimate.unrealizedValueLow)} to ${fmtUSD(estimate.unrealizedValueHigh)} annually`,
    },
  ];

  const maxValue = steps[0].value || 1;

  return (
    <div className="space-y-4">
      {steps.map((step, idx) => {
        const barWidth = Math.max(
          (step.value / maxValue) * 100,
          8
        );
        return (
          <div key={idx}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span
                  className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ backgroundColor: step.color }}
                >
                  {idx + 1}
                </span>
                <span className="text-sm font-medium text-secondary">
                  {step.label}
                </span>
              </div>
              <span
                className="text-sm font-bold"
                style={{ color: step.color }}
              >
                {fmtUSD(step.value)}
              </span>
            </div>
            <div className="h-8 bg-offwhite border border-light overflow-hidden">
              <div
                className="h-full flex items-center pl-3"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: step.color,
                  transition: "width 0.8s ease-out",
                }}
              >
                <span className="text-[10px] text-white font-medium truncate">
                  {step.detail}
                </span>
              </div>
            </div>
            {/* Connecting arrow */}
            {idx < steps.length - 1 && (
              <div className="flex justify-center py-1">
                <svg width="12" height="16" viewBox="0 0 12 16">
                  <path
                    d="M6 0 L6 12 L2 8 M6 12 L10 8"
                    stroke="#CED5DD"
                    strokeWidth="1.5"
                    fill="none"
                  />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Competitive Positioning Matrix (2x2)
// ---------------------------------------------------------------------------

function CompetitiveMatrix({
  capabilityScore,
  readinessScore,
  companyName,
}: {
  capabilityScore: number;
  readinessScore: number;
  companyName: string;
}) {
  // Convert 0-100 scores to position in the matrix (0-100%)
  const dotLeft = Math.max(5, Math.min(95, capabilityScore));
  const dotBottom = Math.max(5, Math.min(95, readinessScore));

  const quadrants = [
    {
      label: "Structure Without Capability",
      sublabel: "Governance-ready but lacking AI tools",
      row: 0,
      col: 0,
      bg: "#F5F6F8",
    },
    {
      label: "AI-Native Leaders",
      sublabel: "High capability + strong governance",
      row: 0,
      col: 1,
      bg: "#E8EDF2",
    },
    {
      label: "Pre-AI",
      sublabel: "Early stage across both dimensions",
      row: 1,
      col: 0,
      bg: "#FAFAFA",
    },
    {
      label: "Capability Without Structure",
      sublabel: "AI tools adopted without governance",
      row: 1,
      col: 1,
      bg: "#F5F6F8",
    },
  ];

  return (
    <div className="max-w-xl mx-auto">
      {/* Y-axis label */}
      <div className="flex">
        <div
          className="flex items-center justify-center"
          style={{ width: 28, writingMode: "vertical-rl" }}
        >
          <span
            className="text-[10px] font-semibold text-tertiary tracking-wider uppercase"
            style={{ transform: "rotate(180deg)" }}
          >
            Organizational Readiness
          </span>
        </div>
        <div className="flex-1">
          {/* Matrix grid */}
          <div
            className="relative border border-light"
            style={{ aspectRatio: "1 / 1" }}
          >
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
              {quadrants.map((q) => (
                <div
                  key={q.label}
                  className="flex flex-col items-center justify-center p-3 border border-light/50"
                  style={{
                    backgroundColor: q.bg,
                    gridRow: q.row + 1,
                    gridColumn: q.col + 1,
                  }}
                >
                  <p className="text-xs font-semibold text-secondary text-center leading-tight">
                    {q.label}
                  </p>
                  <p className="text-[9px] text-tertiary text-center mt-1">
                    {q.sublabel}
                  </p>
                </div>
              ))}
            </div>

            {/* Company position dot */}
            <div
              className="absolute z-10"
              style={{
                left: `${dotLeft}%`,
                bottom: `${dotBottom}%`,
                transform: "translate(-50%, 50%)",
              }}
            >
              <div className="relative">
                <div
                  className="w-5 h-5 rounded-full border-2 border-white"
                  style={{
                    backgroundColor: "#0B1D3A",
                    boxShadow: "0 0 0 3px rgba(11, 29, 58, 0.2)",
                  }}
                />
                <div
                  className="absolute top-full left-1/2 mt-1 px-2 py-0.5 text-[9px] font-bold text-white whitespace-nowrap"
                  style={{
                    backgroundColor: "#0B1D3A",
                    transform: "translateX(-50%)",
                  }}
                >
                  {companyName}
                </div>
              </div>
            </div>

            {/* Axis labels at midpoints */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-3 bg-tertiary" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-px h-3 bg-tertiary" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-3 bg-tertiary" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-3 bg-tertiary" />
          </div>

          {/* X-axis label */}
          <p className="text-[10px] font-semibold text-tertiary tracking-wider uppercase text-center mt-2">
            AI Capability
          </p>
        </div>
      </div>

      {/* Score readout */}
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div className="bg-offwhite border border-light p-3 text-center">
          <p className="text-[10px] text-tertiary uppercase tracking-wider">
            AI Capability Score
          </p>
          <p className="text-lg font-bold text-navy">
            {Math.round(capabilityScore)}
          </p>
        </div>
        <div className="bg-offwhite border border-light p-3 text-center">
          <p className="text-[10px] text-tertiary uppercase tracking-wider">
            Readiness Score
          </p>
          <p className="text-lg font-bold text-navy">
            {Math.round(readinessScore)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk Matrix (4x4 grid: Likelihood x Impact)
// ---------------------------------------------------------------------------

function RiskMatrix({
  dimensionScores,
}: {
  dimensionScores: DimensionScore[];
}) {
  const getScore = (dim: string) =>
    dimensionScores.find((d) => d.dimension === dim)?.normalizedScore || 50;

  // Invert scores: low dimension score = high risk
  const risks = [
    {
      label: "Shadow AI Proliferation",
      likelihood: Math.round((100 - getScore("authority_structure")) / 25) + 1,
      impact: 3,
      dim: "authority_structure",
    },
    {
      label: "Governance Gap Exposure",
      likelihood: Math.round((100 - getScore("authority_structure")) / 25) + 1,
      impact: 4,
      dim: "authority_structure",
    },
    {
      label: "Untracked AI Spend",
      likelihood: Math.round((100 - getScore("economic_translation")) / 25) + 1,
      impact: 3,
      dim: "economic_translation",
    },
    {
      label: "Decision Bottleneck Risk",
      likelihood: Math.round((100 - getScore("decision_velocity")) / 25) + 1,
      impact: 2,
      dim: "decision_velocity",
    },
    {
      label: "Workflow Fragmentation",
      likelihood: Math.round((100 - getScore("workflow_integration")) / 25) + 1,
      impact: 2,
      dim: "workflow_integration",
    },
    {
      label: "Adoption Stall Risk",
      likelihood: Math.round((100 - getScore("adoption_behavior")) / 25) + 1,
      impact: 3,
      dim: "adoption_behavior",
    },
  ].map((r) => ({
    ...r,
    likelihood: Math.min(4, Math.max(1, r.likelihood)),
    impact: Math.min(4, Math.max(1, r.impact)),
  }));

  const cellColor = (row: number, col: number) => {
    const severity = row + col; // higher = worse (row=impact desc, col=likelihood asc)
    if (severity >= 6) return { bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B" };
    if (severity >= 4) return { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E" };
    return { bg: "#DCFCE7", border: "#86EFAC", text: "#166534" };
  };

  const impactLabels = ["Critical", "High", "Medium", "Low"];
  const likelihoodLabels = ["Unlikely", "Possible", "Likely", "Very Likely"];

  return (
    <div>
      <div className="flex">
        {/* Y-axis label */}
        <div
          className="flex items-center justify-center"
          style={{ width: 24, writingMode: "vertical-rl" }}
        >
          <span
            className="text-[10px] font-semibold text-tertiary tracking-wider uppercase"
            style={{ transform: "rotate(180deg)" }}
          >
            Impact
          </span>
        </div>
        <div className="flex-1">
          {/* Impact labels + grid */}
          <div className="flex">
            <div className="flex flex-col justify-around pr-2" style={{ width: 60 }}>
              {impactLabels.map((l) => (
                <span key={l} className="text-[10px] text-tertiary text-right">
                  {l}
                </span>
              ))}
            </div>
            <div className="flex-1 grid grid-cols-4 grid-rows-4 gap-1">
              {[4, 3, 2, 1].map((impact) =>
                [1, 2, 3, 4].map((likelihood) => {
                  const rowIdx = 4 - impact;
                  const colIdx = likelihood - 1;
                  const colors = cellColor(
                    3 - rowIdx,
                    colIdx
                  );
                  const cellRisks = risks.filter(
                    (r) =>
                      r.impact === impact && r.likelihood === likelihood
                  );
                  return (
                    <div
                      key={`${impact}-${likelihood}`}
                      className="p-1 flex flex-col items-center justify-center text-center min-h-[56px]"
                      style={{
                        backgroundColor: colors.bg,
                        border: `1px solid ${colors.border}`,
                      }}
                    >
                      {cellRisks.map((cr, i) => (
                        <span
                          key={i}
                          className="text-[8px] leading-tight font-medium block"
                          style={{ color: colors.text }}
                        >
                          {cr.label}
                        </span>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          {/* X-axis labels */}
          <div className="flex" style={{ paddingLeft: 60 }}>
            <div className="flex-1 grid grid-cols-4 gap-1 mt-1">
              {likelihoodLabels.map((l) => (
                <span
                  key={l}
                  className="text-[10px] text-tertiary text-center"
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
          <p className="text-[10px] font-semibold text-tertiary tracking-wider uppercase text-center mt-2">
            Likelihood
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 justify-center">
        {[
          { label: "High Risk", bg: "#FEE2E2", border: "#FCA5A5" },
          { label: "Medium Risk", bg: "#FEF3C7", border: "#FCD34D" },
          { label: "Low Risk", bg: "#DCFCE7", border: "#86EFAC" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3"
              style={{
                backgroundColor: item.bg,
                border: `1px solid ${item.border}`,
              }}
            />
            <span className="text-[10px] text-tertiary">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 90-Day Action Timeline
// ---------------------------------------------------------------------------

function ActionTimeline({
  overallScore,
  weakestDimension,
}: {
  overallScore: number;
  weakestDimension: string;
}) {
  const phases = [
    {
      period: "Days 1 to 30",
      title: "Foundation",
      color: "#0B1D3A",
      actions: [
        {
          action: "Establish AI governance charter",
          owner: "CIO / CTO",
          priority: "Critical",
        },
        {
          action: `Address ${dimensionLabel(weakestDimension)} gaps`,
          owner: "Cross-functional team",
          priority: "High",
        },
        {
          action: "Audit current AI tool usage and shadow AI exposure",
          owner: "IT Security",
          priority: "High",
        },
      ],
    },
    {
      period: "Days 31 to 60",
      title: "Acceleration",
      color: "#364E6E",
      actions: [
        {
          action: "Launch pilot programs in highest-impact workflows",
          owner: "Business Unit Leads",
          priority: "High",
        },
        {
          action: "Implement AI spend tracking and ROI measurement",
          owner: "CFO / Finance",
          priority: "Medium",
        },
        {
          action: "Begin vendor rationalization assessment",
          owner: "Procurement / CTO",
          priority: "Medium",
        },
      ],
    },
    {
      period: "Days 61 to 90",
      title: "Scale",
      color: "#6B7F99",
      actions: [
        {
          action: overallScore >= 60
            ? "Expand successful pilots to enterprise scale"
            : "Evaluate pilot outcomes and iterate on approach",
          owner: "COO / CIO",
          priority: "High",
        },
        {
          action: "Present board-ready AI maturity progress report",
          owner: "CEO / CIO",
          priority: "Critical",
        },
        {
          action: "Set 12-month AI transformation roadmap",
          owner: "Executive Committee",
          priority: "High",
        },
      ],
    },
  ];

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {phases.map((phase) => (
        <div key={phase.period} className="border border-light">
          {/* Phase header */}
          <div
            className="p-4 text-white"
            style={{ backgroundColor: phase.color }}
          >
            <p className="text-xs font-semibold tracking-wider uppercase opacity-70">
              {phase.period}
            </p>
            <p className="text-base font-bold mt-0.5">{phase.title}</p>
          </div>
          {/* Action cards */}
          <div className="p-4 space-y-3">
            {phase.actions.map((a, idx) => (
              <div key={idx} className="bg-offwhite border border-light p-3">
                <p className="text-xs font-medium text-secondary leading-snug">
                  {a.action}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-tertiary">{a.owner}</span>
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5"
                    style={{
                      backgroundColor:
                        a.priority === "Critical"
                          ? "#FEE2E2"
                          : a.priority === "High"
                          ? "#FEF3C7"
                          : "#DCFCE7",
                      color:
                        a.priority === "Critical"
                          ? "#991B1B"
                          : a.priority === "High"
                          ? "#92400E"
                          : "#166534",
                    }}
                  >
                    {a.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Methodology Item
// ---------------------------------------------------------------------------

function MethodologyItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex-shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full"
        style={{ backgroundColor: "#0B1D3A" }}
      />
      <div>
        <span className="text-xs font-semibold text-secondary">{label}: </span>
        <span className="text-xs text-foreground/60">{value}</span>
      </div>
    </div>
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
