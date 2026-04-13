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

  const isDemo = params.get("demo") === "true";
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
            // In demo mode, skip paywall and show full report immediately
            if (isDemo) {
              setPhase("full");
            } else {
              setPhase("preview");
            }
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
          if (data.report?.companyProfile) {
            setResult((prev) => prev ? { ...prev, companyProfile: data.report.companyProfile } : prev);
          }
          setPhase(isDemo || data.paid ? "full" : "preview");
        } else {
          // Report generation failed but we still have diagnostic data
          if (!cancelled) setPhase(isDemo ? "full" : "preview");
        }
      } catch {
        if (!cancelled) setPhase(isDemo ? "full" : "preview");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, isDemo]);

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
                The scores above are the starting point. The full RLK AI Diagnostic
                and Board Brief translates these numbers into a board-ready
                narrative your leadership team can act on immediately.
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
              <div className="bg-white/10 border border-white/10 p-4">
                <p className="text-white text-sm font-semibold mb-1">
                  90-Day Action Plan
                </p>
                <p className="text-white/50 text-xs leading-relaxed">
                  15+ research-backed actions with named owners by role,
                  specific timeframes, measurable KPIs, and supporting evidence
                  from McKinsey, BCG, and Deloitte transformation research.
                </p>
              </div>
              <div className="bg-white/10 border border-white/10 p-4">
                <p className="text-white text-sm font-semibold mb-1">
                  Board Findings & Strategic Asks
                </p>
                <p className="text-white/50 text-xs leading-relaxed">
                  Board-ready findings with specific decision items, investment
                  asks, and governance recommendations aligned to NACD best
                  practices.
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
      {phase === "full" && result && (
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
                  {new Date(report?.generatedAt || result.completedAt).toLocaleDateString("en-US", {
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
                    report?.sections?.find(
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
                  report?.sections?.find(
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
              Three composite indices synthesize your responses across 61 behavioral
              questions into actionable measures of organizational AI capability. Each
              index combines signals from multiple dimensions to reveal how well your
              organization converts AI intent into organizational reality.
            </p>

            <div className="space-y-10">
              {result.compositeIndices.map((ci) => {
                const ciColor =
                  ci.score >= 70
                    ? "#0B1D3A"
                    : ci.score >= 40
                    ? "#6B7F99"
                    : "#A8B5C4";
                const ciTier =
                  ci.score >= 80
                    ? "Leading"
                    : ci.score >= 60
                    ? "Advancing"
                    : ci.score >= 40
                    ? "Developing"
                    : ci.score >= 20
                    ? "Emerging"
                    : "Foundational";
                return (
                  <div
                    key={ci.slug}
                    className="border border-light p-6"
                  >
                    <div className="flex flex-col md:flex-row md:items-start gap-6">
                      {/* Score prominence */}
                      <div className="flex-shrink-0 text-center md:text-left" style={{ minWidth: 120 }}>
                        <div
                          className="text-5xl font-bold"
                          style={{ color: ciColor }}
                        >
                          {ci.score}
                        </div>
                        <p className="text-xs text-tertiary mt-1">/ 100</p>
                        <p
                          className="text-xs font-semibold tracking-wider uppercase mt-2 px-2 py-0.5 inline-block text-white"
                          style={{ backgroundColor: ciColor }}
                        >
                          {ciTier}
                        </p>
                      </div>

                      {/* Details */}
                      <div className="flex-1">
                        <h4 className="text-base font-semibold text-secondary mb-2">
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

                        {/* Index description */}
                        <p className="text-sm text-foreground/70 leading-relaxed mb-4">
                          {compositeIndexDescription(ci.slug, ci.score, result.companyProfile.industry)}
                        </p>

                        {/* Benchmark context */}
                        <div className="bg-offwhite border border-light p-4 mb-4">
                          <p className="text-xs font-semibold text-tertiary tracking-wider uppercase mb-2">
                            Industry Context
                          </p>
                          <p className="text-sm text-foreground/60 leading-relaxed">
                            {compositeIndexBenchmark(ci.slug, ci.score, result.companyProfile.industry)}
                          </p>
                        </div>

                        {/* What organizations at this level typically experience */}
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div className="p-3 border border-light">
                            <p className="text-[10px] font-semibold text-tertiary tracking-wider uppercase mb-1">
                              Typical Risks at This Level
                            </p>
                            <p className="text-xs text-foreground/60 leading-relaxed">
                              {compositeIndexRisks(ci.slug, ci.score)}
                            </p>
                          </div>
                          <div className="p-3 border border-light">
                            <p className="text-[10px] font-semibold text-tertiary tracking-wider uppercase mb-1">
                              Path to Next Tier
                            </p>
                            <p className="text-xs text-foreground/60 leading-relaxed">
                              {compositeIndexNextSteps(ci.slug, ci.score)}
                            </p>
                          </div>
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
                        Organizational Implication
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
                  report?.sections?.find(
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
                  report?.sections?.find(
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
            <SectionHeader number={5} title="Competitive Positioning & Industry Intelligence" />
            <p className="text-sm text-foreground/60 mt-2 mb-4">
              Your position on the AI Capability vs. Organizational Readiness
              matrix, benchmarked against industry maturity norms. This analysis
              combines your diagnostic results with publicly available intelligence
              on competitor AI investment patterns, industry adoption trends, and
              research from McKinsey, Gartner, and BCG.
            </p>

            {/* Quadrant interpretation text */}
            <div className="bg-offwhite border border-light p-5 mb-8">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
                How to Read This Matrix
              </p>
              <p className="text-sm text-foreground/70 leading-relaxed">
                The horizontal axis measures <strong className="text-secondary">AI Capability</strong> (how effectively
                your organization adopts and integrates AI tools into workflows). The vertical axis measures{" "}
                <strong className="text-secondary">Organizational Readiness</strong> (governance structures, decision
                velocity, and economic translation capabilities). Organizations in the upper-right quadrant have
                both strong AI tooling and the organizational infrastructure to scale it. Organizations in other
                quadrants face distinct strategic challenges. According to McKinsey&apos;s 2024 Global AI Survey,
                only 8% of organizations achieve &quot;AI-Native Leader&quot; status across both dimensions simultaneously.
              </p>
            </div>

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

            {/* What your quadrant means */}
            <div className="mt-8 border border-light p-5">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                Your Quadrant Analysis
              </p>
              <p className="text-sm text-foreground/70 leading-relaxed">
                {getQuadrantAnalysis(
                  (result.dimensionScores.find((d) => d.dimension === "adoption_behavior")?.normalizedScore || 0) * 0.5 +
                  (result.dimensionScores.find((d) => d.dimension === "workflow_integration")?.normalizedScore || 0) * 0.5,
                  (result.dimensionScores.find((d) => d.dimension === "authority_structure")?.normalizedScore || 0) * 0.4 +
                  (result.dimensionScores.find((d) => d.dimension === "decision_velocity")?.normalizedScore || 0) * 0.3 +
                  (result.dimensionScores.find((d) => d.dimension === "economic_translation")?.normalizedScore || 0) * 0.3,
                  result.companyProfile.industry
                )}
              </p>
            </div>

            {/* Industry AI adoption benchmarks */}
            <div className="mt-6">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                Where Competitors Are Investing in AI
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {getCompetitorInvestmentAreas(result.companyProfile.industry).map((area, idx) => (
                  <div key={idx} className="bg-offwhite border border-light p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-white text-[10px] font-bold mt-0.5"
                        style={{ backgroundColor: ["#0B1D3A", "#364E6E", "#6B7F99", "#A8B5C4", "#CED5DD", "#0B1D3A"][idx % 6] }}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-secondary">{area.area}</p>
                        <p className="text-xs text-foreground/60 leading-relaxed mt-1">{area.detail}</p>
                        <p className="text-[10px] text-tertiary mt-1">{area.source}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Competitive positioning narrative */}
            <div className="mt-8 pt-6 border-t border-light">
              <MarkdownContent
                content={
                  report?.sections?.find(
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
            <SectionHeader number={6} title="Vendor & Partner Landscape Assessment" />
            <p className="text-sm text-foreground/60 mt-2 mb-4">
              Independent analysis of AI vendor positioning, buy/build/partner
              recommendations, and stack optimization opportunities. This assessment
              draws on Gartner Magic Quadrant positioning, Forrester Wave evaluations,
              and current market intelligence to recommend partners aligned to your
              maturity stage, industry, and strategic objectives.
            </p>

            {/* Vendor evaluation framework */}
            <div className="bg-offwhite border border-light p-5 mb-6">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                Evaluation Framework
              </p>
              <p className="text-sm text-foreground/70 leading-relaxed mb-4">
                Vendor recommendations are evaluated across six dimensions, weighted based on your
                organization&apos;s maturity stage and strategic priorities. Organizations at earlier maturity
                stages (Stages 1-2) should prioritize vendors with strong implementation support and
                low adoption barriers. Organizations at later stages (Stages 3-5) should prioritize
                platform extensibility, enterprise governance, and total cost of ownership.
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { label: "Fit", desc: "Use case alignment" },
                  { label: "Scale", desc: "Enterprise readiness" },
                  { label: "Cost", desc: "TCO & pricing" },
                  { label: "Risk", desc: "Lock-in & continuity" },
                  { label: "Support", desc: "Implementation depth" },
                  { label: "Ecosystem", desc: "Integration breadth" },
                ].map((crit) => (
                  <div
                    key={crit.label}
                    className="bg-white border border-light p-2 text-center"
                  >
                    <p className="text-xs font-semibold text-secondary">
                      {crit.label}
                    </p>
                    <p className="text-[9px] text-tertiary mt-0.5">
                      {crit.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Gartner-style quadrant reference */}
            <div className="border border-light p-5 mb-6">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                Market Positioning Context (Gartner / Forrester)
              </p>
              <p className="text-sm text-foreground/70 leading-relaxed mb-4">
                {getGartnerContext(result.companyProfile.industry, result.stageClassification.primaryStage)}
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {getRecommendedPartnerCategories(result.companyProfile.industry, result.stageClassification.primaryStage).map((cat, idx) => (
                  <div key={idx} className="bg-offwhite border border-light p-4">
                    <p className="text-sm font-semibold text-secondary mb-1">{cat.category}</p>
                    <p className="text-xs text-foreground/60 leading-relaxed">{cat.description}</p>
                    <p className="text-xs text-navy font-medium mt-2">{cat.vendors}</p>
                    <p className="text-[10px] text-tertiary mt-1">{cat.source}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Buy/Build/Partner Decision Framework */}
            <div className="border border-light p-5 mb-6">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                Buy / Build / Partner Recommendation
              </p>
              <p className="text-sm text-foreground/70 leading-relaxed mb-4">
                Based on your maturity stage ({result.stageClassification.stageName}), industry regulatory
                intensity ({result.companyProfile.regulatoryIntensity}), and use case portfolio, the following
                framework applies to your organization&apos;s AI technology decisions:
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  {
                    strategy: "Buy",
                    when: "Commodity capabilities (chatbots, document processing, analytics dashboards) where differentiation is not a priority",
                    guidance: result.stageClassification.primaryStage <= 2
                      ? "Recommended for most use cases at your maturity stage. Focus on time-to-value over customization."
                      : "Appropriate for non-differentiating capabilities. Ensure vendor contracts include data portability.",
                  },
                  {
                    strategy: "Build",
                    when: "Core differentiators where proprietary data, models, or workflows create competitive advantage",
                    guidance: result.stageClassification.primaryStage <= 2
                      ? "Exercise caution. Building custom AI requires mature MLOps and data infrastructure you may not yet have."
                      : "Appropriate for strategic capabilities. Invest in MLOps and data platform to support custom development.",
                  },
                  {
                    strategy: "Partner",
                    when: "Complex transformations requiring domain expertise, organizational change management, or accelerated timelines",
                    guidance: result.stageClassification.primaryStage <= 2
                      ? "Strongly recommended. A strategic implementation partner can compress your learning curve by 12-18 months."
                      : "Selective use for specialized domains. Your internal capabilities should lead most initiatives.",
                  },
                ].map((s) => (
                  <div key={s.strategy} className="bg-offwhite border border-light p-4">
                    <p className="text-sm font-bold text-navy mb-2">{s.strategy}</p>
                    <p className="text-xs text-foreground/60 leading-relaxed mb-2">{s.when}</p>
                    <div className="border-t border-light pt-2 mt-2">
                      <p className="text-xs text-secondary font-medium leading-relaxed">{s.guidance}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {report?.sections?.find((s) => s.slug === "vendor-landscape")
              ?.content ? (
              <div className="mt-6 pt-6 border-t border-light">
                <MarkdownContent
                  content={
                    report?.sections?.find(
                      (s) => s.slug === "vendor-landscape"
                    )?.content || ""
                  }
                />
              </div>
            ) : null}
          </section>

          {/* ================================================================= */}
          {/* SECTION 7: SECURITY & GOVERNANCE RISK MATRIX                      */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-8 md:p-10 mb-8">
            <SectionHeader
              number={7}
              title="Security & Governance Risk Assessment"
            />
            <p className="text-sm text-foreground/60 mt-2 mb-4">
              Risk exposure mapped across likelihood and impact, derived from
              your diagnostic dimension scores and governance posture. This assessment
              integrates your survey responses with industry-specific regulatory
              requirements and emerging AI governance standards.
            </p>

            {/* Detailed risk context */}
            <div className="bg-offwhite border border-light p-5 mb-8">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                Understanding This Assessment
              </p>
              <p className="text-sm text-foreground/70 leading-relaxed mb-3">
                Your risk profile is derived from inverting your dimension scores: low governance
                maturity translates to high governance risk, low adoption structure translates to high
                shadow AI risk, and so on. Each risk is mapped on a 4x4 matrix of <strong className="text-secondary">Likelihood</strong> (how
                probable the risk materializes based on your current posture) versus <strong className="text-secondary">Impact</strong> (the
                potential business consequence if it does).
              </p>
              <p className="text-sm text-foreground/70 leading-relaxed">
                According to Gartner&apos;s 2024 AI Risk Management survey, 62% of organizations have
                experienced at least one AI-related risk event (data leak, biased output, compliance
                violation) in the past 18 months. Organizations with formal AI governance frameworks
                experienced 73% fewer material incidents. The EU AI Act (effective August 2025) and
                state-level US regulations (Colorado AI Act, California AI Transparency Act) are
                increasing the regulatory cost of inadequate governance.
              </p>
            </div>

            {/* Risk breakdown cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {getRiskDetails(result.dimensionScores).map((risk, idx) => (
                <div key={idx} className="border border-light p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-3 h-3 flex-shrink-0"
                      style={{
                        backgroundColor: risk.severity === "high" ? "#FCA5A5" : risk.severity === "medium" ? "#FCD34D" : "#86EFAC",
                      }}
                    />
                    <p className="text-sm font-semibold text-secondary">{risk.label}</p>
                  </div>
                  <p className="text-xs text-foreground/60 leading-relaxed mb-2">{risk.description}</p>
                  <div className="bg-offwhite border border-light p-2 mt-2">
                    <p className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">Mitigation</p>
                    <p className="text-xs text-foreground/60 leading-relaxed">{risk.mitigation}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Risk Matrix visualization */}
            <RiskMatrix dimensionScores={result.dimensionScores} />

            {/* Regulatory landscape context */}
            <div className="mt-6 border border-light p-5">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                Regulatory Landscape for {result.companyProfile.industry.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </p>
              <p className="text-sm text-foreground/70 leading-relaxed">
                {getRegulatoryContext(result.companyProfile.industry, result.companyProfile.regulatoryIntensity)}
              </p>
            </div>

            {/* Security narrative */}
            <div className="mt-8 pt-6 border-t border-light">
              <MarkdownContent
                content={
                  report?.sections?.find(
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
            <SectionHeader number={8} title="90-Day Transformation Action Plan" />
            <p className="text-sm text-foreground/60 mt-2 mb-4">
              A research-backed, role-specific action plan designed for immediate
              executive mobilization. Each action is informed by your diagnostic scores,
              industry benchmarks, competitive intelligence, and leading transformation
              frameworks from McKinsey, BCG, and Deloitte.
            </p>

            {/* Strategic context */}
            <div className="bg-offwhite border border-light p-5 mb-8">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
                Strategic Context
              </p>
              <p className="text-sm text-foreground/70 leading-relaxed">
                {get90DayContext(result.overallScore, result.stageClassification.primaryStage, result.companyProfile.industry)}
              </p>
            </div>

            {/* Timeline visual */}
            <ActionTimeline
              overallScore={result.overallScore}
              weakestDimension={
                [...result.dimensionScores].sort(
                  (a, b) => a.normalizedScore - b.normalizedScore
                )[0]?.dimension || "adoption_behavior"
              }
              industry={result.companyProfile.industry}
              stage={result.stageClassification.primaryStage}
              dimensionScores={result.dimensionScores}
            />

            {/* AI narrative */}
            <div className="mt-8 pt-6 border-t border-light">
              <MarkdownContent
                content={
                  report?.sections?.find(
                    (s) => s.slug === "90-day-action-plan"
                  )?.content || ""
                }
              />
            </div>

            {/* Success metrics */}
            <div className="mt-6 border border-light p-5">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                90-Day Success Metrics
              </p>
              <p className="text-sm text-foreground/60 leading-relaxed mb-4">
                Track these KPIs weekly to measure transformation momentum. Research from BCG&apos;s
                2024 AI Advantage report shows organizations that define measurable 90-day milestones
                are 2.3x more likely to sustain AI transformation beyond the first year.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {get90DayKPIs(result.overallScore, result.companyProfile.industry).map((kpi, idx) => (
                  <div key={idx} className="bg-offwhite border border-light p-3">
                    <p className="text-xs font-semibold text-secondary mb-1">{kpi.metric}</p>
                    <p className="text-lg font-bold text-navy">{kpi.target}</p>
                    <p className="text-[10px] text-tertiary mt-1">{kpi.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Data sources callout */}
            <div className="mt-6 bg-offwhite border border-light p-5">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
                Data Sources Informing This Plan
              </p>
              <p className="text-sm text-foreground/60 leading-relaxed">
                This action plan is informed by: diagnostic scores across 61
                behavioral questions, industry benchmarks for{" "}
                {result.companyProfile.industry
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
                , competitive intelligence, SEC EDGAR filings, Google News
                signals, vendor intelligence, regulatory analysis, McKinsey Global
                AI Survey (2024), BCG AI Advantage Report (2024), Gartner AI
                Maturity Model, Deloitte State of AI in the Enterprise (2024),
                and sector-specific digital transformation case studies.
              </p>
            </div>
          </section>

          {/* ================================================================= */}
          {/* SECTION 9: BOARD FINDINGS & ASKS                                  */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-8 md:p-10 mb-8">
            <SectionHeader number={9} title="Board Findings & Strategic Asks" />
            <p className="text-sm text-foreground/60 mt-2 mb-6">
              Key findings formatted for board-level presentation, with specific
              asks and governance recommendations. According to NACD&apos;s 2024 Board
              Oversight of AI report, 78% of boards now consider AI a top-three
              strategic priority, yet only 23% feel adequately equipped to provide
              effective oversight.
            </p>

            {/* Board-ready headline findings */}
            <div className="border-2 border-navy p-6 mb-6">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-4">
                Board-Ready Headline Findings
              </p>
              <div className="space-y-4">
                {getBoardFindings(result.overallScore, result.stageClassification, result.dimensionScores, result.economicEstimate, result.companyProfile).map((finding, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div
                      className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-white text-xs font-bold mt-0.5"
                      style={{ backgroundColor: finding.severity === "critical" ? "#991B1B" : finding.severity === "high" ? "#92400E" : "#0B1D3A" }}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-secondary">{finding.headline}</p>
                      <p className="text-xs text-foreground/60 leading-relaxed mt-1">{finding.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* How boards at this stage support AI transformation */}
            <div className="border border-light p-5 mb-6">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                How Boards Can Support Organizations at Stage {result.stageClassification.primaryStage}
              </p>
              <p className="text-sm text-foreground/70 leading-relaxed mb-4">
                {getBoardSupportNarrative(result.stageClassification.primaryStage)}
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {getBoardActions(result.stageClassification.primaryStage, result.companyProfile.industry).map((action, idx) => (
                  <div key={idx} className="bg-offwhite border border-light p-4">
                    <p className="text-sm font-semibold text-secondary mb-1">{action.action}</p>
                    <p className="text-xs text-foreground/60 leading-relaxed">{action.rationale}</p>
                    <p className="text-[10px] text-navy font-medium mt-2">{action.owner}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Strategic asks of the board */}
            <div className="bg-navy/5 border border-navy/10 p-6">
              <p className="text-xs font-semibold tracking-widest uppercase text-navy mb-4">
                Recommended Board Asks
              </p>
              <p className="text-sm text-foreground/70 leading-relaxed mb-4">
                Based on this diagnostic, the following asks should be presented to the board
                for discussion and resolution. These are structured as decision items, not
                informational updates, per NACD guidance on effective board AI governance.
              </p>
              <div className="space-y-3">
                {getBoardAsks(result.overallScore, result.stageClassification.primaryStage, result.economicEstimate).map((ask, idx) => (
                  <div key={idx} className="bg-white border border-light p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-[9px] font-bold px-2 py-0.5 text-white"
                        style={{ backgroundColor: ask.type === "decision" ? "#0B1D3A" : ask.type === "investment" ? "#364E6E" : "#6B7F99" }}
                      >
                        {ask.type.toUpperCase()}
                      </span>
                      <p className="text-sm font-semibold text-secondary">{ask.title}</p>
                    </div>
                    <p className="text-xs text-foreground/60 leading-relaxed">{ask.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* SECTION 10: METHODOLOGY & DATA SOURCES                            */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-8 md:p-10 mb-8">
            <SectionHeader number={10} title="Methodology and Data Sources" />

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
                    value="61 behavioral questions"
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
                        "61 questions across 5 dimensions, completed by organizational respondent",
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
          {/* ================================================================= */}
          {/* DISCLAIMER                                                        */}
          {/* ================================================================= */}
          <section className="bg-offwhite border border-light p-6 mb-8">
            <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
              Methodology & AI Enrichment Disclaimer
            </p>
            <p className="text-[11px] text-foreground/50 leading-relaxed mb-3">
              The RLK AI Diagnostic and Board Brief methodology is proprietary intellectual property developed by
              Ryan King, drawing on frameworks refined across a decade of management consulting at
              McKinsey & Company and Deloitte. The five-dimension behavioral diagnostic model, composite
              index formulas, stage classification system, and economic translation framework are original
              RLK methodology.
            </p>
            <p className="text-[11px] text-foreground/50 leading-relaxed mb-3">
              Market intelligence, competitive analysis, industry benchmarks, vendor landscape data,
              regulatory context, and certain narrative sections of this report are enriched using
              AI-powered research tools that aggregate and synthesize publicly available information
              including SEC EDGAR filings, published industry reports, news sources, and analyst research.
              While AI assists in gathering and synthesizing external intelligence at scale, all analytical
              frameworks, scoring methodologies, and strategic recommendations are grounded in the RLK
              proprietary methodology.
            </p>
            <p className="text-[11px] text-foreground/50 leading-relaxed">
              This report is prepared for strategic planning purposes. External data points and benchmarks
              referenced herein are drawn from the latest available public sources and research publications.
              Organizations should validate specific data points against their own records and consult
              qualified advisors before making material investment decisions based on this analysis.
            </p>
          </section>

          <div className="rlk-gradient-bar-thick mt-2 mb-4" />
          <div className="text-center py-4">
            <p className="text-xs text-tertiary">
              This report is confidential and prepared solely for{" "}
              {result.companyProfile.companyName}. Methodology developed by
              Ryan King based on frameworks refined across a decade of
              management consulting at McKinsey and Deloitte.
            </p>
            <p className="text-[10px] text-tertiary/60 mt-2">
              RLK AI Diagnostic and Board Brief | {new Date().getFullYear()} | All rights
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
          Return to RLK AI Diagnostic and Board Brief
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
            RLK AI Diagnostic and Board Brief
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
  industry,
  stage,
  dimensionScores,
}: {
  overallScore: number;
  weakestDimension: string;
  industry?: string;
  stage?: number;
  dimensionScores?: DimensionScore[];
}) {
  const effectiveStage = stage || (overallScore >= 80 ? 5 : overallScore >= 60 ? 4 : overallScore >= 40 ? 3 : overallScore >= 20 ? 2 : 1);
  const secondWeakest = dimensionScores
    ? [...dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore)[1]?.dimension || "workflow_integration"
    : "workflow_integration";
  const strongest = dimensionScores
    ? [...dimensionScores].sort((a, b) => b.normalizedScore - a.normalizedScore)[0]?.dimension || "adoption_behavior"
    : "adoption_behavior";

  const phases = [
    {
      period: "Days 1 to 30",
      title: "Diagnose & Mobilize",
      subtitle: "Establish baseline, secure buy-in, quick wins",
      color: "#0B1D3A",
      actions: [
        {
          action: "Conduct comprehensive AI tool audit across all business units; map shadow AI usage, spend, and risk exposure",
          owner: "CIO / IT Security",
          priority: "Critical",
          detail: "BCG research shows 67% of enterprises underestimate shadow AI usage by 3x. A thorough audit prevents policy blind spots.",
        },
        {
          action: "Establish AI governance charter with clear decision rights, risk tiers, and escalation paths",
          owner: "CIO / General Counsel",
          priority: "Critical",
          detail: "Per McKinsey, organizations with formalized AI governance capture 20-30% more value from AI investments.",
        },
        {
          action: `Launch diagnostic deep-dive on ${dimensionLabel(weakestDimension)} (weakest dimension) with root cause analysis and improvement targets`,
          owner: "Cross-functional task force",
          priority: "High",
          detail: `Your ${dimensionLabel(weakestDimension)} score is your primary constraint. Addressing it first creates the largest marginal improvement.`,
        },
        {
          action: "Identify and launch 2-3 quick-win AI pilots in highest-readiness business units",
          owner: "Business Unit Leads / CTO",
          priority: "High",
          detail: "Quick wins build organizational confidence. Target workflows with clear before/after metrics and visible impact.",
        },
        {
          action: effectiveStage <= 2
            ? "Appoint or hire a senior AI leader with budget authority and cross-functional mandate"
            : "Review and strengthen AI center of excellence mandate and resourcing",
          owner: "CEO / CHRO",
          priority: "High",
          detail: effectiveStage <= 2
            ? "Deloitte's 2024 survey: organizations with a dedicated AI leader are 2.6x more likely to scale AI successfully."
            : "At your maturity stage, the focus shifts from establishing leadership to empowering distributed AI ownership.",
        },
      ],
    },
    {
      period: "Days 31 to 60",
      title: "Build & Accelerate",
      subtitle: "Scale pilots, build capabilities, measure value",
      color: "#364E6E",
      actions: [
        {
          action: "Deploy AI value measurement framework across all active initiatives with standardized ROI methodology",
          owner: "CFO / Finance",
          priority: "Critical",
          detail: "Only 26% of AI initiatives have formal ROI tracking (Gartner 2024). This framework enables data-driven portfolio decisions.",
        },
        {
          action: `Address ${dimensionLabel(secondWeakest)} (second-weakest dimension) with targeted intervention plan`,
          owner: "Relevant functional leader",
          priority: "High",
          detail: "Parallel improvement across your two weakest dimensions accelerates overall maturity progression.",
        },
        {
          action: "Execute vendor rationalization: consolidate overlapping tools, renegotiate contracts, establish preferred vendor tiers",
          owner: "Procurement / CTO",
          priority: "High",
          detail: "The average enterprise uses 4.2 AI vendors (Gartner 2024). Rationalization typically reduces costs 15-25% while improving governance.",
        },
        {
          action: "Launch organization-wide AI literacy program with role-specific learning paths and completion targets",
          owner: "CHRO / Learning & Development",
          priority: "High",
          detail: "McKinsey reports that AI-skilled workforces capture 3x more value. Target 40% workforce AI literacy by Day 90.",
        },
        {
          action: overallScore >= 60
            ? "Begin scaling successful pilots with dedicated change management and integration resources"
            : "Evaluate pilot outcomes against pre-defined success criteria; iterate or pivot based on data",
          owner: "COO / Business Unit Leads",
          priority: "Medium",
          detail: overallScore >= 60
            ? "Your maturity supports scaling. Focus on change management: 70% of AI scaling failures are organizational, not technical."
            : "Disciplined pilot evaluation prevents premature scaling. Document learnings for institutional knowledge.",
        },
      ],
    },
    {
      period: "Days 61 to 90",
      title: "Scale & Sustain",
      subtitle: "Institutionalize, report to board, set 12-month roadmap",
      color: "#6B7F99",
      actions: [
        {
          action: "Compile and present board-ready AI maturity progress report with quantified value capture and risk posture update",
          owner: "CEO / CIO",
          priority: "Critical",
          detail: "Board engagement is critical for sustained investment. Include: value captured, risks mitigated, competitive positioning, and resource asks.",
        },
        {
          action: `Leverage ${dimensionLabel(strongest)} (strongest dimension) to accelerate lagging areas through internal best-practice transfer`,
          owner: "AI Center of Excellence",
          priority: "High",
          detail: "Your strongest dimension contains proven organizational capabilities. Systematically transferring these practices to weaker areas is the fastest path to balanced maturity.",
        },
        {
          action: "Define 12-month AI transformation roadmap with quarterly milestones, budget allocation, and executive accountability",
          owner: "Executive Committee",
          priority: "Critical",
          detail: "BCG's AI Advantage report: organizations with multi-year AI roadmaps are 1.7x more likely to achieve positive AI ROI.",
        },
        {
          action: "Establish ongoing competitive intelligence monitoring for AI developments in your sector",
          owner: "Strategy / Business Development",
          priority: "Medium",
          detail: "AI competitive dynamics shift quarterly. Standing intelligence prevents strategic surprise.",
        },
        {
          action: effectiveStage <= 3
            ? "Engage strategic implementation partner for capability areas beyond internal expertise"
            : "Evaluate build-vs-buy decisions for next wave of AI capabilities using updated maturity data",
          owner: "CTO / Procurement",
          priority: "Medium",
          detail: effectiveStage <= 3
            ? "Partnering can compress timelines by 12-18 months for organizations at your maturity stage."
            : "At your maturity level, strategic build decisions in differentiating capabilities create lasting competitive advantage.",
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {phases.map((phase) => (
        <div key={phase.period} className="border border-light">
          {/* Phase header */}
          <div
            className="p-5 text-white"
            style={{ backgroundColor: phase.color }}
          >
            <p className="text-xs font-semibold tracking-wider uppercase opacity-70">
              {phase.period}
            </p>
            <p className="text-lg font-bold mt-0.5">{phase.title}</p>
            <p className="text-xs text-white/60 mt-1">{phase.subtitle}</p>
          </div>
          {/* Action cards */}
          <div className="p-4 space-y-3">
            {phase.actions.map((a, idx) => (
              <div key={idx} className="bg-offwhite border border-light p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-medium text-secondary leading-snug flex-1">
                    {a.action}
                  </p>
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5 flex-shrink-0"
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
                <p className="text-[11px] text-foreground/50 leading-relaxed mb-2">
                  {a.detail}
                </p>
                <div className="border-t border-light pt-2">
                  <span className="text-[10px] font-semibold text-tertiary uppercase tracking-wider">Owner: </span>
                  <span className="text-[10px] text-tertiary">{a.owner}</span>
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
// Composite Index Deep Dive Helpers
// ---------------------------------------------------------------------------

function compositeIndexDescription(slug: string, score: number, industry: string): string {
  const ind = industry.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const descriptions: Record<string, Record<string, string>> = {
    "operational-readiness": {
      high: `Your organization demonstrates strong operational readiness for AI at scale. This index measures the structural and procedural foundation required to move AI from isolated experiments to enterprise-wide deployment. A score of ${score} indicates that governance frameworks, decision rights, and approval structures are sufficiently mature to support rapid AI deployment without creating organizational bottleneck or compliance risk. In ${ind}, this positions you among the top quartile of organizations prepared to operationalize AI across core business functions.`,
      mid: `Your operational readiness score of ${score} suggests a mixed picture: some foundational governance and structural elements are in place, but gaps remain that will constrain scaling. Organizations at this level in ${ind} typically have pockets of well-governed AI usage alongside areas where approval friction, unclear ownership, or inconsistent policies slow progress. The primary risk is a "governance ceiling" where AI initiatives stall not because of technology limitations but because the organizational structure cannot support the pace of deployment.`,
      low: `An operational readiness score of ${score} reveals significant structural barriers to AI deployment. Your organization likely lacks formalized AI governance, clear decision rights for AI initiatives, or standardized approval processes. In ${ind}, organizations at this level face a critical choice: invest in governance infrastructure now, or watch AI initiatives repeatedly stall in approval cycles and organizational ambiguity. McKinsey's 2024 research shows that 72% of failed AI scaling efforts cite organizational readiness, not technology, as the primary obstacle.`,
    },
    "value-capture-efficiency": {
      high: `Your value capture efficiency score of ${score} indicates your organization has built effective mechanisms to translate AI activity into measurable financial outcomes. This index evaluates not just whether AI is being used, but whether that usage produces quantifiable business value. In ${ind}, this places you among organizations that can credibly demonstrate AI ROI to the board, investors, and analysts. You have the economic translation capability that most organizations struggle to develop.`,
      mid: `A value capture efficiency score of ${score} indicates your organization is generating some value from AI but has significant unrealized potential. The gap is typically not in AI tool selection but in the "last mile" of value capture: connecting AI outputs to financial metrics, establishing baseline measurements, and tracking productivity gains through to the bottom line. In ${ind}, this is the most common score range: organizations that have invested in AI but cannot yet demonstrate clear financial returns to satisfy board-level scrutiny.`,
      low: `A value capture efficiency score of ${score} signals that your organization is investing in AI without capturing proportionate financial value. This is the single largest risk factor in your diagnostic: AI spend without demonstrable return erodes executive confidence and makes future investment harder to justify. In ${ind}, organizations at this level typically see AI as a cost center rather than a value driver. Deloitte's 2024 State of AI report found that 58% of organizations with low value capture scores eventually reduce AI investment, creating a negative spiral.`,
    },
    "transformation-velocity": {
      high: `Your transformation velocity score of ${score} indicates your organization can move from AI insight to AI action at a pace that creates competitive advantage. This index measures the speed and effectiveness of your organization's AI decision-making, experimentation, and deployment cycle. In ${ind}, this velocity differentiates market leaders from followers. Organizations at this level can identify an AI opportunity, pilot it, evaluate results, and scale or kill within a single quarter.`,
      mid: `A transformation velocity score of ${score} suggests your organization moves at a moderate pace on AI initiatives, but faces friction points that prevent best-in-class responsiveness. In ${ind}, this typically manifests as 3-6 month deployment cycles for initiatives that leading organizations complete in 4-8 weeks. The drag often comes from approval layers, vendor procurement timelines, or the gap between AI strategy and operational execution.`,
      low: `A transformation velocity score of ${score} reveals that your organization struggles to convert AI decisions into deployed capabilities. In ${ind}, organizations at this level typically take 6-12+ months to move from use case identification to pilot deployment. This pace is incompatible with the current rate of AI market evolution, where competitive positioning can shift quarterly. Gartner's 2024 AI Adoption survey notes that organizations in the bottom quartile of deployment velocity are 4x more likely to be disrupted by AI-native competitors.`,
    },
  };
  const tier = score >= 70 ? "high" : score >= 40 ? "mid" : "low";
  return descriptions[slug]?.[tier] || `This index measures a critical dimension of your organization's AI capability. Your score of ${score} reflects the current state of this capability relative to industry benchmarks in ${ind}.`;
}

function compositeIndexBenchmark(slug: string, score: number, industry: string): string {
  const ind = industry.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const benchmarks: Record<string, string> = {
    "operational-readiness": `According to McKinsey's 2024 Global AI Survey, the median operational readiness score in ${ind} is approximately 42/100. Organizations scoring above 65 are considered "governance-ready" for enterprise-scale AI deployment. Your score of ${score} places you ${score >= 65 ? "above" : score >= 42 ? "near" : "below"} the industry median. Gartner projects that by 2027, 75% of large enterprises will have formal AI governance frameworks, up from 35% today.`,
    "value-capture-efficiency": `BCG's 2024 AI Advantage report found that only 10% of companies generate significant financial returns from AI, while 70% report minimal impact. In ${ind}, the median value capture score is approximately 38/100. Your score of ${score} positions you ${score >= 60 ? "among the top performers" : score >= 38 ? "near the industry average" : "below the median"} for translating AI activity into financial outcomes. The gap between AI spending and value capture is the defining challenge of enterprise AI in 2024-2025.`,
    "transformation-velocity": `Deloitte's 2024 State of AI in the Enterprise survey reports that the average time from AI use case identification to production deployment is 8.4 months across industries. In ${ind}, this ranges from 6 to 14 months depending on regulatory intensity. Organizations in the top quartile for velocity deploy in under 10 weeks. Your velocity score of ${score} suggests your typical deployment cycle is ${score >= 70 ? "competitive with industry leaders" : score >= 40 ? "near the industry average but with room for acceleration" : "significantly longer than peers, creating competitive risk"}.`,
  };
  return benchmarks[slug] || `Industry benchmark data for ${ind} suggests organizations at your score level have specific opportunities for improvement relative to top-quartile performers.`;
}

function compositeIndexRisks(slug: string, score: number): string {
  const risks: Record<string, Record<string, string>> = {
    "operational-readiness": {
      high: "Over-governance risk: processes that slow innovation. Monitor for bureaucracy creep and ensure governance enables rather than constrains.",
      mid: "Inconsistent governance across business units creates compliance gaps. Shadow AI may be growing in under-governed areas.",
      low: "Critical exposure: ungoverned AI usage, potential regulatory violations, and inability to scale any AI initiative beyond isolated experiments.",
    },
    "value-capture-efficiency": {
      high: "Optimization plateau: incremental gains become harder to find. Risk of over-indexing on measurable value at the expense of transformative but harder-to-measure initiatives.",
      mid: "AI fatigue risk: stakeholders may lose confidence if value capture doesn't improve within 2-3 quarters. CFO scrutiny will increase.",
      low: "Investment at risk: inability to demonstrate ROI threatens continued AI funding. Board patience for unquantified AI spend typically lasts 12-18 months.",
    },
    "transformation-velocity": {
      high: "Speed-quality tradeoff: rapid deployment may introduce technical debt or skip adequate testing. Ensure velocity doesn't compromise reliability.",
      mid: "Competitive window risk: moderate velocity may be insufficient in fast-moving sectors where AI capabilities shift quarterly.",
      low: "Disruption vulnerability: slow transformation velocity leaves the organization exposed to AI-native competitors and new market entrants.",
    },
  };
  const tier = score >= 70 ? "high" : score >= 40 ? "mid" : "low";
  return risks[slug]?.[tier] || "Monitor for emerging risks as your maturity evolves.";
}

function compositeIndexNextSteps(slug: string, score: number): string {
  const steps: Record<string, Record<string, string>> = {
    "operational-readiness": {
      high: "Focus on distributed governance: empower business units with guardrails rather than centralized approval. Target federated AI ownership.",
      mid: "Standardize governance frameworks across all business units. Establish pre-approved fast-track paths for low-risk AI deployments.",
      low: "Priority: establish foundational AI governance charter, appoint AI ownership, and create a basic approval framework within 30 days.",
    },
    "value-capture-efficiency": {
      high: "Expand from cost savings to revenue generation. Target AI-enabled products/services and new market opportunities.",
      mid: "Implement standardized ROI measurement across all AI initiatives. Establish baseline metrics before launching new projects.",
      low: "Start with 2-3 use cases where value is easiest to measure (process automation, cost reduction). Build credibility before scaling.",
    },
    "transformation-velocity": {
      high: "Optimize for AI portfolio management: parallel initiatives, shared infrastructure, and organizational learning across projects.",
      mid: "Reduce approval layers for standard AI deployments. Establish pre-approved tool catalog and self-service deployment capabilities.",
      low: "Start with a single fast-track pilot to demonstrate achievable velocity. Use success to justify streamlined processes.",
    },
  };
  const tier = score >= 70 ? "high" : score >= 40 ? "mid" : "low";
  return steps[slug]?.[tier] || "Focus on the next logical step based on your current maturity position.";
}

// ---------------------------------------------------------------------------
// Competitive Positioning Helpers
// ---------------------------------------------------------------------------

function getQuadrantAnalysis(capScore: number, readScore: number, industry: string): string {
  const ind = industry.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  if (capScore >= 50 && readScore >= 50) {
    return `Your organization sits in the AI-Native Leaders quadrant, demonstrating both strong AI capability and organizational readiness in ${ind}. This is the target state, achieved by approximately 8% of organizations according to McKinsey's 2024 Global AI Survey. Your challenge now is to maintain leadership velocity and prevent complacency. Organizations in this quadrant should focus on AI-enabled revenue generation, competitive moat building through proprietary models, and establishing themselves as industry standard-setters for AI best practices.`;
  }
  if (capScore >= 50 && readScore < 50) {
    return `Your organization demonstrates Capability Without Structure: strong AI tool adoption and workflow integration, but insufficient governance, decision velocity, or economic translation to sustain and scale these capabilities in ${ind}. This is a common and dangerous position: McKinsey notes that 35% of organizations in this quadrant experience a "capability crash" within 18 months as ungoverned AI creates risk events or fails to demonstrate financial returns. The priority is urgent governance investment without slowing the innovation that got you here.`;
  }
  if (capScore < 50 && readScore >= 50) {
    return `Your organization has Structure Without Capability: governance frameworks and organizational readiness are ahead of actual AI deployment in ${ind}. While this is a safer position than the reverse, it represents unrealized potential. Your organizational infrastructure can support significantly more AI than you're deploying. The risk is over-governance: processes designed for AI oversight that have no AI to oversee. BCG's research suggests organizations in this quadrant should rapidly deploy AI within their existing governance frameworks, focusing on high-impact use cases that leverage their structural advantage.`;
  }
  return `Your organization is in the Pre-AI quadrant for ${ind}, with both AI capability and organizational readiness below the midpoint. This is the starting position for approximately 40% of enterprises. The strategic priority is simultaneous investment in both dimensions, but with sequencing: start with 2-3 governed pilot programs that build capability and governance muscle simultaneously. Organizations that try to build governance before deploying AI (or vice versa) progress slower than those that develop both in tandem.`;
}

function getCompetitorInvestmentAreas(industry: string): { area: string; detail: string; source: string }[] {
  const areas: Record<string, { area: string; detail: string; source: string }[]> = {
    financial_services: [
      { area: "AI-Powered Fraud Detection & AML", detail: "Major banks are deploying real-time transaction monitoring using ML models that reduce false positives by 40-60%. JPMorgan, HSBC, and Goldman Sachs have all disclosed significant AI fraud detection investments.", source: "Source: McKinsey Banking Annual Review 2024" },
      { area: "Conversational AI in Wealth Management", detail: "Robo-advisory platforms are evolving into AI co-pilots for financial advisors. Morgan Stanley's AI assistant processes 100K+ advisor queries daily. Schwab and Vanguard are following.", source: "Source: Deloitte Wealth Management AI Report 2024" },
      { area: "AI-Driven Credit Underwriting", detail: "Alternative data and ML models are reducing loan processing time from weeks to minutes. Upstart, SoFi, and major banks are seeing 20-30% reduction in default rates.", source: "Source: BCG Global Risk Report 2024" },
      { area: "Generative AI for Compliance Documentation", detail: "Banks are using LLMs to draft regulatory filings, compliance reports, and policy documents. Early adopters report 50% reduction in compliance documentation time.", source: "Source: Gartner Financial Services AI Survey 2024" },
      { area: "Algorithmic Trading & Portfolio Optimization", detail: "AI-driven trading strategies now account for an estimated 35% of US equity volume. Renaissance Technologies, Citadel, and Two Sigma continue to lead, but traditional asset managers are catching up.", source: "Source: Bloomberg Intelligence 2024" },
      { area: "Customer Service Chatbots & Virtual Assistants", detail: "Bank of America's Erica handles 1.5B+ interactions annually. Capital One, Wells Fargo, and Citi are all scaling conversational AI across customer touchpoints.", source: "Source: J.D. Power Banking AI Study 2024" },
    ],
    insurance: [
      { area: "AI Claims Processing & Automation", detail: "Leading insurers are achieving 70%+ straight-through processing rates on standard claims using AI. Lemonade, Progressive, and Allstate have been early movers.", source: "Source: McKinsey Insurance Practice 2024" },
      { area: "Predictive Underwriting Models", detail: "AI models incorporating alternative data (IoT, satellite imagery, social signals) are improving risk selection by 15-25%. Swiss Re and Munich Re lead in reinsurance applications.", source: "Source: Deloitte Insurance AI Report 2024" },
      { area: "Customer Retention & Churn Prediction", detail: "Insurers are using ML to identify at-risk policies 60-90 days before lapse, enabling targeted retention interventions with 20-30% success rates.", source: "Source: BCG Insurance Value Creators 2024" },
      { area: "AI-Powered Fraud Detection", detail: "Insurance fraud costs the industry $80B+ annually. AI models are detecting 40-50% more fraudulent claims than rule-based systems.", source: "Source: Coalition Against Insurance Fraud 2024" },
      { area: "Generative AI for Policy Documentation", detail: "Carriers are using LLMs to generate policy language, simplify customer communications, and create personalized coverage recommendations.", source: "Source: Gartner Insurance Technology Report 2024" },
      { area: "Telematics & Usage-Based Insurance", detail: "Connected vehicle and IoT data enables dynamic pricing models. Progressive's Snapshot and State Farm's Drive Safe programs are maturing rapidly.", source: "Source: J.D. Power Insurance Digital Intelligence 2024" },
    ],
    healthcare: [
      { area: "Clinical Decision Support Systems", detail: "AI-assisted diagnostics are being deployed across radiology, pathology, and cardiology. Mayo Clinic, Cleveland Clinic, and Kaiser Permanente are leading adopters.", source: "Source: NEJM AI Healthcare Review 2024" },
      { area: "Revenue Cycle Management AI", detail: "AI is automating coding, billing, and prior authorization. Early adopters report 30-40% reduction in claim denials and 15-20% faster collections.", source: "Source: McKinsey Healthcare Practice 2024" },
      { area: "Drug Discovery & Development", detail: "AI is compressing early-stage drug discovery timelines by 2-4 years. Recursion, Exscientia, and major pharma companies are seeing real pipeline impact.", source: "Source: BCG Pharma AI Report 2024" },
      { area: "Patient Flow & Capacity Optimization", detail: "Hospitals are using ML to predict admissions, optimize bed allocation, and reduce ED wait times by 20-30%. HCA Healthcare and CommonSpirit are scaling these systems.", source: "Source: Deloitte Health System AI Survey 2024" },
      { area: "Ambient Clinical Documentation", detail: "AI scribes (Nuance DAX, Abridge, DeepScribe) are reducing physician documentation burden by 50-70%. Adoption is accelerating rapidly across health systems.", source: "Source: AMA Physician AI Adoption Study 2024" },
      { area: "Population Health & Predictive Analytics", detail: "Payers and providers are using AI to identify high-risk patients and intervene proactively. UnitedHealth, Humana, and Anthem/Elevance are investing heavily.", source: "Source: Gartner Healthcare Provider AI Survey 2024" },
    ],
  };
  const defaults = [
    { area: "Customer-Facing AI (Chatbots, Virtual Assistants)", detail: "Organizations across industries are deploying conversational AI for customer service, with leaders seeing 30-50% reduction in call center volume and improved CSAT scores.", source: "Source: Gartner Customer Service AI Survey 2024" },
    { area: "Process Automation & Intelligent Document Processing", detail: "RPA combined with AI/ML is being applied to back-office processes. Leaders report 40-60% efficiency gains in document-heavy workflows.", source: "Source: McKinsey Operations Practice 2024" },
    { area: "Predictive Analytics for Demand Planning", detail: "AI-driven demand forecasting is improving accuracy by 20-35% over traditional methods, reducing inventory costs and stockouts.", source: "Source: BCG Operations Report 2024" },
    { area: "Generative AI for Content & Code", detail: "Organizations are deploying coding assistants (GitHub Copilot, Amazon CodeWhisperer) and content generation tools, with early adopters reporting 25-40% productivity gains.", source: "Source: Deloitte Tech Trends 2024" },
    { area: "AI-Powered Cybersecurity", detail: "ML-based threat detection, automated incident response, and behavioral analytics are becoming standard. Organizations using AI security report 65% faster threat detection.", source: "Source: IBM Cost of a Data Breach Report 2024" },
    { area: "Workforce Analytics & Talent Management", detail: "AI is being applied to recruiting, performance management, and workforce planning. Leaders are seeing 30% faster hiring cycles and improved retention.", source: "Source: Josh Bersin Research 2024" },
  ];
  return areas[industry] || defaults;
}

// ---------------------------------------------------------------------------
// Section 6: Vendor / Partner Helpers
// ---------------------------------------------------------------------------

function getGartnerContext(industry: string, stage: number): string {
  const ind = industry.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  if (stage <= 2) {
    return `For organizations at Stage ${stage} in ${ind}, Gartner recommends prioritizing vendors in the "Leaders" and "Visionaries" quadrants of the relevant Magic Quadrant — specifically those with strong implementation support, low time-to-value, and proven onboarding for organizations early in their AI journey. Avoid niche players that require significant internal expertise to deploy. Forrester's 2024 analysis emphasizes that early-stage organizations should select vendors based on "ecosystem completeness" (training, support, community) rather than pure technical capability.`;
  }
  if (stage <= 3) {
    return `At Stage ${stage} in ${ind}, your organization is ready for a broader vendor portfolio. Gartner recommends a mix of established "Leaders" for core infrastructure and selectively engaging "Challengers" and "Visionaries" for innovative capabilities in specific domains. The key evaluation criteria at this stage shift from ease-of-adoption to platform extensibility, integration depth, and total cost of ownership. Forrester's 2024 Wave analyses suggest mid-maturity organizations should also invest in MLOps/AI platform vendors to build internal deployment capabilities.`;
  }
  return `At Stage ${stage} in ${ind}, your organization should leverage the full Gartner Magic Quadrant landscape strategically. "Leaders" for enterprise backbone, "Visionaries" for emerging capabilities, and "Niche Players" for domain-specific advantages. At this maturity level, the build-vs-buy decision becomes more nuanced: proprietary AI capabilities that create competitive moats should be built internally, while commodity capabilities should be sourced from best-in-class vendors. Forrester recommends advanced organizations invest in AI platform engineering to reduce vendor dependency.`;
}

function getRecommendedPartnerCategories(industry: string, stage: number): { category: string; description: string; vendors: string; source: string }[] {
  const categories = [
    {
      category: "AI/ML Platform",
      description: stage <= 2
        ? "Start with a comprehensive AI platform that includes pre-built models, AutoML, and managed infrastructure to reduce time-to-value."
        : "Enterprise-grade ML platform with robust MLOps, model governance, and multi-cloud deployment capabilities.",
      vendors: "Leaders: AWS SageMaker, Google Vertex AI, Microsoft Azure AI, Databricks | Challengers: Dataiku, H2O.ai, DataRobot",
      source: "Gartner Magic Quadrant for Cloud AI Developer Services 2024",
    },
    {
      category: "Generative AI & LLM",
      description: "Large language model providers for enterprise applications including content generation, code assistance, and knowledge management.",
      vendors: "Leaders: OpenAI (GPT-4), Anthropic (Claude), Google (Gemini) | Enterprise: Microsoft Copilot, AWS Bedrock, Cohere",
      source: "Forrester Wave: AI Foundation Models 2024",
    },
    {
      category: "AI Governance & Risk",
      description: stage <= 2
        ? "Essential for establishing AI oversight without building custom governance tooling. Start with monitoring and basic policy enforcement."
        : "Comprehensive AI governance covering model risk management, bias detection, explainability, and regulatory compliance.",
      vendors: "Leaders: IBM OpenPages, SAS Model Risk Management | Emerging: Credo AI, Arthur AI, Weights & Biases",
      source: "Gartner Market Guide for AI Trust, Risk and Security Management 2024",
    },
    {
      category: "Implementation & Strategy Partner",
      description: stage <= 2
        ? "A strategic implementation partner can compress your learning curve by 12-18 months and avoid common early-stage pitfalls."
        : "Domain-specific expertise for complex AI transformations, change management, and operating model redesign.",
      vendors: "Strategy: McKinsey, BCG, Deloitte, Accenture | Implementation: Thoughtworks, Slalom, Cognizant, Infosys",
      source: "Forrester Wave: AI Strategy Consulting 2024",
    },
  ];
  return categories;
}

// ---------------------------------------------------------------------------
// Section 7: Risk Assessment Helpers
// ---------------------------------------------------------------------------

function getRiskDetails(dimensionScores: DimensionScore[]): { label: string; description: string; mitigation: string; severity: string }[] {
  const getScore = (dim: string) => dimensionScores.find((d) => d.dimension === dim)?.normalizedScore || 50;
  return [
    {
      label: "Shadow AI Proliferation",
      description: `With an Authority Structure score of ${getScore("authority_structure")}/100, your organization ${getScore("authority_structure") >= 60 ? "has moderate controls but may still have blind spots" : "faces significant risk of uncontrolled AI tool usage"} across business units. Gartner estimates that 75% of employees will use AI tools not provisioned by IT by 2027.`,
      mitigation: getScore("authority_structure") >= 60
        ? "Strengthen discovery mechanisms and channel shadow usage into governed alternatives. Regular audits of SaaS procurement and browser extension usage."
        : "Immediate priority: deploy AI tool discovery scanning, establish acceptable use policy, and create a fast-track approval process for employee-requested AI tools.",
      severity: getScore("authority_structure") >= 60 ? "medium" : "high",
    },
    {
      label: "Governance Gap Exposure",
      description: `Your combined authority and decision velocity scores suggest ${getScore("authority_structure") >= 50 && getScore("decision_velocity") >= 50 ? "a functional but potentially brittle governance framework" : "material gaps in AI governance"}. The EU AI Act (effective 2025) and emerging US state regulations increase the regulatory cost of inadequate governance.`,
      mitigation: "Conduct gap analysis against EU AI Act requirements and relevant US state regulations. Establish AI risk classification system with tiered governance requirements.",
      severity: getScore("authority_structure") < 40 ? "high" : "medium",
    },
    {
      label: "Untracked AI Spend",
      description: `An Economic Translation score of ${getScore("economic_translation")}/100 indicates ${getScore("economic_translation") >= 60 ? "some financial visibility but potential blind spots" : "limited visibility into AI-related spending"}. Without consolidated tracking, AI costs are buried across IT, departmental budgets, and individual expense reports.`,
      mitigation: "Implement centralized AI spend tracking dashboard. Categorize all AI expenditure (licensing, compute, talent, implementation, maintenance) across all cost centers.",
      severity: getScore("economic_translation") < 40 ? "high" : "medium",
    },
    {
      label: "Decision Bottleneck Risk",
      description: `A Decision Velocity score of ${getScore("decision_velocity")}/100 means ${getScore("decision_velocity") >= 60 ? "moderate organizational responsiveness" : "significant organizational lag in AI decision-making"}. In fast-moving AI markets, slow decisions can translate to missed competitive windows.`,
      mitigation: "Establish tiered approval framework: self-service for low-risk, expedited for medium-risk, full review only for high-risk AI deployments.",
      severity: getScore("decision_velocity") < 40 ? "high" : "low",
    },
    {
      label: "Workflow Fragmentation",
      description: `A Workflow Integration score of ${getScore("workflow_integration")}/100 suggests ${getScore("workflow_integration") >= 60 ? "AI is embedded in some workflows but gaps remain" : "AI tools operate alongside rather than within core business processes"}, creating efficiency losses and data silos.`,
      mitigation: "Map all AI touchpoints against core business workflows. Identify integration gaps and prioritize embedding AI into highest-value process steps.",
      severity: getScore("workflow_integration") < 40 ? "medium" : "low",
    },
    {
      label: "Adoption Stall Risk",
      description: `An Adoption Behavior score of ${getScore("adoption_behavior")}/100 ${getScore("adoption_behavior") >= 60 ? "shows healthy adoption momentum, but sustaining it requires continuous investment in training and change management" : "indicates risk of AI adoption stalling or regressing as initial enthusiasm fades"}.`,
      mitigation: getScore("adoption_behavior") >= 60
        ? "Invest in continuous AI literacy programs and internal champions network. Monitor usage metrics monthly to catch early signs of adoption plateau."
        : "Launch immediate quick-win pilots with visible impact. Assign executive sponsors and measure/celebrate early wins to build organizational confidence.",
      severity: getScore("adoption_behavior") < 40 ? "high" : "low",
    },
  ];
}

function getRegulatoryContext(industry: string, regulatoryIntensity: string): string {
  const contexts: Record<string, string> = {
    financial_services: `Financial services faces among the highest AI regulatory scrutiny globally. The EU AI Act classifies credit scoring and insurance pricing as "high-risk" AI applications requiring conformity assessments, human oversight, and transparency obligations. In the US, the OCC, FDIC, and Federal Reserve have issued joint guidance on AI model risk management (SR 11-7 expanded). The CFPB has signaled increased scrutiny of AI in consumer lending. State-level regulations (Colorado AI Act, Illinois BIPA) add compliance layers. With your regulatory intensity rated as "${regulatoryIntensity}", your organization must maintain comprehensive model documentation, bias testing, and explainability capabilities for all customer-facing AI systems.`,
    insurance: `Insurance is subject to increasing AI regulation across jurisdictions. The NAIC has adopted AI model governance guidelines requiring insurers to demonstrate fair and non-discriminatory use of AI in underwriting and claims. The EU AI Act classifies insurance pricing as "high-risk" AI. Colorado's AI Act (SB21-169) specifically targets algorithmic discrimination in insurance. With your regulatory intensity rated as "${regulatoryIntensity}", compliance requires documented model validation, bias testing, and consumer transparency for all AI-assisted underwriting and claims decisions.`,
    healthcare: `Healthcare AI faces the most complex regulatory landscape across industries. FDA clearance is required for AI/ML-based Software as a Medical Device (SaMD). HIPAA imposes strict requirements on AI systems processing PHI. CMS has proposed rules on AI in clinical decision support. The EU AI Act classifies diagnostic AI as "high-risk." ONC regulations require transparency in health IT algorithms. With your regulatory intensity rated as "${regulatoryIntensity}", your AI governance must address clinical validation, patient safety monitoring, PHI protection, and algorithmic transparency across all AI applications.`,
    technology: `While technology companies face relatively lighter industry-specific AI regulation, the landscape is tightening. The EU AI Act affects any AI system deployed in the EU market. California's proposed AI legislation (SB-1047 and successors) would impose safety requirements on frontier models. The FTC has signaled enforcement action against deceptive AI practices. With your regulatory intensity rated as "${regulatoryIntensity}", proactive governance positions your organization ahead of incoming regulation while building customer trust.`,
  };
  return contexts[industry] || `Your industry faces evolving AI regulatory requirements. The EU AI Act (effective 2025) establishes a risk-based framework applicable across sectors. In the US, sector-specific agencies are developing AI guidance, and state-level legislation (Colorado, California, Illinois) is creating a patchwork of compliance requirements. The White House Executive Order on AI Safety (October 2023) signals increasing federal attention. With your regulatory intensity rated as "${regulatoryIntensity}", proactive governance investment reduces future compliance cost and risk exposure.`;
}

// ---------------------------------------------------------------------------
// Section 8: 90-Day Action Plan Helpers
// ---------------------------------------------------------------------------

function get90DayContext(overallScore: number, stage: number, industry: string): string {
  const ind = industry.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  if (stage <= 2) {
    return `At Stage ${stage} with an overall score of ${overallScore}/100, your organization is in the early phases of AI maturity in ${ind}. Research from BCG's 2024 AI Advantage report shows that organizations at this stage benefit most from a "concentrated bet" strategy: focus resources on 2-3 high-impact use cases rather than spreading investment across many initiatives. McKinsey's transformation research indicates that 90-day sprints with clear success metrics are 2.3x more effective than open-ended transformation programs. The plan below prioritizes building organizational muscle (governance, measurement, talent) alongside targeted pilots that demonstrate tangible value to maintain executive commitment.`;
  }
  if (stage <= 3) {
    return `At Stage ${stage} with an overall score of ${overallScore}/100, your organization has established AI foundations in ${ind} but faces the critical "scaling gap" that stalls most organizations. Deloitte's 2024 State of AI report found that 74% of organizations at this stage fail to progress beyond experimentation within 18 months. The primary barrier is not technology but organizational: unclear ownership, inconsistent governance, and inability to demonstrate financial returns. This action plan focuses on closing these organizational gaps while accelerating the highest-potential initiatives already underway.`;
  }
  return `At Stage ${stage} with an overall score of ${overallScore}/100, your organization has demonstrated meaningful AI maturity in ${ind}. The strategic imperative at this stage shifts from building capabilities to creating competitive moats: proprietary data advantages, AI-enabled products, and organizational velocity that competitors cannot easily replicate. McKinsey's 2024 research on AI leaders shows that top-quartile organizations at this stage invest 40% of AI resources in revenue-generating applications (vs. 15% for average organizations). This plan focuses on competitive differentiation, portfolio optimization, and board-level strategic alignment.`;
}

function get90DayKPIs(overallScore: number, industry: string): { metric: string; target: string; detail: string }[] {
  if (overallScore < 40) {
    return [
      { metric: "AI Governance Score", target: "+20pts", detail: "Target 20-point improvement in governance maturity by Day 90" },
      { metric: "Shadow AI Audit", target: "100%", detail: "Complete inventory of all AI tools in use across the organization" },
      { metric: "Pilot Launches", target: "2-3", detail: "Number of governed AI pilots actively in deployment" },
      { metric: "AI Literacy Rate", target: "25%", detail: "Percentage of workforce completing AI awareness training" },
    ];
  }
  if (overallScore < 70) {
    return [
      { metric: "Value Captured", target: "$250K+", detail: "Documented, measurable value from AI initiatives by Day 90" },
      { metric: "Deployment Velocity", target: "<8 wks", detail: "Average time from use case approval to production deployment" },
      { metric: "AI Adoption Rate", target: "40%+", detail: "Percentage of target workforce actively using AI tools weekly" },
      { metric: "ROI-Tracked Initiatives", target: "100%", detail: "All active AI initiatives with standardized ROI measurement" },
    ];
  }
  return [
    { metric: "AI Revenue Impact", target: "Measured", detail: "Quantified AI contribution to revenue growth or new offerings" },
    { metric: "Competitive Velocity", target: "Top Quartile", detail: "Deployment speed benchmarked against industry leaders" },
    { metric: "Portfolio ROI", target: "3:1+", detail: "Blended return across AI investment portfolio" },
    { metric: "Board AI Confidence", target: "High", detail: "Board satisfaction with AI strategy execution and governance" },
  ];
}

// ---------------------------------------------------------------------------
// Section 9: Board Findings Helpers
// ---------------------------------------------------------------------------

function getBoardFindings(
  overallScore: number,
  stage: StageClassification,
  dimensions: DimensionScore[],
  economic: EconomicEstimate,
  profile: CompanyProfile
): { headline: string; detail: string; severity: string }[] {
  const weakest = [...dimensions].sort((a, b) => a.normalizedScore - b.normalizedScore)[0];
  const strongest = [...dimensions].sort((a, b) => b.normalizedScore - a.normalizedScore)[0];
  const findings = [
    {
      headline: `AI maturity is at Stage ${stage.primaryStage} (${stage.stageName}): ${overallScore >= 60 ? "progressing but not yet differentiated" : overallScore >= 40 ? "early stage with significant unrealized potential" : "foundational gaps require immediate attention"}`,
      detail: `The organization scores ${overallScore}/100 on AI maturity across 61 behavioral questions. This places ${profile.companyName} ${overallScore >= 60 ? "near the industry median with opportunity to accelerate into the top quartile" : overallScore >= 40 ? "below the industry median, consistent with organizations that have invested in AI tooling but not yet built the organizational infrastructure to scale" : "in the bottom quartile, indicating that AI is not yet a meaningful part of operations and the competitive gap is widening"}.`,
      severity: overallScore >= 60 ? "info" : overallScore >= 40 ? "high" : "critical",
    },
    {
      headline: `Estimated ${fmtUSD(economic.unrealizedValueLow)} to ${fmtUSD(economic.unrealizedValueHigh)} in annual value remains unrealized`,
      detail: `Current AI value capture is estimated at ${economic.currentCapturePercent}% of potential. This translates to approximately ${fmtUSD(Math.round((economic.unrealizedValueLow + economic.unrealizedValueHigh) / 2 / 4))} in unrealized value per quarter. The cost of inaction compounds: each quarter of delay not only forfeits this value but allows competitors to build advantages that become increasingly difficult to close.`,
      severity: "critical",
    },
    {
      headline: `Primary structural constraint: ${dimensionLabel(weakest?.dimension || "")} (${weakest?.normalizedScore}/100)`,
      detail: `${dimensionLabel(weakest?.dimension || "")} is the lowest-scoring dimension, acting as the primary bottleneck to AI maturity progression. This is not a technology gap: it is an organizational design issue that will constrain returns on all AI investments until addressed. Targeted intervention in this dimension offers the highest marginal return.`,
      severity: weakest && weakest.normalizedScore < 40 ? "critical" : "high",
    },
    {
      headline: `Organizational strength to leverage: ${dimensionLabel(strongest?.dimension || "")} (${strongest?.normalizedScore}/100)`,
      detail: `${dimensionLabel(strongest?.dimension || "")} represents an organizational asset. Best practices from this dimension should be systematically transferred to weaker areas. Organizations that leverage existing strengths in their transformation approach progress 40% faster than those that focus exclusively on weaknesses (BCG 2024).`,
      severity: "info",
    },
  ];
  if (stage.confidence < 0.7) {
    findings.push({
      headline: "Maturity is uneven across the organization: mixed-stage pattern detected",
      detail: `Dimension scores show significant variance (confidence: ${Math.round(stage.confidence * 100)}%), indicating that AI maturity differs substantially across organizational functions. This mixed-stage pattern typically reflects decentralized AI adoption without coordinating governance. Board attention should focus on whether this variance is strategic (intentional prioritization) or emergent (lack of coordination).`,
      severity: "high",
    });
  }
  return findings;
}

function getBoardSupportNarrative(stage: number): string {
  if (stage <= 2) {
    return `Organizations at Stage ${stage} need board engagement that goes beyond risk oversight. NACD's 2024 Board Oversight of AI report recommends that boards at this stage: (1) ensure management has allocated adequate resources and senior leadership attention to AI transformation, (2) request regular updates on AI maturity metrics not just AI spending, (3) challenge management on whether the AI strategy is ambitious enough relative to competitive dynamics, and (4) consider whether the board itself has sufficient AI literacy to provide effective oversight. Board members should resist the urge to focus exclusively on AI risk at this stage: under-investment in AI is itself a strategic risk that boards must weigh against operational risks.`;
  }
  if (stage <= 3) {
    return `At Stage ${stage}, boards should shift from "is management doing AI?" to "is AI creating measurable value?" NACD recommends boards at this stage: (1) hold management accountable for quantified AI ROI, not activity metrics, (2) review the AI portfolio for balance between quick wins and transformative bets, (3) ensure competitive intelligence informs AI investment priorities, and (4) oversee the development of AI talent strategy as a critical asset. The board's role is to prevent the "experimentation trap" where organizations invest continuously in AI pilots without scaling winners or killing underperformers.`;
  }
  return `At Stage ${stage}, the board's role evolves to strategic partnership on AI-driven competitive positioning. NACD recommends boards at advanced stages: (1) integrate AI into strategic planning and capital allocation discussions (not as a separate agenda item), (2) evaluate whether AI investments are creating defensible competitive moats, (3) assess management's AI talent and leadership pipeline, and (4) ensure ethical AI governance keeps pace with capability deployment. The board should also consider whether AI capabilities should inform M&A strategy and new market entry decisions.`;
}

function getBoardActions(stage: number, industry: string): { action: string; rationale: string; owner: string }[] {
  if (stage <= 2) {
    return [
      { action: "Request AI maturity baseline and 12-month improvement targets", rationale: "Establish accountability for measurable progress, not just activity. Metrics should include adoption rates, value captured, and governance maturity.", owner: "Board request to CEO/CIO" },
      { action: "Evaluate CEO/C-suite AI fluency and commitment", rationale: "AI transformation requires active C-suite sponsorship. Boards should assess whether leadership has the knowledge and conviction to drive change.", owner: "Board assessment" },
      { action: "Approve dedicated AI transformation budget", rationale: "Ring-fenced funding prevents AI initiatives from competing with operational priorities. Best practice: 1-3% of revenue for organizations at this stage.", owner: "Board approval to CFO" },
      { action: "Add AI expertise to the board", rationale: "78% of boards lack members with deep AI expertise (NACD 2024). Consider adding a director with AI/technology leadership experience.", owner: "Nominating Committee" },
    ];
  }
  if (stage <= 3) {
    return [
      { action: "Hold management accountable for AI ROI, not activity metrics", rationale: "Shift board reporting from 'how many AI projects' to 'what measurable value has AI created.' Require financial evidence.", owner: "Board request to CEO/CFO" },
      { action: "Review AI competitive positioning quarterly", rationale: "AI competitive dynamics shift rapidly. Quarterly reviews prevent strategic surprise and ensure investment is calibrated to market reality.", owner: "Board standing agenda item" },
      { action: "Oversee AI risk and governance framework", rationale: "As AI scales, risk exposure increases. Board should review governance framework adequacy, especially in regulated areas.", owner: "Risk Committee / Audit Committee" },
      { action: "Evaluate AI talent strategy", rationale: "AI talent is the scarcest resource. Board should assess management's plan for recruiting, retaining, and developing AI capabilities.", owner: "Compensation Committee / CHRO" },
    ];
  }
  return [
    { action: "Integrate AI into strategic planning and capital allocation", rationale: "At this maturity stage, AI should inform corporate strategy, not be a separate initiative. Board should expect AI implications in every major strategic decision.", owner: "Full Board" },
    { action: "Assess AI-driven competitive moat and M&A implications", rationale: "Evaluate whether proprietary AI capabilities create defensible advantages. Consider AI capabilities in acquisition targets and partnership evaluations.", owner: "Strategy Committee" },
    { action: "Review AI ethics and responsible AI posture", rationale: "Advanced AI deployment increases reputational and regulatory risk. Board should ensure ethical AI governance keeps pace with capability.", owner: "Risk / Governance Committee" },
    { action: "Benchmark AI maturity against industry leaders annually", rationale: "Maintain external perspective on competitive position. Annual independent assessment prevents internal bias in self-reporting.", owner: "Board request to CIO" },
  ];
}

function getBoardAsks(overallScore: number, stage: number, economic: EconomicEstimate): { type: string; title: string; description: string }[] {
  const unrealizedMid = Math.round((economic.unrealizedValueLow + economic.unrealizedValueHigh) / 2);
  const asks = [
    {
      type: "decision",
      title: "Approve AI transformation as a board-level strategic priority",
      description: `This diagnostic reveals ${fmtUSD(unrealizedMid)} in estimated annual unrealized value. The board should formally designate AI transformation as a strategic priority with dedicated oversight, regular progress reviews, and accountability tied to executive performance evaluations.`,
    },
    {
      type: "investment",
      title: `Authorize 90-day AI transformation sprint with ring-fenced budget`,
      description: `The 90-day action plan in Section 8 requires dedicated resources. Recommended initial investment: ${stage <= 2 ? "1-2% of annual revenue" : "2-4% of annual revenue"} allocated specifically to AI transformation, separate from business-as-usual IT budget. This investment should be evaluated against the ${fmtUSD(unrealizedMid)} annual opportunity, not against other IT projects.`,
    },
    {
      type: "governance",
      title: "Establish board-level AI oversight mechanism",
      description: `Per NACD recommendations, the board should designate AI oversight to an existing committee (Risk, Audit, or Technology) or create a dedicated AI subcommittee. This body should receive quarterly AI maturity updates, review material AI risk events, and ensure management accountability for AI value creation.`,
    },
  ];
  if (overallScore < 50) {
    asks.push({
      type: "decision",
      title: "Evaluate leadership capacity for AI transformation",
      description: "The board should assess whether current executive leadership has the expertise, bandwidth, and conviction to drive AI transformation at the pace required by competitive dynamics. Consider whether dedicated AI leadership (Chief AI Officer, VP of AI) is needed, and whether external advisory support would accelerate progress.",
    });
  }
  return asks;
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
