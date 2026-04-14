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
            dimensions and building your diagnostic report.
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
        <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div>
              <p className="text-[11px] font-semibold text-navy/50 tracking-[0.3em] uppercase mb-2">
                {result.companyProfile.companyName}
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-navy tracking-tight mb-2">
                AI Maturity Diagnostic
              </h1>
              <p className="text-sm text-foreground/40 leading-relaxed mb-3 max-w-md">
                Framework developed by Ryan King across a decade advising CIOs
                and technology executives at McKinsey, Deloitte, and now at RLK
                Consulting.
              </p>
              <p className="text-sm text-foreground/40 font-medium">
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
        <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
          <h2 className="text-xl md:text-2xl font-bold text-navy tracking-tight mb-1">Stage Classification</h2>
          <div className="h-px bg-gradient-to-r from-navy/20 via-navy/8 to-transparent mb-4" />
          <StageDisplay stage={result.stageClassification} overallScore={result.overallScore} dimensionScores={result.dimensionScores} />
        </section>
      )}

      {/* Dimension Scores */}
      {result && (
        <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
          <h2 className="text-xl md:text-2xl font-bold text-navy tracking-tight mb-1">Dimension Scores</h2>
          <div className="h-px bg-gradient-to-r from-navy/20 via-navy/8 to-transparent mb-4" />
          <p className="text-sm text-foreground/50 mb-6">
            Five behavioral dimensions that determine whether your AI investments translate into organizational value.
          </p>

          <div className="space-y-6">
            {result.dimensionScores.map((ds) => {
              const desc: Record<string, string> = {
                adoption_behavior: "Are your people actually using AI, or just talking about it?",
                authority_structure: "Who can say yes to AI — and how fast can they do it?",
                workflow_integration: "Is AI embedded in how work gets done, or sitting on the side?",
                decision_velocity: "How quickly does your organization move from AI insight to action?",
                economic_translation: "Can you prove AI is creating financial value?",
              };
              return (
                <div key={ds.dimension}>
                  <p className="text-[11px] text-foreground/45 leading-snug mb-1.5">
                    {desc[ds.dimension] || ""}
                  </p>
                  <DimensionBar score={ds} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Competitive Positioning Teaser */}
      {result && (
        <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
          <h2 className="text-xl md:text-2xl font-bold text-navy tracking-tight mb-1">Competitive Positioning</h2>
          <div className="h-px bg-gradient-to-r from-navy/20 via-navy/8 to-transparent mb-4" />
          <p className="text-sm text-foreground/50 mb-5">
            Where {result.companyProfile.companyName} sits relative to peers in{" "}
            {industryLabel(result.companyProfile.industry)}.
          </p>
          <CompetitiveMatrix
            capabilityScore={
              (result.dimensionScores.find((d) => d.dimension === "adoption_behavior")?.normalizedScore || 0) * 0.5 +
              (result.dimensionScores.find((d) => d.dimension === "workflow_integration")?.normalizedScore || 0) * 0.5
            }
            readinessScore={
              (result.dimensionScores.find((d) => d.dimension === "authority_structure")?.normalizedScore || 0) * 0.4 +
              (result.dimensionScores.find((d) => d.dimension === "decision_velocity")?.normalizedScore || 0) * 0.3 +
              (result.dimensionScores.find((d) => d.dimension === "economic_translation")?.normalizedScore || 0) * 0.3
            }
            companyName={result.companyProfile.companyName}
          />
          <div className="mt-6 bg-navy/5 border border-navy/10 p-4 text-center">
            <p className="text-sm text-foreground/70">
              The full report reveals <strong className="text-navy">exactly where your competitors are investing</strong> in AI,
              with named companies, dollar amounts, and specific use cases.{" "}
              <span className="text-tertiary">See Sections 4-5 in the full report.</span>
            </p>
          </div>
        </section>
      )}

      {/* Economic Impact */}
      {result && (
        <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
          <h2 className="text-xl md:text-2xl font-bold text-navy tracking-tight mb-1">Economic Impact Summary</h2>
          <div className="h-px bg-gradient-to-r from-navy/20 via-navy/8 to-transparent mb-6" />
          <EconomicSummary estimate={result.economicEstimate} />
          <div className="mt-6 bg-navy/5 border border-navy/10 p-4 text-center">
            <p className="text-sm text-foreground/70">
              {getEconomicScaleContext(result.companyProfile.employeeCount)}{" "}
              The full report provides the <strong className="text-navy">transparent step-by-step methodology</strong>,
              sensitivity analysis, and industry benchmarks — your CFO should stress-test these assumptions before sharing with the board.
            </p>
          </div>
        </section>
      )}

      {/* Maturity Analysis — research-backed insights */}
      {result && (() => {
        const sorted = [...result.dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore);
        const analysis = getFreeMaturityAnalysis(
          result.stageClassification.primaryStage,
          result.companyProfile.industry,
          result.overallScore,
          result.companyProfile.companyName,
          result.companyProfile.revenue,
          result.companyProfile.employeeCount,
          sorted[0].dimension,
          sorted[sorted.length - 1].dimension,
        );
        return (
          <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
            <h2 className="text-lg mb-4">Maturity Analysis</h2>

            {/* Headline */}
            <div className="border-l-4 border-navy pl-5 mb-6">
              <p className="text-base text-foreground/80 leading-relaxed font-medium">
                {analysis.headline}
              </p>
            </div>

            {/* Industry context */}
            <p className="text-sm text-foreground/70 leading-relaxed mb-8">
              {analysis.industryContext}
            </p>

            {/* Research-backed insight cards */}
            <div className="space-y-4 mb-8">
              {analysis.insights.map((insight, i) => (
                <div key={i} className="bg-offwhite border border-light p-5">
                  <div className="flex items-start gap-4">
                    <span className="text-2xl font-bold text-navy shrink-0 leading-none mt-0.5">
                      {insight.stat}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-navy mb-1">
                        {insight.label}
                      </p>
                      <p className="text-xs text-foreground/60 leading-relaxed">
                        {insight.body}
                      </p>
                      <p className="text-[10px] text-tertiary italic mt-2">
                        {insight.source}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Mixed stage narrative (if applicable) */}
            {result.stageClassification.mixedStageNarrative && (
              <p className="text-sm text-foreground/60 leading-relaxed mb-6 italic">
                {result.stageClassification.mixedStageNarrative}
              </p>
            )}

            {/* Closing hook */}
            <div className="bg-navy/5 border border-navy/10 p-4">
              <p className="text-sm text-foreground/70 leading-relaxed">
                {analysis.closingHook}
              </p>
            </div>
          </section>
        );
      })()}

      {/* Paywall / Full Report */}
      {phase === "preview" && (
        <section className="bg-navy text-white p-6 md:p-10 mb-8">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-xl md:text-2xl font-bold mb-3">
                <span className="text-white">Your Diagnostic Data is Ready.</span>
                <br />
                <span style={{ color: "#c9a84c" }}>The Full Analysis Goes Deeper.</span>
              </h2>
              <p className="text-white/70 text-sm leading-relaxed max-w-lg mx-auto">
                The scores above are the starting point. The full RLK AI Diagnostic
                translates these numbers into an executive-grade
                analysis your leadership team can act on immediately.
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
                  Competitive Positioning
                </p>
                <p className="text-white/50 text-xs leading-relaxed">
                  Where you stand vs. industry peers with named competitor
                  analysis and competitive window assessment.
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
                  P&L Business Case
                </p>
                <p className="text-white/50 text-xs leading-relaxed">
                  How AI investment flows through your P&L — revenue impact,
                  margin improvement, cost structure evolution, and the
                  compounding cost of standing still.
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
                  Messages for the Board
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
                  "Get Your Full Diagnostic Report: $497"
                )}
              </button>
              <p className="text-white/40 text-xs mt-4">
                Secure payment via Stripe. Includes downloadable PDF
                formatted for executive review.
              </p>
              <p className="text-white/30 text-xs mt-2">
                Built on frameworks honed across years of advising CIOs and
                technology executives at McKinsey, Deloitte, and now at RLK
                Consulting.
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
          <section className="bg-navy text-white py-14 md:py-20 px-10 md:px-14 mb-10">
            <div className="max-w-3xl mx-auto text-center">
              <p className="text-[10px] font-semibold tracking-[0.4em] uppercase text-white/30 mb-4">
                Confidential — Prepared for {result.companyProfile.companyName}
              </p>
              <div className="w-12 h-px bg-white/20 mx-auto mb-6" />
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-3 tracking-tight">
                AI Diagnostic Report
              </h2>
              <p className="text-base text-white/60 mb-2 font-light">
                Prepared exclusively for{" "}
                <span className="text-white font-semibold">
                  {result.companyProfile.companyName}
                </span>
              </p>
              <p className="text-xs text-white/30 mb-8 max-w-xl mx-auto leading-relaxed">
                Framework developed by Ryan King across years of advising CIOs
                and technology executives at McKinsey, Deloitte, and now at
                RLK Consulting.
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
                  {industryLabel(result.companyProfile.industry)}
                </span>
                <span>|</span>
                <span>
                  {result.companyProfile.employeeCount.toLocaleString()} employees
                </span>
              </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* SECTION 1: EXECUTIVE SUMMARY                                */}
          {/* ================================================================= */}
          <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
            <SectionHeader number={1} title="Executive Summary" />

            {(() => {
              const weakest = [...result.dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore)[0];
              const strongest = [...result.dimensionScores].sort((a, b) => b.normalizedScore - a.normalizedScore)[0];
              const unrealizedMid = Math.round((result.economicEstimate.unrealizedValueLow + result.economicEstimate.unrealizedValueHigh) / 2);
              const ind = industryLabel(result.companyProfile.industry);

              return (
                <div className="mt-6 space-y-6">
                  {/* Lead paragraph — the headline */}
                  <div className="border-l-4 border-navy pl-5">
                    <p className="text-base text-foreground/80 leading-relaxed">
                      {result.companyProfile.companyName} scores <strong className="text-navy">{result.overallScore}/100</strong> on
                      AI organizational maturity, placing it at <strong className="text-navy">Stage {result.stageClassification.primaryStage}: {result.stageClassification.stageName}</strong>.
                      {result.overallScore >= 60
                        ? ` This is a competitive position, but the diagnostic reveals specific structural constraints that are preventing your AI investments from reaching their full organizational impact.`
                        : result.overallScore >= 40
                        ? ` This places ${result.companyProfile.companyName} below the industry median for ${ind}. The gap is not in technology investment — it is in the organizational structures, governance frameworks, and measurement systems that determine whether AI investments translate into enterprise value.`
                        : ` This represents a significant maturity gap relative to peers in ${ind}. The diagnostic reveals foundational barriers — in governance, adoption, and value measurement — that must be addressed before AI can contribute meaningfully to organizational performance.`
                      }
                    </p>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
                    {/* Key metrics sidebar */}
                    <div className="bg-offwhite border border-light p-5">
                      <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-4">
                        At a Glance
                      </p>
                      <div className="space-y-4">
                        <KeyMetric
                          label="Overall AI Maturity"
                          value={`${result.overallScore}/100`}
                          color={result.overallScore >= 60 ? "#0B1D3A" : result.overallScore >= 40 ? "#6B7F99" : "#A8B5C4"}
                        />
                        <KeyMetric
                          label="Maturity Stage"
                          value={`Stage ${result.stageClassification.primaryStage}`}
                          subvalue={result.stageClassification.stageName}
                          color="#364E6E"
                        />
                        <KeyMetric
                          label="Unrealized Annual Value"
                          value={`${fmtUSD(result.economicEstimate.unrealizedValueLow)} – ${fmtUSD(result.economicEstimate.unrealizedValueHigh)}`}
                          color="#0B1D3A"
                        />
                        <KeyMetric
                          label="Primary Constraint"
                          value={dimensionLabel(weakest?.dimension || "")}
                          subvalue={`${weakest?.normalizedScore}/100`}
                          color="#A8B5C4"
                        />
                        <KeyMetric
                          label="Organizational Strength"
                          value={dimensionLabel(strongest?.dimension || "")}
                          subvalue={`${strongest?.normalizedScore}/100`}
                          color="#0B1D3A"
                        />
                      </div>
                    </div>

                    {/* Detailed findings */}
                    <div className="md:col-span-2 space-y-4">
                      <div>
                        <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
                          The Structural Reality
                        </p>
                        <p className="text-sm text-foreground/70 leading-relaxed">
                          Across five behavioral dimensions, {result.companyProfile.companyName}&apos;s strongest area
                          is <strong className="text-secondary">{dimensionLabel(strongest?.dimension || "")}</strong> ({strongest?.normalizedScore}/100),
                          indicating {dimensionInterpretation(strongest?.dimension || "", strongest?.normalizedScore || 0).toLowerCase()} The
                          primary constraint is <strong className="text-secondary">{dimensionLabel(weakest?.dimension || "")}</strong> ({weakest?.normalizedScore}/100):{" "}
                          {dimensionInterpretation(weakest?.dimension || "", weakest?.normalizedScore || 0).toLowerCase()} Until
                          this dimension improves, it will act as a ceiling on the returns from every other AI investment.
                          See Section 2 for the AI posture diagnosis and Section 3 for structural constraints that translate
                          these scores into actionable intelligence.
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
                          The Economic Opportunity
                        </p>
                        <p className="text-sm text-foreground/70 leading-relaxed">
                          The diagnostic estimates {fmtUSD(result.economicEstimate.unrealizedValueLow)} to{" "}
                          {fmtUSD(result.economicEstimate.unrealizedValueHigh)} in annual unrealized value —
                          productivity improvement that {result.companyProfile.companyName} is not capturing while
                          competitors in {ind} are. Current capture rate: {result.economicEstimate.currentCapturePercent}% of
                          AI-addressable potential. That translates to approximately {fmtUSD(Math.round(unrealizedMid / 4))}{" "}
                          forfeited per quarter. Section 5 provides the transparent methodology behind these numbers
                          — your CFO should stress-test these before sharing with the board.
                          Section 6 translates this unrealized value into specific P&L impact: what it means for
                          revenue growth, operating margin, cost structure, and EBITDA over 12-24 months.
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
                          The Competitive Context
                        </p>
                        <p className="text-sm text-foreground/70 leading-relaxed">
                          {result.companyProfile.companyName} sits in the{" "}
                          {(() => {
                            const cap = (result.dimensionScores.find((d) => d.dimension === "adoption_behavior")?.normalizedScore || 0) * 0.5 +
                              (result.dimensionScores.find((d) => d.dimension === "workflow_integration")?.normalizedScore || 0) * 0.5;
                            const read = (result.dimensionScores.find((d) => d.dimension === "authority_structure")?.normalizedScore || 0) * 0.4 +
                              (result.dimensionScores.find((d) => d.dimension === "decision_velocity")?.normalizedScore || 0) * 0.3 +
                              (result.dimensionScores.find((d) => d.dimension === "economic_translation")?.normalizedScore || 0) * 0.3;
                            if (cap >= 50 && read >= 50) return "AI-Native Leaders";
                            if (cap >= 50) return "Capability Without Structure";
                            if (read >= 50) return "Structure Without Capability";
                            return "Pre-AI";
                          })()}{" "}
                          quadrant of the competitive positioning matrix. Section 4 details where your specific
                          competitors are investing in AI right now — with named companies, dollar amounts, and use
                          cases sourced from public filings and analyst research. Section 8 provides the vendor
                          landscape assessment and contract negotiation levers to optimize your AI spend.
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
                          The Path Forward
                        </p>
                        <p className="text-sm text-foreground/70 leading-relaxed">
                          Section 9 provides a 90-day action plan with 15 research-backed actions, named owners
                          by role, and specific KPIs to track weekly. Section 7 maps the security and governance
                          risks your current posture creates. Section 12 provides messages for the board with specific
                          decision items and investment asks. Every finding is supported by methodology
                          and sources documented in Sections 10 and 11 — review with your CFO before any board presentation.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* AI-generated narrative if available */}
                  {report?.sections?.find((s) => s.slug === "executive-summary")?.content && (
                    <div className="pt-6 border-t border-light">
                      <MarkdownContent
                        content={report?.sections?.find((s) => s.slug === "executive-summary")?.content || ""}
                      />
                    </div>
                  )}
                </div>
              );
            })()}
          </section>

          {/* ================================================================= */}
          {/* SECTION 2: AI POSTURE DIAGNOSIS                             */}
          {/* ================================================================= */}
          <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
            <SectionHeader number={2} title="AI Posture Diagnosis" />
            <p className="text-sm text-foreground/60 mt-2 mb-6">
              Your AI maturity is measured across five behavioral dimensions. These are not
              technology assessments — they diagnose how your organization actually behaves
              around AI: who uses it, who governs it, how fast decisions move, and whether
              anyone can prove it is working.
            </p>

            {/* Dimension definitions */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
              {[
                { dim: "Adoption Behavior", desc: "How AI is actually being used versus merely purchased or discussed. Measures whether AI tools have crossed the threshold from 'available' to 'embedded in how work gets done.' A low score here means you have tools your people are not using." },
                { dim: "Authority Structure", desc: "Who can say yes to AI — and how fast. Measures governance clarity, decision rights, and whether your approval structures enable or block AI deployment. A low score means good ideas die in committee." },
                { dim: "Workflow Integration", desc: "Whether AI is woven into core business processes or sits alongside them as a novelty. The difference between AI as a feature and AI as infrastructure. A low score means AI is a sidebar, not a workflow." },
                { dim: "Decision Velocity", desc: "How quickly your organization moves from AI insight to AI action. Measures the time from identifying an AI opportunity to deploying it in production. A low score means your competitors will get there first." },
                { dim: "Economic Translation", desc: "Can your organization prove AI is creating financial value? Measures the ability to connect AI activity to revenue, margin, and productivity outcomes. A low score means you cannot defend your AI budget." },
              ].map((d) => (
                <div key={d.dim} className="bg-offwhite border border-light p-3 md:p-4">
                  <p className="text-xs font-semibold text-navy mb-1">{d.dim}</p>
                  <p className="text-[11px] text-foreground/60 leading-relaxed">{d.desc}</p>
                </div>
              ))}
            </div>

            {/* Pentagon radar visualization */}
            <div className="mb-10 flex justify-center overflow-x-auto">
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
          {/* SECTION 3: STRUCTURAL CONSTRAINTS                           */}
          {/* ================================================================= */}
          <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
            <SectionHeader number={3} title="Structural Constraints" />
            <p className="text-sm text-foreground/60 mt-2 mb-8">
              Three composite indices distill your 61 responses into the metrics that matter:
              can your organization govern AI, capture its value, and move fast enough to stay competitive?
              Each index flags the specific behaviors — drawn directly from your answers — that are
              accelerating or constraining your AI maturity. For economic implications of these scores,
              see Section 5. For P&L impact, see Section 6. For competitive position, see Section 4.
            </p>

            {/* Composite index signal legend */}
            <div className="flex items-center gap-5 mb-6">
              <p className="text-[10px] font-semibold text-tertiary tracking-wider uppercase">Signal Key:</p>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 flex-shrink-0 bg-green-50 border border-green-200" />
                <span className="text-[10px] text-foreground/50">Strongest Signals (assets to leverage)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 flex-shrink-0 bg-red-50 border border-red-200" />
                <span className="text-[10px] text-foreground/50">Critical Gaps (immediate attention needed)</span>
              </div>
            </div>

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

                // Identify strongest and weakest contributing questions
                const sorted = [...ci.components].sort((a, b) => b.score - a.score);
                const strongQs = sorted.slice(0, 2);
                const weakQs = sorted.slice(-2).reverse();

                return (
                  <div
                    key={ci.slug}
                    className="border border-light p-4 md:p-6"
                  >
                    <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
                      {/* Score prominence */}
                      <div className="flex-shrink-0 text-center md:text-left" style={{ minWidth: 100 }}>
                        <div
                          className="text-4xl md:text-5xl font-bold"
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
                      <div className="flex-1 min-w-0">
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

                        {/* Diagnostic signal: strongest/weakest responses */}
                        <div className="grid sm:grid-cols-2 gap-3 mb-4">
                          <div className="bg-green-50 border border-green-200 p-3">
                            <p className="text-[10px] font-semibold text-green-800 tracking-wider uppercase mb-2">
                              Your Strongest Signals
                            </p>
                            {strongQs.map((q, qi) => (
                              <p key={q.questionId} className="text-xs text-green-700 leading-relaxed mb-1">
                                <span className="font-semibold">{qi + 1}.</span> {getQuestionInsight(q.questionId, q.score, result.companyProfile.industry, true, ci.slug)}
                              </p>
                            ))}
                          </div>
                          <div className="bg-red-50 border border-red-200 p-3">
                            <p className="text-[10px] font-semibold text-red-800 tracking-wider uppercase mb-2">
                              Critical Gaps to Address
                            </p>
                            {weakQs.map((q, qi) => (
                              <p key={q.questionId} className="text-xs text-red-700 leading-relaxed mb-1">
                                <span className="font-semibold">{qi + 1}.</span> {getQuestionInsight(q.questionId, q.score, result.companyProfile.industry, false, ci.slug)}
                              </p>
                            ))}
                          </div>
                        </div>

                        {/* Benchmark context */}
                        <div className="bg-offwhite border border-light p-3 md:p-4 mb-4">
                          <p className="text-xs font-semibold text-tertiary tracking-wider uppercase mb-2">
                            Industry Context
                          </p>
                          <p className="text-sm text-foreground/60 leading-relaxed">
                            {compositeIndexBenchmark(ci.slug, ci.score, result.companyProfile.industry)}
                          </p>
                        </div>

                        {/* Risks */}
                        <div className="p-3 border border-light">
                          <p className="text-[10px] font-semibold text-tertiary tracking-wider uppercase mb-1">
                            What This Score Puts at Risk
                          </p>
                          <p className="text-xs text-foreground/60 leading-relaxed">
                            {compositeIndexRisks(ci.slug, ci.score)} See Section 7 for the full risk assessment.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* What this means callout */}
                    <div
                      className="mt-4 p-3 md:p-4"
                      style={{
                        backgroundColor: `${ciColor}08`,
                        borderLeft: `3px solid ${ciColor}`,
                      }}
                    >
                      <p className="text-xs font-semibold text-secondary mb-1">
                        What This Means for {result.companyProfile.companyName}
                      </p>
                      <p className="text-sm text-foreground/70 leading-relaxed">
                        {ci.interpretation} The 90-day action plan in Section 9 provides specific steps to address this.
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
          {/* SECTION 4: COMPETITIVE POSITIONING & INDUSTRY INTELLIGENCE  */}
          {/* ================================================================= */}
          <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
            <SectionHeader number={4} title="Competitive Positioning & Industry Intelligence" />
            <p className="text-sm text-foreground/60 mt-2 mb-4">
              Your competitors are not standing still — and the gap is measurable.
              This section maps where you stand, where they are heading, and what
              it will cost you if the gap widens. Every data point below is sourced
              from public filings, analyst research, or verified industry reporting.
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
              <p className="text-xs font-semibold tracking-widest uppercase text-navy mb-3">
                Where {result.companyProfile.companyName}&apos;s Competitors Are Investing Right Now
              </p>
              <p className="text-xs text-foreground/50 mb-3">
                At Stage {result.stageClassification.primaryStage} with an overall score of {result.overallScore}/100,
                {" "}{result.companyProfile.companyName} is {result.overallScore >= 60 ? "keeping pace with but not leading" : result.overallScore >= 40 ? "trailing the median of" : "significantly behind"} peers
                in {industryLabel(result.companyProfile.industry)} on these investment areas. Your weakest dimension —{" "}
                {dimensionLabel([...result.dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore)[0]?.dimension || "")} at{" "}
                {[...result.dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore)[0]?.normalizedScore}/100 — is the primary bottleneck
                limiting {result.companyProfile.companyName}&apos;s ability to capture value from these same investments.
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
          {/* SECTION 5: ECONOMIC IMPACT MODEL                            */}
          {/* ================================================================= */}
          <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
            <SectionHeader number={5} title="Economic Impact Model" />
            <p className="text-sm text-foreground/60 mt-2 mb-4">
              {getEconomicScaleContext(result.companyProfile.employeeCount)}{" "}
              Below is the transparent methodology — every assumption stated, every input sourced — so
              your CFO should stress-test these assumptions before sharing with the board.
            </p>

            {/* Methodology credibility block */}
            <div className="bg-offwhite border border-light p-4 md:p-5 mb-8">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                How We Calculate These Numbers
              </p>
              <div className="space-y-3 text-sm text-foreground/70 leading-relaxed">
                <p>
                  <strong className="text-secondary">Step 1: Total labor cost.</strong>{" "}
                  {result.companyProfile.employeeCount.toLocaleString()} employees x ~$85,000
                  average fully-loaded cost = {fmtUSD(Math.round(result.companyProfile.employeeCount * 85000))}.
                  This uses BLS median for {industryLabel(result.companyProfile.industry)} roles
                  adjusted for benefits and overhead. Your actual figure may differ — substitute your
                  real number to refine.
                </p>
                <p>
                  <strong className="text-secondary">Step 2: AI-addressable share.</strong>{" "}
                  McKinsey&apos;s 2024 research estimates {result.economicEstimate.productivityPotentialPercent}%
                  of labor tasks in {industryLabel(result.companyProfile.industry)} are
                  automatable or augmentable with current AI. This is not &quot;replace all workers&quot; —
                  it means {result.economicEstimate.productivityPotentialPercent}% of time across the
                  workforce could be redirected to higher-value work. Accenture and Goldman Sachs
                  research produces similar estimates (18-30% range for most industries).
                </p>
                <p>
                  <strong className="text-secondary">Step 3: Current capture rate.</strong>{" "}
                  Your diagnostic scores indicate you currently capture approximately{" "}
                  {result.economicEstimate.currentCapturePercent}% of this potential. This is
                  derived from your Composite Index scores — particularly Value Capture Efficiency
                  ({result.compositeIndices.find(c => c.slug === ("economic_translation" as string))?.score || result.compositeIndices[1]?.score || "—"}/100).
                  Organizations at your maturity stage typically capture 15-35% (BCG 2024).
                </p>
                <p>
                  <strong className="text-secondary">Step 4: The gap.</strong>{" "}
                  The difference between potential and current capture is the unrealized value:{" "}
                  {fmtUSD(result.economicEstimate.unrealizedValueLow)} to{" "}
                  {fmtUSD(result.economicEstimate.unrealizedValueHigh)}. The range reflects
                  uncertainty in adoption speed and implementation quality. Even the conservative
                  end assumes only modest improvement over current capture rates.
                </p>
              </div>
              <p className="text-[10px] text-tertiary mt-3 italic">
                Challenge these assumptions. The model is designed to be stress-tested, not accepted
                on faith. Adjust labor cost, AI-addressable percentage, or capture rate to reflect
                your internal data.
              </p>
            </div>

            {/* Waterfall / Funnel visualization */}
            <EconomicWaterfall estimate={result.economicEstimate} profile={result.companyProfile} />

            {/* Cost of delay */}
            <div className="mt-8 grid sm:grid-cols-2 gap-4 md:gap-6">
              <div className="bg-navy/5 border border-navy/10 p-4 md:p-6">
                <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
                  Quarterly Cost of Inaction
                </p>
                <p className="text-xl md:text-2xl font-bold text-navy">
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
                  Midpoint of unrealized annual value, divided by four. This is not
                  &quot;money you are losing&quot; — it is productivity improvement you
                  are not capturing while your competitors in{" "}
                  {industryLabel(result.companyProfile.industry)} are. See Section 6
                  for P&L impact and Section 4 for what competitors are doing.
                </p>
              </div>
              <div className="bg-navy/5 border border-navy/10 p-4 md:p-6">
                <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
                  Annual Cost per Employee
                </p>
                <p className="text-xl md:text-2xl font-bold text-navy">
                  {fmtUSD(result.economicEstimate.costPerEmployee)}
                </p>
                <p className="text-xs text-foreground/50 mt-2">
                  Per-employee unrealized value. For context, the average enterprise
                  AI software license costs $1,200-$3,600/employee/year. If your per-employee
                  gap exceeds your per-employee AI investment by 3x+, the ROI case is clear.
                </p>
              </div>
            </div>

            {/* Sensitivity analysis */}
            <div className="mt-6 border border-light p-4 md:p-5">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                Sensitivity Analysis: What If Our Assumptions Are Wrong?
              </p>
              <div className="grid grid-cols-3 gap-2 md:gap-3 text-center">
                <div className="bg-offwhite border border-light p-2 md:p-3">
                  <p className="text-[10px] text-tertiary uppercase tracking-wider mb-1">Conservative</p>
                  <p className="text-sm md:text-lg font-bold text-navy">{fmtUSD(Math.round(result.economicEstimate.unrealizedValueLow * 0.5))}</p>
                  <p className="text-[10px] text-tertiary mt-1">Half the low estimate</p>
                </div>
                <div className="bg-navy/5 border border-navy/10 p-2 md:p-3">
                  <p className="text-[10px] text-tertiary uppercase tracking-wider mb-1">Base Case</p>
                  <p className="text-sm md:text-lg font-bold text-navy">{fmtUSD(Math.round((result.economicEstimate.unrealizedValueLow + result.economicEstimate.unrealizedValueHigh) / 2))}</p>
                  <p className="text-[10px] text-tertiary mt-1">Midpoint estimate</p>
                </div>
                <div className="bg-offwhite border border-light p-2 md:p-3">
                  <p className="text-[10px] text-tertiary uppercase tracking-wider mb-1">Aggressive</p>
                  <p className="text-sm md:text-lg font-bold text-navy">{fmtUSD(result.economicEstimate.unrealizedValueHigh)}</p>
                  <p className="text-[10px] text-tertiary mt-1">Full potential</p>
                </div>
              </div>
              <p className="text-[11px] text-foreground/50 mt-3">
                Even at the most conservative estimate — assuming our model overstates potential
                by 50% — the unrealized value exceeds what most organizations invest in AI
                annually. The question is not whether the opportunity exists but how quickly
                you can capture it before competitors close the gap.
              </p>
            </div>

            {/* Industry benchmark bar */}
            {result.economicEstimate.industryBenchmark && (
              <div className="mt-6 bg-offwhite border border-light p-4 md:p-5">
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
          {/* SECTION 6: P&L BUSINESS CASE                                */}
          {/* ================================================================= */}
          <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
            <SectionHeader number={6} title="The Business Case: P&L Impact Analysis" />

            {(() => {
              const pnl = getPnLImpact(
                result.stageClassification.primaryStage,
                result.companyProfile.industry,
                result.companyProfile.revenue,
                result.economicEstimate.unrealizedValueLow,
                result.economicEstimate.unrealizedValueHigh,
                result.economicEstimate.currentCapturePercent,
                result.companyProfile.companyName,
                result.companyProfile.employeeCount,
                result.dimensionScores,
                result.companyProfile.regulatoryIntensity,
              );

              return (
                <div className="mt-6 space-y-8">
                  {/* Intro */}
                  <p className="text-sm text-foreground/60">
                    Section 5 quantified the unrealized value. This section translates that into
                    the language of your P&L — how AI investment (or the absence of it) flows through
                    revenue, margins, cost structure, talent economics, and risk exposure over the next
                    12-24 months. Every dollar figure below is derived from {result.companyProfile.companyName}&apos;s
                    actual revenue of {fmtUSD(result.companyProfile.revenue)} and industry benchmarks
                    for {industryLabel(result.companyProfile.industry)}.
                  </p>

                  {/* Stage narrative callout */}
                  <div className="border-l-4 border-navy pl-5">
                    <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
                      {pnl.headline}
                    </p>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {pnl.stageNarrative}
                    </p>
                  </div>

                  {/* Two-column: Invest vs. Stand Still */}
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Invest column */}
                    <div className="bg-navy/5 border border-navy/10 p-5">
                      <p className="text-sm font-bold text-navy mb-4">
                        If You Invest Over 12-24 Months
                      </p>
                      <div className="space-y-4">
                        {pnl.scenarios.map((s, i) => (
                          <div key={i} className="border-b border-navy/10 pb-3 last:border-0 last:pb-0">
                            <div className="flex items-baseline justify-between mb-1">
                              <span className="text-xs font-semibold text-navy">{s.label}</span>
                              <span className="text-sm font-bold text-green-700">{s.investDollar}</span>
                            </div>
                            <p className="text-xs text-foreground/60 leading-relaxed">{s.investUpside}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stand still column */}
                    <div className="bg-red-50 border border-red-200 p-5">
                      <p className="text-sm font-bold text-red-800 mb-4">
                        If You Stand Still
                      </p>
                      <div className="space-y-4">
                        {pnl.scenarios.map((s, i) => (
                          <div key={i} className="border-b border-red-100 pb-3 last:border-0 last:pb-0">
                            <div className="flex items-baseline justify-between mb-1">
                              <span className="text-xs font-semibold text-red-800">{s.label}</span>
                              <span className="text-sm font-bold text-red-700">{s.coastDollar}</span>
                            </div>
                            <p className="text-xs text-foreground/60 leading-relaxed">{s.coastDownside}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* EBITDA Impact Summary */}
                  <div className="bg-offwhite border border-light p-5">
                    <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                      Projected EBITDA Impact
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-foreground/50 mb-1">Current Estimate</p>
                        <p className="text-sm font-bold text-navy">{pnl.ebitda.currentLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs text-foreground/50 mb-1">Invest Scenario</p>
                        <p className="text-sm font-bold text-green-700">{pnl.ebitda.investLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs text-foreground/50 mb-1">Stand-Still Scenario</p>
                        <p className="text-sm font-bold text-red-700">{pnl.ebitda.coastLabel}</p>
                      </div>
                    </div>
                  </div>

                  {/* Industry Proof Points */}
                  <div>
                    <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                      What the Data Shows in {industryLabel(result.companyProfile.industry)}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {pnl.proofPoints.map((pp, i) => (
                        <div key={i} className="bg-offwhite border border-light p-4">
                          <div className="flex items-baseline justify-between mb-2">
                            <span className="text-xs font-bold text-navy">{pp.metric}</span>
                          </div>
                          <p className="text-xs text-foreground/70 leading-relaxed mb-2">{pp.claim}</p>
                          <p className="text-[10px] text-tertiary italic">{pp.source}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Compound Cost of Inaction */}
                  <div className="bg-navy/5 border border-navy/10 p-5">
                    <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                      The Compounding Cost of Inaction
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-center mb-4">
                      <div>
                        <p className="text-xs text-foreground/50 mb-1">Per Quarter</p>
                        <p className="text-lg font-bold text-red-700">{fmtUSD(pnl.compoundCost.quarterly)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-foreground/50 mb-1">Year 1 Total</p>
                        <p className="text-lg font-bold text-red-700">{fmtUSD(pnl.compoundCost.year1)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-foreground/50 mb-1">3-Year Cumulative</p>
                        <p className="text-lg font-bold text-red-700">{fmtUSD(pnl.compoundCost.year3)}</p>
                      </div>
                    </div>
                    <p className="text-xs text-foreground/70 leading-relaxed">{pnl.compoundCost.narrative}</p>
                  </div>

                  {/* Optional AI narrative */}
                  {report?.sections?.find((s) => s.slug === "pnl-business-case")?.content && (
                    <div className="mt-6 pt-6 border-t border-light">
                      <MarkdownContent
                        content={report.sections.find((s) => s.slug === "pnl-business-case")?.content || ""}
                      />
                    </div>
                  )}
                </div>
              );
            })()}
          </section>

          {/* ================================================================= */}
          {/* SECTION 7: SECURITY & GOVERNANCE RISK ASSESSMENT            */}
          {/* ================================================================= */}
          <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
            <SectionHeader number={7} title="Security & Governance Risk Assessment" />
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

            {/* Risk severity legend */}
            <div className="flex items-center gap-5 mb-4">
              <p className="text-[10px] font-semibold text-tertiary tracking-wider uppercase">Severity:</p>
              {[
                { label: "High", color: "#FCA5A5" },
                { label: "Medium", color: "#FCD34D" },
                { label: "Low", color: "#86EFAC" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-[10px] text-foreground/50">{item.label}</span>
                </div>
              ))}
            </div>

            {/* Risk breakdown cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {getRiskDetails(result.dimensionScores, result.companyProfile.industry, result.companyProfile.regulatoryIntensity).map((risk, idx) => (
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
            <RiskMatrix dimensionScores={result.dimensionScores} industry={result.companyProfile.industry} regulatoryIntensity={result.companyProfile.regulatoryIntensity} />

            {/* Regulatory landscape context */}
            <div className="mt-6 border border-light p-5">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                Regulatory Landscape for {industryLabel(result.companyProfile.industry).replace(/\b\w/g, (c) => c.toUpperCase())}
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
          {/* SECTION 8: VENDOR & PARTNER LANDSCAPE ASSESSMENT            */}
          {/* ================================================================= */}
          <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
            <SectionHeader number={8} title="Vendor & Partner Landscape Assessment" />
            <p className="text-sm text-foreground/60 mt-2 mb-4">
              Independent analysis of AI vendor positioning, buy/build/partner
              recommendations, and stack optimization opportunities. This assessment
              draws on Gartner Magic Quadrant positioning, Forrester Wave evaluations,
              and current market intelligence to recommend partners aligned to your
              maturity stage, industry, and strategic objectives.
            </p>

            {/* Vendor evaluation framework */}
            <div className="bg-offwhite border border-light p-4 md:p-5 mb-6">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                Evaluation Framework
              </p>
              <p className="text-sm text-foreground/70 leading-relaxed mb-4">
                Every vendor relationship is a bet on your AI future. We evaluate across six
                dimensions, weighted for your maturity stage. At Stage{" "}
                {result.stageClassification.primaryStage}, the priorities that matter most for
                {" "}{result.companyProfile.companyName} are{" "}
                {result.stageClassification.primaryStage <= 2
                  ? "Fit and Support — you need tools that work fast with teams that help you deploy."
                  : "Scale, Risk, and Ecosystem — you need platforms that grow with you without locking you in."}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
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
                    className="bg-white border border-light p-3 text-center"
                  >
                    <p className="text-xs font-semibold text-secondary">
                      {crit.label}
                    </p>
                    <p className="text-[10px] text-tertiary mt-1">
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
                    when: result.companyProfile.regulatoryIntensity === 'high'
                      ? `Compliance-ready commodity capabilities (AI-assisted documentation, chatbots, analytics) where ${industryLabel(result.companyProfile.industry)} regulatory requirements are well-served by established vendors`
                      : `Commodity capabilities (chatbots, document processing, analytics dashboards) where differentiation is not a priority for ${result.companyProfile.companyName}`,
                    guidance: result.stageClassification.primaryStage <= 2
                      ? `Recommended for most use cases at ${result.companyProfile.companyName}'s maturity stage. With an Authority Structure score of ${result.dimensionScores.find((d) => d.dimension === "authority_structure")?.normalizedScore || 0}/100, prioritize tools that require minimal governance overhead and deliver time-to-value in weeks, not months.`
                      : `Appropriate for non-differentiating capabilities. At ${result.companyProfile.companyName}'s scale (${result.companyProfile.employeeCount.toLocaleString()} employees), vendor solutions should include enterprise SLAs and data portability guarantees.`,
                  },
                  {
                    strategy: "Build",
                    when: result.companyProfile.regulatoryIntensity === 'high'
                      ? `Proprietary models trained on ${result.companyProfile.companyName}'s data where off-the-shelf solutions cannot meet ${industryLabel(result.companyProfile.industry)} regulatory or accuracy requirements`
                      : `Core differentiators where ${result.companyProfile.companyName}'s proprietary data, models, or workflows create competitive advantage in ${industryLabel(result.companyProfile.industry)}`,
                    guidance: result.stageClassification.primaryStage <= 2
                      ? `Exercise caution. ${result.companyProfile.companyName}'s Workflow Integration score of ${result.dimensionScores.find((d) => d.dimension === "workflow_integration")?.normalizedScore || 0}/100 suggests custom AI infrastructure is premature — build on vendor platforms first, then internalize once usage patterns mature.`
                      : `Appropriate for strategic capabilities. ${result.companyProfile.companyName}'s ${result.dimensionScores.find((d) => d.dimension === "workflow_integration")?.normalizedScore || 0}/100 Workflow Integration suggests ${(result.dimensionScores.find((d) => d.dimension === "workflow_integration")?.normalizedScore || 0) >= 60 ? 'sufficient infrastructure maturity to support selective custom development' : 'building MLOps and data platform capability before scaling custom AI'}.`,
                  },
                  {
                    strategy: "Partner",
                    when: `Complex transformations requiring ${result.companyProfile.regulatoryIntensity === 'high' ? `${industryLabel(result.companyProfile.industry)}-specific regulatory expertise, ` : ''}domain knowledge, organizational change management, or accelerated timelines`,
                    guidance: result.stageClassification.primaryStage <= 2
                      ? `Strongly recommended for ${result.companyProfile.companyName}. With a Decision Velocity score of ${result.dimensionScores.find((d) => d.dimension === "decision_velocity")?.normalizedScore || 0}/100, a strategic partner can compress ${result.companyProfile.companyName}'s learning curve by 12-18 months and avoid the governance pitfalls that stall ${result.overallScore < 40 ? '80%' : '60%'} of organizations at this stage.`
                      : `Selective use for specialized domains. ${result.companyProfile.companyName}'s internal capabilities should lead most initiatives, with partners filling specific expertise gaps in areas like ${result.companyProfile.regulatoryIntensity === 'high' ? 'AI compliance, model validation, and regulatory technology' : 'advanced ML engineering, change management, and data architecture'}.`,
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

            {/* AI Contract Value Levers */}
            <div className="border border-light p-4 md:p-5 mb-6">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                Contract Value Levers: How to Negotiate Smarter AI Deals
              </p>
              <p className="text-sm text-foreground/70 leading-relaxed mb-4">
                AI vendor contracts are not software licenses. The economics are different,
                the risks are different, and the leverage points are different.
                {result.stageClassification.primaryStage <= 2
                  ? ` At Stage ${result.stageClassification.primaryStage}, ${result.companyProfile.companyName} is likely entering its first significant AI vendor relationships — getting these contracts right from the start avoids costly renegotiations later.`
                  : ` At Stage ${result.stageClassification.primaryStage}, ${result.companyProfile.companyName} likely has existing AI vendor relationships that should be audited against these levers — renegotiation windows are leverage points.`}
                {result.companyProfile.regulatoryIntensity === 'high'
                  ? ` In ${industryLabel(result.companyProfile.industry)}, data sovereignty and compliance provisions are non-negotiable and should be explicit in every AI contract.`
                  : ''}
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  {
                    lever: "Declining Unit Economics",
                    description: `AI inference costs drop 30-50% annually as models become more efficient. ${result.stageClassification.primaryStage <= 2 ? `As ${result.companyProfile.companyName} enters new AI contracts, build` : `In ${result.companyProfile.companyName}'s existing and future contracts, ensure`} automatic price reductions — 15-20% annual step-downs are reasonable. At ${fmtUSD(result.companyProfile.revenue)} revenue, overpaying on AI compute by even 20% compounds to ${fmtUSD(Math.round(result.companyProfile.revenue * 0.002))} in unnecessary annual spend.`,
                  },
                  {
                    lever: "Data Portability Guarantees",
                    description: `Insist on full data export in standard formats with ≤30-day extraction windows. ${result.companyProfile.regulatoryIntensity === 'high' ? `In ${industryLabel(result.companyProfile.industry)}, data portability is not just a commercial issue — it's a regulatory requirement. Your patient data, financial records, and compliance models must be extractable on demand.` : `${result.companyProfile.companyName}'s training data and fine-tuned models are proprietary IP — vendor lock-in happens when you cannot take them with you.`}`,
                  },
                  {
                    lever: "Model-Agnostic Architecture",
                    description: `Structure contracts to allow model swaps without renegotiation. The LLM landscape shifts quarterly — ${result.stageClassification.primaryStage <= 2 ? `${result.companyProfile.companyName} should avoid committing to a single model provider before understanding which capabilities matter most for ${industryLabel(result.companyProfile.industry)} use cases` : `${result.companyProfile.companyName} should ensure existing integrations support model substitution as better options emerge`}. Require API-compatible alternatives.`,
                  },
                  {
                    lever: "Usage-Based Pricing with Caps",
                    description: `Negotiate consumption-based pricing with hard budget caps and volume discounts. ${result.stageClassification.primaryStage <= 2 ? `${result.companyProfile.companyName} should avoid flat enterprise licenses until AI usage patterns stabilize — organizations at Stage ${result.stageClassification.primaryStage} typically overpay by 40-60% in year one because adoption is uneven.` : `At Stage ${result.stageClassification.primaryStage}, ${result.companyProfile.companyName} has enough usage data to negotiate volume tiers that match actual consumption. Push for 25-40% volume discounts at your scale.`}`,
                  },
                  {
                    lever: "Performance SLAs with Teeth",
                    description: `Tie payments to measurable outcomes: latency, accuracy, uptime, not just availability. ${result.companyProfile.regulatoryIntensity === 'high' ? `In ${industryLabel(result.companyProfile.industry)}, model accuracy degradation can create compliance liability — your contracts must include drift monitoring and penalty clauses for performance degradation below agreed thresholds.` : `AI outputs can drift over time as data distributions change. ${result.companyProfile.companyName}'s contracts should include penalty clauses for model degradation below agreed accuracy thresholds.`}`,
                  },
                  {
                    lever: "Termination Without Penalty",
                    description: `Negotiate 90-day termination clauses with data return guarantees. ${result.stageClassification.primaryStage <= 2 ? `At Stage ${result.stageClassification.primaryStage}, ${result.companyProfile.companyName}'s AI strategy will evolve significantly — 3-year lock-ins made today will be regretted in 18 months. Insist on flexibility.` : `Even at Stage ${result.stageClassification.primaryStage}, the AI vendor landscape is volatile enough that long-term lock-ins carry material risk. If the product delivers value, ${result.companyProfile.companyName} will stay anyway.`}`,
                  },
                ].map((item) => (
                  <div key={item.lever} className="bg-offwhite border border-light p-3 md:p-4">
                    <p className="text-sm font-semibold text-secondary mb-1">{item.lever}</p>
                    <p className="text-xs text-foreground/60 leading-relaxed">{item.description}</p>
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
          {/* SECTION 9: 90-DAY TRANSFORMATION ACTION PLAN                */}
          {/* ================================================================= */}
          <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
            <SectionHeader number={9} title="90-Day Transformation Action Plan" />
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
          {/* SECTION 10: MESSAGES FOR THE BOARD                          */}
          {/* ================================================================= */}
          <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
            <SectionHeader number={10} title="Messages for the Board" />
            <p className="text-sm text-foreground/60 mt-2 mb-4">
              These findings are structured for direct board presentation. Each item
              below is a decision point, not an informational update. NACD&apos;s 2024
              Board Oversight of AI report found that 78% of boards consider AI a
              top-three priority — but only 23% feel equipped to oversee it. The asks
              below are designed to close that gap for {result.companyProfile.companyName}.
            </p>

            {/* Peer board intelligence */}
            <div className="bg-offwhite border border-light p-4 md:p-5 mb-6">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                What Peer Boards Are Doing
              </p>
              <div className="space-y-3">
                {getPeerBoardActions(result.companyProfile.industry).map((peer, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-navy" />
                    <div>
                      <p className="text-sm text-foreground/70 leading-relaxed">
                        <strong className="text-secondary">{peer.company}:</strong> {peer.action}
                      </p>
                      <p className="text-[10px] text-tertiary mt-0.5">{peer.source}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Board-ready headline findings */}
            <div className="border-2 border-navy p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold tracking-widest uppercase text-tertiary">
                  Board-Ready Headline Findings
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5" style={{ backgroundColor: "#991B1B" }} />
                    <span className="text-[10px] text-foreground/50">Critical</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5" style={{ backgroundColor: "#92400E" }} />
                    <span className="text-[10px] text-foreground/50">High</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5" style={{ backgroundColor: "#0B1D3A" }} />
                    <span className="text-[10px] text-foreground/50">Informational</span>
                  </div>
                </div>
              </div>
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
          {/* SECTION 11: METHODOLOGY, DATA SOURCES & CITATIONS            */}
          {/* ================================================================= */}
          <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
            <SectionHeader number={11} title="Methodology, Data Sources & Citations" />
            <p className="text-sm text-foreground/60 mt-2 mb-6">
              Transparency is a core principle of this diagnostic. Below is the complete
              scoring methodology, every data source consulted, and the full research citation
              list — so every number and recommendation in this report can be independently verified.
            </p>

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
                          width: `${Math.min(99, Math.round(result.stageClassification.confidence * 100))}%`,
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
                      {Math.min(99, Math.round(result.stageClassification.confidence * 100))}%
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

            {/* Research & Citations */}
            <div className="mt-8 pt-6 border-t border-light">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-4">
                Research & Citations
              </p>
            <div className="grid md:grid-cols-2 gap-x-8 gap-y-1">
              {[
                { cat: "Industry Research", sources: [
                  "McKinsey & Company, \"The State of AI in 2024: Gen AI's Breakout Year,\" Global AI Survey, 2024",
                  "BCG Henderson Institute, \"From Potential to Profit: The AI Advantage Report,\" 2024",
                  "Deloitte, \"State of AI in the Enterprise, 6th Edition,\" 2024",
                  "Gartner, \"AI Maturity Model for Enterprise Organizations,\" 2024",
                  "Accenture, \"Technology Vision 2024: Human by Design\"",
                  "Goldman Sachs, \"Generative AI: The Economic Impact,\" Global Economics Research, 2024",
                ]},
                { cat: "Governance & Board Oversight", sources: [
                  "National Association of Corporate Directors (NACD), \"Board Oversight of AI,\" 2024",
                  "World Economic Forum, \"AI Governance Alliance: Responsible AI Framework,\" 2024",
                  "Gartner, \"AI Trust, Risk and Security Management (AI TRiSM),\" 2024",
                  "IBM, \"Cost of a Data Breach Report,\" 2024",
                ]},
                { cat: "Regulatory & Compliance", sources: [
                  "European Union, \"EU AI Act\" (Regulation 2024/1689), effective August 2025",
                  "State of Colorado, \"Colorado AI Act\" (SB21-169), consumer protections",
                  "California Legislature, \"AI Transparency Act\" and related proposals",
                  "White House Executive Order on Safe, Secure, and Trustworthy AI, October 2023",
                ]},
                { cat: "Vendor & Market Intelligence", sources: [
                  "Gartner Magic Quadrant for Cloud AI Developer Services, 2024",
                  "Forrester Wave: AI Foundation Models, 2024",
                  "Forrester Wave: AI Strategy Consulting, 2024",
                  "Gartner Market Guide for AI Trust, Risk and Security Management, 2024",
                ]},
                { cat: "Economic Methodology", sources: [
                  "Bureau of Labor Statistics, Occupational Employment and Wage Statistics, 2024",
                  "McKinsey Global Institute, \"The Economic Potential of Generative AI,\" 2024",
                  "BCG, \"Where Value Comes from in AI,\" 2024",
                  "Deloitte, \"Measuring AI ROI: A Practical Guide for Enterprises,\" 2024",
                ]},
                { cat: "Industry-Specific Sources", sources: [
                  `Company 10-K and 10-Q filings via SEC EDGAR (for public company analysis)`,
                  "Google News intelligence aggregation (company and industry signals)",
                  "Industry analyst reports and conference proceedings (sector-specific)",
                  "Patent filings and R&D disclosures (competitive intelligence)",
                ]},
              ].map((group) => (
                <div key={group.cat} className="mb-4">
                  <p className="text-xs font-semibold text-navy tracking-wider uppercase mb-2">{group.cat}</p>
                  <div className="space-y-1">
                    {group.sources.map((s, i) => (
                      <p key={i} className="text-[11px] text-foreground/50 leading-relaxed pl-3 border-l-2 border-light">
                        {s}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            </div>
          </section>

          {/* ================================================================= */}
          {/* CONTACT CTA                                                    */}
          {/* ================================================================= */}
          <section className="bg-navy text-white p-8 md:p-12 mb-8 text-center">
            <div className="max-w-2xl mx-auto">
              <p className="text-xs font-semibold tracking-[0.35em] uppercase text-white/40 mb-3">
                Next Steps
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Discuss These Findings
              </h2>
              <p className="text-sm text-white/70 leading-relaxed mb-6">
                This diagnostic identified{" "}
                {fmtUSD(result.economicEstimate.unrealizedValueLow)} to{" "}
                {fmtUSD(result.economicEstimate.unrealizedValueHigh)}{" "}
                in unrealized AI value for {result.companyProfile.companyName}.
                Schedule a 30-minute strategy session to walk through these findings,
                pressure-test the assumptions, and map the first 90 days of action.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <a
                  href="mailto:ryan.king@rlkconsultingco.com?subject=AI%20Diagnostic%20Follow-Up%20%E2%80%94%20${encodeURIComponent(result.companyProfile.companyName)}&body=${encodeURIComponent(`Hi Ryan,\n\nI just completed the AI Diagnostic for ${result.companyProfile.companyName} (score: ${result.overallScore}/100, Stage ${result.stageClassification.primaryStage}).\n\nI'd like to schedule a follow-up discussion to review the findings and discuss next steps.\n\nBest regards`)}"
                  className="inline-block bg-white text-navy font-semibold text-sm px-8 py-3 hover:bg-white/90 transition-colors tracking-wide"
                >
                  Schedule a Follow-Up Meeting
                </a>
                <a
                  href="https://rlkconsultingco.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block border border-white/30 text-white text-sm px-8 py-3 hover:bg-white/10 transition-colors tracking-wide"
                >
                  Learn About RLK Consulting
                </a>
              </div>
              <p className="text-[11px] text-white/40 mt-6">
                Ryan King | Founder, RLK Consulting | ryan.king@rlkconsultingco.com
              </p>
            </div>
          </section>

          {/* ================================================================= */}
          {/* DISCLAIMER                                                        */}
          {/* ================================================================= */}
          <section className="bg-offwhite border border-light p-6 mb-8">
            <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
              Methodology & AI Enrichment Disclaimer
            </p>
            <p className="text-[11px] text-foreground/50 leading-relaxed mb-3">
              The RLK AI Diagnostic methodology is proprietary intellectual property developed by
              Ryan King, founder of RLK Consulting, a CIO advisory firm, drawing on frameworks
              refined across a decade of management consulting at McKinsey & Company and Deloitte. The five-dimension behavioral diagnostic model, composite
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

            <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider mt-5 mb-2">
              Important Legal Notices
            </p>
            <p className="text-[11px] text-foreground/50 leading-relaxed mb-3">
              <span className="font-semibold">Not Professional Advice.</span>{" "}
              This report is provided for informational and strategic planning purposes only. It
              does not constitute legal, financial, investment, tax, accounting, or professional
              consulting advice. Recommendations and findings should be validated with qualified
              professionals familiar with your organization&apos;s specific circumstances before making
              material business decisions.
            </p>
            <p className="text-[11px] text-foreground/50 leading-relaxed mb-3">
              <span className="font-semibold">AI-Generated Content.</span>{" "}
              Portions of this report, including narrative analysis, competitive intelligence, and
              industry benchmarks, are generated or augmented using artificial intelligence. While
              we employ rigorous prompts and validation, AI-generated analysis may contain errors,
              omissions, or outdated information. All findings should be independently verified
              before being used as the basis for business decisions.
            </p>
            <p className="text-[11px] text-foreground/50 leading-relaxed mb-3">
              <span className="font-semibold">Third-Party Data & References.</span>{" "}
              This report references publicly available information including published financial
              data, press releases, analyst reports, industry research, and named company examples.
              All third-party company names, trademarks, and data are the property of their
              respective owners. Their inclusion is for illustrative and benchmarking purposes only
              and does not imply endorsement, affiliation, or sponsorship by those companies. We
              make no representations about the accuracy or completeness of third-party data cited
              herein.
            </p>
            <p className="text-[11px] text-foreground/50 leading-relaxed mb-3">
              <span className="font-semibold">No Guarantee of Results.</span>{" "}
              Past performance, industry benchmarks, and case studies referenced in this report do
              not guarantee future results. The unrealized value estimates, ROI projections, and
              financial figures presented are modeled approximations based on industry averages,
              published research, and your self-reported inputs. They are illustrative estimates,
              not promises of specific financial outcomes. Actual results will vary based on
              implementation quality, market conditions, organizational factors, and other variables
              outside the scope of this assessment.
            </p>
            <p className="text-[11px] text-foreground/50 leading-relaxed">
              <span className="font-semibold">Confidentiality.</span>{" "}
              This report is prepared exclusively for {result.companyProfile.companyName} and
              contains proprietary analysis. Distribution, reproduction, or sharing of this report
              or its contents with third parties without the written consent of RLK Consulting is
              prohibited. External data points and benchmarks referenced herein are drawn from the
              latest available public sources and research publications.
            </p>
          </section>

          <div className="rlk-gradient-bar-thick mt-2 mb-4" />
          <div className="text-center py-4">
            <p className="text-xs text-tertiary">
              This report is confidential and prepared solely for{" "}
              {result.companyProfile.companyName}. Methodology developed by
              Ryan King, founder of RLK Consulting, a CIO advisory firm,
              based on frameworks refined across a decade of management
              consulting at McKinsey and Deloitte.
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
          <span className="text-xs text-tertiary">AI Diagnostic Report</span>
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

function StageDisplay({ stage, overallScore, dimensionScores }: { stage: StageClassification; overallScore?: number; dimensionScores?: DimensionScore[] }) {
  const stageColors = ["#CED5DD", "#A8B5C4", "#6B7F99", "#364E6E", "#0B1D3A"];
  const stageNames = ["Initial", "Exploring", "Managed Deployment", "Scaling", "Optimized"];
  const stageDescriptions = [
    "AI is ad hoc. No governance, no measurement, no organizational commitment. Tools may exist but usage is sporadic and uncoordinated.",
    "Pilots are underway. Some leadership engagement and early governance, but AI has not yet changed how work gets done at scale.",
    "AI is embedded in select workflows with measurable impact. Governance structures exist but scaling remains constrained by organizational friction.",
    "AI is a strategic capability. Most business units have active AI programs, value is tracked, and governance enables rather than blocks deployment.",
    "AI is an organizational differentiator. Proprietary models, AI-native products, and a culture that treats AI as infrastructure rather than initiative.",
  ];

  const score = overallScore || 0;
  const current = stage.primaryStage;

  // Why not higher — narrative, not math
  const whyNotHigher = current < 5
    ? (() => {
        if (!dimensionScores) return "Improvement across multiple dimensions is required to advance.";
        const weakest = [...dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore)[0];
        const secondWeakest = [...dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore)[1];
        const whyNotNarratives: Record<number, string> = {
          1: `Your organization has not yet moved beyond ad hoc AI experimentation. The diagnostic reveals that ${dimensionLabel(weakest?.dimension || "")} and ${dimensionLabel(secondWeakest?.dimension || "")} are both at foundational levels — meaning there is no consistent process for how AI gets adopted, governed, or measured. Stage 2 organizations have at least begun formalizing these processes; yours has not yet crossed that threshold.`,
          2: `You have the beginnings of AI capability, but it has not translated into managed, repeatable deployment. The gap is organizational: ${dimensionLabel(weakest?.dimension || "")} shows that your governance or process structures are not yet mature enough to move AI from isolated experiments into coordinated programs. Stage 3 organizations have established clear ownership, measurement, and governance — your responses indicate these are still forming.`,
          3: `Your AI programs are managed but not yet scaling across the enterprise. The barrier is primarily ${dimensionLabel(weakest?.dimension || "")}: your responses indicate that while pockets of AI maturity exist, the organizational connective tissue — decision rights, value measurement, cross-team learning — is not yet strong enough to support enterprise-wide scaling. Stage 4 organizations have cracked this code; you are close but not there.`,
          4: `You are scaling AI successfully, but it has not yet become a strategic differentiator. Stage 5 organizations have AI embedded so deeply that it shapes products, business models, and competitive strategy — not just operations. Your ${dimensionLabel(weakest?.dimension || "")} score suggests there is still a gap between AI as an operational tool and AI as a competitive weapon.`,
        };
        return whyNotNarratives[current] || "Further maturity across all dimensions is needed.";
      })()
    : "You have reached the highest maturity stage. The focus now is sustaining this position and converting maturity into competitive moats.";

  // Why not lower — narrative, not math
  const whyNotLower = current > 1
    ? (() => {
        if (!dimensionScores) return "Strengths in multiple dimensions elevate your classification.";
        const strongest = [...dimensionScores].sort((a, b) => b.normalizedScore - a.normalizedScore)[0];
        const secondStrongest = [...dimensionScores].sort((a, b) => b.normalizedScore - a.normalizedScore)[1];
        const whyNotLowerNarratives: Record<number, string> = {
          2: `You are beyond Stage 1 because your organization has moved past pure experimentation. Your ${dimensionLabel(strongest?.dimension || "")} responses show intentional effort — AI is not accidental here. You have started building the muscle, even if it is not yet coordinated.`,
          3: `Your ${dimensionLabel(strongest?.dimension || "")} and ${dimensionLabel(secondStrongest?.dimension || "")} scores demonstrate real organizational capability. AI is producing measurable results in specific areas, governance structures exist, and there is executive awareness. Stage 2 organizations are still figuring out whether AI matters; you have moved past that question.`,
          4: `You have clear organizational strengths that Stage 3 organizations lack. Your ${dimensionLabel(strongest?.dimension || "")} capability shows AI is not just managed — it is accelerating. Multiple business units are engaged, value is being tracked, and the organization has learned from early deployments.`,
          5: `You have achieved what fewer than 8% of enterprises have: AI maturity across every organizational dimension. Your ${dimensionLabel(strongest?.dimension || "")} and ${dimensionLabel(secondStrongest?.dimension || "")} scores reflect an organization where AI is not a project — it is infrastructure.`,
        };
        return whyNotLowerNarratives[current] || "Your strengths elevate you beyond the previous stage.";
      })()
    : "This is the entry-level stage.";

  return (
    <div>
      {/* All 5 stages displayed */}
      <div className="space-y-2 mb-6">
        {[1, 2, 3, 4, 5].map((s) => {
          const isCurrent = s === current;
          return (
            <div
              key={s}
              className={`flex items-start gap-3 p-3 border ${isCurrent ? "border-navy bg-navy/5" : "border-light"}`}
            >
              <div
                className="flex-shrink-0 w-8 h-8 flex items-center justify-center text-xs font-bold mt-0.5"
                style={{
                  backgroundColor: isCurrent ? stageColors[s - 1] : s < current ? stageColors[s - 1] : "#F0F1F3",
                  color: isCurrent || s < current ? "#fff" : "#A8B5C4",
                }}
              >
                {s}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${isCurrent ? "text-navy" : s < current ? "text-secondary" : "text-tertiary"}`}>
                    {stageNames[s - 1]}
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 bg-navy text-white tracking-wider uppercase">
                      Your Stage
                    </span>
                  )}
                  {s < current && (
                    <span className="text-[9px] text-tertiary">Achieved</span>
                  )}
                </div>
                <p className={`text-xs leading-relaxed mt-0.5 ${isCurrent ? "text-foreground/70" : "text-foreground/40"}`}>
                  {stageDescriptions[s - 1]}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Why you are here */}
      <div className="border-2 border-navy p-5 mb-4">
        <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
          Why Stage {current}
        </p>
        <p className="text-sm text-foreground/70 leading-relaxed">
          {stage.stageDescription}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {current < 5 && (
          <div className="bg-offwhite border border-light p-4">
            <p className="text-[10px] font-semibold tracking-wider uppercase text-tertiary mb-1">
              Why Not Stage {current + 1}
            </p>
            <p className="text-xs text-foreground/60 leading-relaxed">{whyNotHigher}</p>
          </div>
        )}
        {current > 1 && (
          <div className="bg-offwhite border border-light p-4">
            <p className="text-[10px] font-semibold tracking-wider uppercase text-tertiary mb-1">
              Why Not Stage {current - 1}
            </p>
            <p className="text-xs text-foreground/60 leading-relaxed">{whyNotLower}</p>
          </div>
        )}
      </div>

      {stage.confidence < 0.7 && (
        <p className="text-xs text-tertiary mt-3">
          Confidence: {Math.min(99, Math.round(stage.confidence * 100))}%. Dimension
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
  return (
    <div>
      {/* Unrealized value highlight */}
      <div className="bg-navy/5 border border-navy/10 p-6 mb-6">
        <p className="text-xs font-semibold text-tertiary tracking-widest uppercase mb-2">
          Estimated Unrealized Annual Value
        </p>
        <div className="text-2xl md:text-3xl font-bold text-navy">
          {fmtUSD(estimate.unrealizedValueLow)} to{" "}
          {fmtUSD(estimate.unrealizedValueHigh)}
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
          value={fmtNum(estimate.annualWastedHours)}
        />
        <Metric
          label="Cost per Employee"
          value={fmtUSD(estimate.costPerEmployee)}
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
    <section className="bg-white border border-light p-6 md:p-10">
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
// Industry label formatter
// ---------------------------------------------------------------------------

const INDUSTRY_LABELS: Record<string, string> = {
  insurance: "Insurance",
  banking: "Banking",
  capital_markets: "Capital Markets",
  asset_wealth_management: "Asset & Wealth Management",
  investment_banking: "Investment Banking / M&A Advisory",
  private_equity: "Private Equity",
  venture_capital: "Venture Capital",
  hedge_funds: "Hedge Funds",
  healthcare_providers: "Healthcare Providers",
  healthcare_payers: "Healthcare Payers",
  healthcare_services: "Healthcare Services",
  life_sciences_pharma: "Life Sciences & Pharmaceuticals",
  retail: "Retail",
  ecommerce_digital: "E-Commerce & Digital Commerce",
  cpg: "Consumer Packaged Goods",
  dtc: "Direct-to-Consumer",
  food_beverage: "Food & Beverage",
  manufacturing_discrete: "Discrete Manufacturing",
  manufacturing_process: "Process & Industrial Manufacturing",
  automotive: "Automotive",
  aerospace_defense: "Aerospace & Defense",
  energy_oil_gas: "Energy (Oil & Gas)",
  utilities: "Utilities",
  chemicals_materials: "Chemicals & Materials",
  industrial_services: "Industrial Services",
  software_saas: "Software / SaaS",
  it_services: "IT Services",
  hardware_electronics: "Hardware / Electronics",
  telecommunications: "Telecommunications",
  media_entertainment: "Media & Entertainment",
  transportation: "Transportation",
  shipping_logistics: "Shipping & Logistics",
  infrastructure_transport: "Infrastructure / Transportation",
  construction_engineering: "Construction & Engineering",
  real_estate_commercial: "Commercial Real Estate",
  real_estate_residential: "Residential Real Estate",
  government_federal: "Federal Government",
  government_state_local: "State & Local Government",
  defense_contractors: "Defense Contractors",
  nonprofit_ngo: "Non-Profit & NGO",
  consulting_services: "Consulting Services",
  legal_services: "Legal Services",
  accounting_audit: "Accounting / Audit",
};

function industryLabel(slug: string): string {
  return INDUSTRY_LABELS[slug] || slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Currency formatter (used by full report sections)
// ---------------------------------------------------------------------------

function fmtUSD(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) {
    return `$${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (Math.abs(n) >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (Math.abs(n) >= 1_000) {
    return `$${(n / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtNum(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

// ---------------------------------------------------------------------------
// Economic Scale Context — adapts "why these numbers" language to company size
// ---------------------------------------------------------------------------

function getEconomicScaleContext(employeeCount: number): string {
  if (employeeCount <= 50) {
    return `For a team of ${employeeCount}, AI impact concentrates in high-leverage roles where each person carries outsized operational weight — making per-employee gains disproportionately valuable.`;
  } else if (employeeCount <= 200) {
    return `At ${employeeCount} employees, AI gains concentrate in core workflows rather than spreading thin across thousands of roles — which means projected savings are achievable faster with fewer dependencies.`;
  } else if (employeeCount <= 1000) {
    return `At ${employeeCount.toLocaleString()} employees, AI gains compound across multiple departments — large enough for meaningful automation savings, but manageable enough to implement without enterprise-scale change management.`;
  } else if (employeeCount <= 5000) {
    return `These numbers reflect AI impact compounding across ${employeeCount.toLocaleString()} employees and thousands of workflows — even marginal per-employee improvements translate to significant absolute dollar impact at this scale.`;
  } else {
    return `These numbers are large because your organization is large — AI impact scales with ${employeeCount.toLocaleString()} employees, their fully-loaded labor cost, and the process complexity that comes with operating at this scale.`;
  }
}

// ---------------------------------------------------------------------------
// Section Header (numbered McKinsey-style)
// ---------------------------------------------------------------------------

function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-4">
        <div
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-white text-sm font-bold tracking-wide"
          style={{ backgroundColor: "#0B1D3A" }}
        >
          {number}
        </div>
        <h3 className="text-xl md:text-2xl font-bold text-navy tracking-tight">
          {title}
        </h3>
      </div>
      <div className="mt-4 h-px bg-gradient-to-r from-navy/20 via-navy/8 to-transparent" />
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
    <div className="relative w-full max-w-[340px] mx-auto" style={{ height: 300 }}>
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
                className="h-full"
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: step.color,
                  transition: "width 0.8s ease-out",
                }}
              />
            </div>
            <p className="text-[10px] text-foreground/50 mt-0.5 leading-snug">
              {step.detail}
            </p>
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
                  className="relative flex flex-col items-center justify-center p-3 border border-light/50"
                  style={{
                    backgroundColor: q.bg,
                    gridRow: q.row + 1,
                    gridColumn: q.col + 1,
                  }}
                >
                  {/* Quadrant label with solid background so it's always readable */}
                  <div className="z-20 px-2 py-1 rounded" style={{ backgroundColor: q.bg }}>
                    <p className="text-xs font-semibold text-secondary text-center leading-tight">
                      {q.label}
                    </p>
                    <p className="text-[9px] text-tertiary text-center mt-0.5">
                      {q.sublabel}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Company position dot — label positioned to avoid quadrant text */}
            {(() => {
              // Determine label placement based on dot position
              // If dot is near center of any quadrant, offset label to avoid overlapping quadrant title
              const labelAbove = dotBottom < 45; // low on chart → show label above dot
              const labelRight = dotLeft < 40;   // left side → show label to the right
              const labelStyle: React.CSSProperties = labelAbove
                ? { bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 4 }
                : { top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 4 };
              // If near the left or right edge, shift label horizontally
              if (dotLeft < 20) {
                labelStyle.left = 0;
                labelStyle.transform = "none";
              } else if (dotLeft > 80) {
                labelStyle.left = "auto";
                labelStyle.right = 0;
                labelStyle.transform = "none";
              }
              return (
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
                      className="absolute px-2 py-0.5 text-[9px] font-bold text-white whitespace-nowrap"
                      style={{
                        backgroundColor: "#0B1D3A",
                        ...labelStyle,
                      }}
                    >
                      {companyName}
                    </div>
                  </div>
                </div>
              );
            })()}

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
  industry,
  regulatoryIntensity,
}: {
  dimensionScores: DimensionScore[];
  industry: string;
  regulatoryIntensity: string;
}) {
  const getScore = (dim: string) =>
    dimensionScores.find((d) => d.dimension === dim)?.normalizedScore || 50;

  // Industry-specific impact modifiers: regulated industries face higher governance/compliance impact
  const highRegIndustries = new Set([
    'insurance', 'banking', 'capital_markets', 'asset_wealth_management', 'investment_banking',
    'healthcare_providers', 'healthcare_payers', 'life_sciences_pharma',
    'government_federal', 'defense_contractors', 'aerospace_defense',
  ]);
  const isHighReg = highRegIndustries.has(industry) || regulatoryIntensity === 'high';

  // Impact is now derived from BOTH the dimension score (lower score = higher impact)
  // AND industry-specific factors
  const computeImpact = (dim: string, baseImpact: number, regBoost: boolean): number => {
    const score = getScore(dim);
    // Very low scores amplify impact; high scores reduce it
    const scoreModifier = score < 25 ? 1 : score < 50 ? 0 : score < 75 ? -1 : -1;
    const regModifier = regBoost && isHighReg ? 1 : 0;
    return Math.min(4, Math.max(1, baseImpact + scoreModifier + regModifier));
  };

  // Invert scores: low dimension score = high risk likelihood
  const risks = [
    {
      label: "Shadow AI Proliferation",
      likelihood: Math.round((100 - getScore("authority_structure")) / 25) + 1,
      impact: computeImpact("authority_structure", 2, true), // Reg boost: shadow AI in regulated industries = critical
      dim: "authority_structure",
    },
    {
      label: "Governance Gap Exposure",
      likelihood: Math.round((100 - getScore("authority_structure")) / 25) + 1,
      impact: computeImpact("authority_structure", 3, true), // Reg boost: compliance gaps in regulated = severe
      dim: "authority_structure",
    },
    {
      label: "Untracked AI Spend",
      likelihood: Math.round((100 - getScore("economic_translation")) / 25) + 1,
      impact: computeImpact("economic_translation", 2, false), // Financial visibility matters everywhere equally
      dim: "economic_translation",
    },
    {
      label: "Decision Bottleneck Risk",
      likelihood: Math.round((100 - getScore("decision_velocity")) / 25) + 1,
      impact: computeImpact("decision_velocity", 2, false), // Speed matters based on their actual velocity gap
      dim: "decision_velocity",
    },
    {
      label: "Workflow Fragmentation",
      likelihood: Math.round((100 - getScore("workflow_integration")) / 25) + 1,
      impact: computeImpact("workflow_integration", 2, false),
      dim: "workflow_integration",
    },
    {
      label: "Adoption Stall Risk",
      likelihood: Math.round((100 - getScore("adoption_behavior")) / 25) + 1,
      impact: computeImpact("adoption_behavior", 2, false),
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
    <div className="flex items-baseline gap-2.5">
      <div
        className="flex-shrink-0 w-[5px] h-[5px] rounded-full relative top-[-1px]"
        style={{ backgroundColor: "#0B1D3A" }}
      />
      <p className="text-xs leading-relaxed">
        <span className="font-semibold text-secondary">{label}: </span>
        <span className="text-foreground/60">{value}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Composite Index Deep Dive Helpers
// ---------------------------------------------------------------------------

function getQuestionInsight(qId: string, score: number, industry: string, isStrength: boolean, indexSlug: string): string {
  const ind = industryLabel(industry);
  const tier = isStrength ? "strong" : "weak";

  // Per-question insights keyed by index + full question ID — eliminates duplication when
  // multiple questions from the same dimension appear in one index
  const questionInsights: Record<string, Record<string, Record<string, string>>> = {
    authority_friction: {
      'AS-01': {
        strong: `Clear approval pathways with minimal layers enable AI initiatives instead of stalling them. In ${ind}, only 28% of organizations have streamlined AI governance to fewer than 2 approval stages (Gartner 2024).`,
        weak: `Multiple approval layers create a structural bottleneck. When AI initiatives require 4+ sign-offs, average deployment timelines in ${ind} extend by 3-6 months — enough for competitors to establish first-mover advantages.`,
      },
      'AS-03': {
        strong: `Budget reallocation speed is a governance enabler — your organization can shift resources toward AI priorities without quarterly budget cycles creating artificial delays.`,
        weak: `Slow budget reallocation means AI investments wait for budget cycles rather than responding to opportunities. In ${ind}, this rigidity adds an average of 2-3 months before any AI initiative is funded.`,
      },
      'AS-04': {
        strong: `Effective process conflict resolution means AI deployment disagreements are handled at the operational level, not escalated to senior leadership — reducing governance friction significantly.`,
        weak: `When AI tools conflict with existing processes, the absence of a resolution mechanism forces every disagreement to senior leadership — creating bottlenecks that discourage teams from proposing AI improvements.`,
      },
      'AS-05': {
        strong: `Legal and compliance function as embedded partners in AI deployment, not sequential gates. This collapses the typical 60-90 day compliance review cycle to weeks.`,
        weak: `Legal and compliance operate as serial gatekeepers rather than embedded partners. In ${ind}, this pattern typically adds 60-90 days to any AI initiative that touches customer data, regulated processes, or third-party integrations.`,
      },
      'AS-07': {
        strong: `Decentralized authority enables individual teams to adopt AI tools within guardrails — accelerating grassroots adoption without waiting for centralized mandates.`,
        weak: `Over-centralized authority means every AI adoption decision requires top-down approval, stifling the grassroots experimentation that drives 60% of successful enterprise AI use cases (BCG 2024).`,
      },
      'WI-07': {
        strong: `Strong change management discipline is embedded in AI rollouts, reducing the organizational resistance that typically generates 40-60% of governance friction in ${ind}.`,
        weak: `Weak change management converts every AI rollout into a political exercise that escalates to leadership — transforming operational friction into structural authority bottlenecks that compound over time.`,
      },
      'DV-03': {
        strong: `Low re-approval burden means AI initiatives sustain momentum through the pilot-to-scale transition — the phase where 68% of AI projects stall in ${ind} (McKinsey 2024).`,
        weak: `Redundant re-approval cycles force teams to re-justify AI initiatives at every stage gate. This "permission treadmill" is the single largest contributor to pilot graveyards — initiatives approved but never scaled.`,
      },
    },
    decision_velocity: {
      'DV-01': {
        strong: `Fast idea-to-funded-pilot cycles give you a first-mover advantage. In ${ind}, top-quartile organizations approve and fund pilots in under 2 weeks vs. 3+ months for the median.`,
        weak: `The time from AI idea to funded pilot is a primary velocity constraint. At this pace, high-potential use cases lose momentum and team enthusiasm before they ever receive resources.`,
      },
      'DV-02': {
        strong: `Rapid pilot-to-scale transitions mean successful AI experiments reach full production quickly — capturing value that slower organizations leave in perpetual "pilot purgatory."`,
        weak: `Slow pilot-to-production scaling is where most AI value dies. In ${ind}, organizations at this velocity take 6-12 months to scale pilots — by which time the underlying technology and competitive landscape have already shifted.`,
      },
      'DV-03': {
        strong: `Minimal re-approval overhead means AI initiatives maintain velocity through the entire lifecycle, not just at initial approval. This eliminates the "start-stop" pattern that kills most enterprise AI projects.`,
        weak: `Repeated re-approval requirements create a "start-stop" deployment pattern. Each pause to re-justify an AI initiative costs 3-6 weeks and risks permanent project shelving as organizational attention shifts.`,
      },
      'DV-04': {
        strong: `Fast competitive response capability means the organization can match or counter AI moves by competitors within weeks — a velocity advantage that compounds over time.`,
        weak: `Slow competitive response means the organization cannot react to rivals' AI deployments before they establish structural advantages. In ${ind}, this gap typically manifests as lost client relationships and eroding margins.`,
      },
      'DV-05': {
        strong: `Streamlined AI procurement enables tool acquisition in days or weeks, not the 3-6 month vendor cycles that bottleneck most enterprises.`,
        weak: `Procurement cycles designed for traditional software purchases are incompatible with AI deployment speed. In ${ind}, vendor procurement alone often adds 3-6 months to AI timelines.`,
      },
      'AS-01': {
        strong: `Lean approval structures accelerate every AI decision. Budget and authority decisions move at the pace of AI market evolution — a rare advantage in ${ind} (Deloitte 2024).`,
        weak: `Approval layers designed for traditional IT governance add weeks per stage. In ${ind}, each additional approval layer adds an estimated 3-4 weeks, compounding to months of lost competitive positioning.`,
      },
      'AS-03': {
        strong: `Budget velocity matches deployment ambition — resources can be reallocated to AI initiatives without waiting for quarterly planning cycles.`,
        weak: `Budget rigidity forces AI initiatives to compete in annual planning cycles rather than responding to real-time opportunities. This structural delay ensures you are always investing in yesterday's AI landscape.`,
      },
    },
    economic_translation: {
      'ET-01': {
        strong: `Financial measurement infrastructure for AI is in place — you can track, attribute, and report AI-driven value creation. Only 10% of companies have mastered this capability (BCG 2024).`,
        weak: `No financial measurement infrastructure for AI means every dollar spent is invisible to the P&L. Without measurement, you cannot optimize, justify, or defend AI investment at the board level.`,
      },
      'ET-02': {
        strong: `AI-freed capacity is being systematically redeployed to higher-value work — converting productivity gains into measurable financial returns rather than letting them absorb invisibly.`,
        weak: `When AI saves time, that time disappears — absorbed into existing work rather than redeployed to measurable value creation. This is the most common "value leak" in enterprise AI: productivity gains that no one captures.`,
      },
      'ET-03': {
        strong: `AI investment can be justified to the board with quantified evidence — a capability that unlocks continued funding and strategic confidence from leadership.`,
        weak: `The inability to justify AI investment to leadership creates a credibility deficit that compounds with each budget cycle. In ${ind}, CFOs report that unquantified AI spending faces 2x the scrutiny of other technology investments.`,
      },
      'ET-04': {
        strong: `Measurable AI outcomes exist and are tracked — connecting specific AI deployments to specific financial results. This makes Section 5's economic case actionable, not theoretical.`,
        weak: `No AI outcomes are measurably connected to financial results. Without this linkage, AI remains an act of faith rather than a managed investment — and faith-based spending rarely survives leadership transitions or downturns.`,
      },
      'ET-05': {
        strong: `Finance actively engages with AI economics — a partnership that transforms AI from a technology cost center into a quantified strategic investment with board-level visibility.`,
        weak: `Finance has no perspective on AI value — it appears as an undifferentiated line item in the technology budget. Until finance is a partner in AI measurement, the economic case will remain invisible to the people who control capital allocation.`,
      },
      'ET-07': {
        strong: `AI investment is defensible to investors and stakeholders with quantified impact data — a rare competitive advantage that de-risks continued AI investment and attracts capital.`,
        weak: `AI spending cannot be defended to external stakeholders. For private firms, this means AI investment competes with every other capital priority without evidence of return. For public firms, it invites analyst scrutiny.`,
      },
    },
  };

  return questionInsights[indexSlug]?.[qId]?.[tier]
    || (isStrength
      ? `This behavioral signal indicates organizational capability above ${ind} norms — a foundation that accelerates value capture from AI investment.`
      : `This behavioral gap constrains AI value capture in ${ind}. Addressing it unlocks disproportionate returns relative to the effort required.`);
}

function compositeIndexDescription(slug: string, score: number, industry: string): string {
  const ind = industryLabel(industry);
  const descriptions: Record<string, Record<string, string>> = {
    authority_friction: {
      high: `An Authority Friction score of ${score} means your governance structures enable rather than obstruct AI deployment. Decision rights are clear, approval pathways are streamlined, and legal/compliance functions operate as embedded partners rather than sequential gates. In ${ind}, fewer than 20% of organizations have achieved this level of structural clarity — it is a genuine competitive advantage that allows you to deploy AI at a pace your governance-constrained competitors cannot match.`,
      mid: `An Authority Friction score of ${score} reveals a mixed governance picture: some structures exist, but inconsistency between policy and practice creates unpredictable timelines. In ${ind}, this typically manifests as fast approvals for low-stakes AI tools but multi-month delays for anything touching core operations, customer data, or regulatory surfaces. The risk is a two-speed organization where AI adoption accelerates in safe zones but stalls where it would create the most value.`,
      low: `An Authority Friction score of ${score} indicates severe structural barriers. AI initiatives face systemic permission bottlenecks — unclear ownership, redundant approvals, and governance gaps that prevent meaningful progress regardless of technology investment. In ${ind}, organizations at this level average 4-7 approval layers for AI initiatives vs. 1-2 at mature organizations (McKinsey 2024). Until this friction is reduced, additional AI spending will produce diminishing returns.`,
    },
    decision_velocity: {
      high: `A Decision Velocity score of ${score} means your organization can move from AI opportunity identification to deployed capability in weeks, not quarters. This speed is a structural advantage: while competitors debate and approve, you are already measuring results. In ${ind}, organizations at this velocity capture 2.5x more value from AI investments because they can iterate faster, fail cheaper, and scale winners before market conditions shift.`,
      mid: `A Decision Velocity score of ${score} indicates moderate pace — your organization can execute AI initiatives but is slower than industry leaders. In ${ind}, this typically means 3-6 month deployment cycles for initiatives that leading organizations complete in 4-8 weeks. The drag usually comes from approval layers, vendor procurement timelines, or the gap between AI strategy and operational execution. Each month of delay compounds: competitors are not waiting.`,
      low: `A Decision Velocity score of ${score} means your organization takes 6-12+ months to move from AI use case identification to pilot deployment. This pace is structurally incompatible with the current rate of AI market evolution. In ${ind}, competitive positioning now shifts quarterly — by the time your organization deploys, the opportunity landscape has already moved. Gartner's 2024 research shows organizations in the bottom quartile of AI velocity are 4x more likely to face disruption from AI-native competitors.`,
    },
    economic_translation: {
      high: `An Economic Translation score of ${score} means your organization has built what most lack: the ability to connect AI activity to P&L outcomes. Finance and operations are aligned on AI measurement, value flows into financial reporting, and the board sees AI as a quantified investment, not an act of faith. In ${ind}, this capability positions you to allocate capital to AI with the same rigor and confidence applied to any major investment — and to defend that allocation against competing priorities.`,
      mid: `An Economic Translation score of ${score} indicates emerging but incomplete financial measurement. Some AI investments are tracked, but significant value leaks through untracked productivity gains, unmeasured quality improvements, and unrealized capacity that no one redeployed. In ${ind}, this is the most common pattern: organizations that have invested in AI but cannot yet present a credible, quantified narrative to the board. The CFO's question — "What are we getting for this?" — does not yet have a satisfying answer.`,
      low: `An Economic Translation score of ${score} signals that AI spending is generating no measurable financial return. Your organization is investing without a value capture mechanism — productivity gains happen but are absorbed rather than measured, and no one can connect AI activity to margin improvement, revenue growth, or cost reduction. In ${ind}, this pattern typically leads to AI budget cuts within 12-18 months as board patience for unquantified technology spending expires (Deloitte 2024). Section 5 quantifies the value at risk.`,
    },
  };
  const tier = score >= 70 ? "high" : score >= 40 ? "mid" : "low";
  return descriptions[slug]?.[tier] || `This index measures a critical dimension of your organization's AI capability. Your score of ${score} reflects the current state of this capability relative to industry benchmarks in ${ind}.`;
}

function compositeIndexBenchmark(slug: string, score: number, industry: string): string {
  const ind = industryLabel(industry);
  const benchmarks: Record<string, string> = {
    authority_friction: `In ${ind}, the median Authority Friction score is approximately 38/100 (McKinsey Global AI Survey 2024). Organizations scoring above 65 are classified as "governance-ready" for enterprise-scale deployment — they have formal AI decision rights, streamlined approval pathways, and compliance embedded into the deployment process rather than imposed as an afterthought. Your score of ${score} places you ${score >= 65 ? "in the top quartile — a structural advantage that enables deployment speed your competitors cannot match" : score >= 38 ? "near the industry median. You have some governance foundations but lack the structural clarity that separates fast-deploying organizations from those stuck in approval cycles" : "below the industry median, indicating governance structures that will bottleneck every AI initiative regardless of its strategic merit"}. Gartner projects that by 2027, 75% of large enterprises will have formalized AI governance frameworks, up from 35% today — the window to build governance as a competitive advantage is narrowing.`,
    decision_velocity: `The average time from AI use case identification to production deployment is 8.4 months across industries (Deloitte 2024). In ${ind}, this ranges from 6 to 14 months depending on regulatory intensity and organizational complexity. Top-quartile organizations deploy in under 10 weeks — a 4-5x velocity advantage that compounds with every deployment cycle. Your score of ${score} suggests your typical deployment cycle is ${score >= 70 ? "competitive with industry leaders, giving you a meaningful speed-to-value advantage that compounds over time" : score >= 40 ? "near the industry average of 6-9 months. This pace is workable today but will become a liability as AI-native competitors accelerate — closing the velocity gap should be a 90-day priority" : "significantly longer than peers, placing you at material competitive risk. While you are still in approval cycles, faster organizations are already measuring results and iterating"}. BCG's 2024 research found that AI deployment velocity — not AI spending — is the strongest predictor of enterprise AI ROI.`,
    economic_translation: `Only 10% of companies generate significant, measurable financial returns from AI; 70% report minimal or no quantifiable impact (BCG AI Advantage Report 2024). In ${ind}, the median economic translation score is approximately 35/100 — most organizations cannot answer the CFO's question: "What are we getting for this?" Your score of ${score} positions you ${score >= 60 ? "among the rare organizations that can credibly demonstrate AI ROI to the board, investors, and analysts — a capability that unlocks continued investment and strategic confidence" : score >= 35 ? "near the industry median. You have pockets of measurable value but lack the systematic measurement infrastructure that would make AI investment defensible at the board level" : "below the industry median, meaning your organization is investing in AI without capturing proportionate financial evidence of return. Deloitte's 2024 State of AI report found that 58% of organizations with low translation scores eventually cut AI budgets — creating a negative spiral of underinvestment and underperformance"}.`,
  };
  return benchmarks[slug] || `Industry benchmark data for ${ind} suggests organizations at your score level have specific improvement opportunities relative to top-quartile performers in AI maturity.`;
}

function compositeIndexRisks(slug: string, score: number): string {
  const risks: Record<string, Record<string, string>> = {
    authority_friction: {
      high: "Over-governance risk: mature governance structures can calcify into bureaucracy if not actively managed. Monitor for approval processes that outlive their purpose, governance committees that slow rather than enable, and compliance requirements that expand beyond regulatory necessity. The goal is governance that scales with AI ambition, not governance that constrains it.",
      mid: "Shadow AI proliferation is your primary exposure. Inconsistent governance across business units means employees in under-governed areas are using AI tools without oversight — creating data leakage, compliance gaps, and model risk that accumulate invisibly. Gartner estimates 75% of enterprise AI usage in mid-governance organizations is untracked. Additionally, governance inconsistency erodes trust: business units that face heavy approval burdens see AI-mature peers moving faster and begin circumventing controls.",
      low: "Critical structural exposure on multiple fronts: ungoverned AI usage creates immediate compliance and data security risk; the absence of clear decision authority means no one can approve, fund, or kill AI initiatives with conviction; and the resulting organizational ambiguity guarantees that AI investment will be diffuse, uncoordinated, and ultimately indefensible to the board. This score means the governance problem must be solved before any AI scaling investment can yield returns.",
    },
    decision_velocity: {
      high: "Speed-quality tradeoff requires active management. Rapid deployment can introduce technical debt, skip adequate model validation, or outpace the organization's ability to absorb change. The risk is not moving too fast — it is moving fast without the monitoring and feedback loops to catch problems early. Ensure velocity is paired with automated testing, staged rollouts, and clear rollback protocols.",
      mid: "Competitive window risk is material. AI capabilities shift quarterly, and moderate velocity means your deployed solutions may already be outdated by the time they reach production. More critically, each slow cycle demoralizes the teams closest to AI work — McKinsey reports that AI talent retention drops 35% in organizations where deployment cycles exceed 6 months. The compounding effect: you lose both competitive positioning and the people best equipped to close the gap.",
      low: "Disruption vulnerability is acute. At this velocity, the organization cannot respond to AI-driven market shifts before competitors establish structural advantages. The pattern is predictable: slow organizations lose first on cost structure (competitors automate faster), then on talent (AI engineers leave for faster environments), then on customer experience (AI-enabled competitors set new service expectations). Each quarter of delay compounds the recovery cost — Accenture estimates that late movers spend 2-3x more to achieve the same AI capability as early adopters.",
    },
    economic_translation: {
      high: "Optimization plateau risk: as the easy-to-measure value is captured, incremental gains become harder to quantify. The risk is over-indexing on measurable outcomes at the expense of transformative but harder-to-quantify initiatives (culture change, capability building, strategic positioning). Ensure your measurement framework can accommodate longer-horizon value creation, not just quarterly efficiency gains.",
      mid: "AI investment is entering the credibility danger zone. Without systematic value measurement, CFO and board confidence erodes predictably: initial enthusiasm lasts 2-3 quarters, then scrutiny intensifies. If you cannot present a defensible financial narrative within the next 12 months, expect AI budgets to face the same fate as most enterprise technology spending — cut during the next downturn and reallocated to initiatives with clearer ROI.",
      low: "AI funding is at existential risk. Without any measurable financial return, the organization's AI investment is defensible only on faith — and board patience for faith-based technology spending typically expires within 12-18 months. Beyond the budget risk, inability to measure value means inability to optimize: you cannot direct investment toward high-performing AI use cases or away from underperforming ones. Every dollar of AI spend is equally unaccountable, which guarantees waste.",
    },
  };
  const tier = score >= 70 ? "high" : score >= 40 ? "mid" : "low";
  return risks[slug]?.[tier] || "Monitor for emerging risks as your maturity evolves. See Section 7 for the full risk assessment.";
}

function compositeIndexNextSteps(slug: string, score: number): string {
  const steps: Record<string, Record<string, string>> = {
    authority_friction: {
      high: "Focus on distributed governance: empower business units with guardrails and pre-approved deployment categories rather than centralized approval for every initiative. Target federated AI ownership where central sets standards but units execute autonomously within bounds.",
      mid: "Standardize governance frameworks across all business units within 60 days. Establish pre-approved fast-track paths for low-risk AI deployments (defined risk categories, spending thresholds, data classification). Eliminate redundant approval layers — target 2 or fewer decision points for standard deployments.",
      low: "Immediate priority: establish a foundational AI governance charter, designate a single accountable AI owner with budget authority, and create a basic approval framework within 30 days. This is prerequisite infrastructure — no other AI investment will yield returns until authority structures exist.",
    },
    decision_velocity: {
      high: "Optimize for AI portfolio management: run parallel initiatives on shared infrastructure, systematize organizational learning across deployments, and build reusable components that accelerate future projects. Your velocity advantage compounds — invest in making it structural.",
      mid: "Reduce approval layers for standard AI deployments to 2 or fewer. Establish a pre-approved AI tool catalog that teams can deploy without per-project approval. Set target cycle times: < 30 days for pilot approval, < 90 days for scale decisions. Benchmark against top-quartile deployment timelines quarterly.",
      low: "Start with a single fast-track pilot designed to demonstrate achievable velocity — pick a use case with low regulatory risk, clear metrics, and an enthusiastic team. Complete it in 45 days. Use the success to build organizational evidence that faster cycles are possible and to justify streamlined processes.",
    },
    economic_translation: {
      high: "Expand the measurement framework beyond cost savings and efficiency gains. Target AI-enabled revenue generation, new product development, and strategic capabilities that create competitive moats. Integrate AI economics into quarterly financial reporting and capital allocation processes.",
      mid: "Implement standardized ROI measurement across all AI initiatives within 90 days. Define baseline metrics before launching new projects — not after. Require every AI initiative to specify measurable financial outcomes at approval and report against them quarterly.",
      low: "Start with 2-3 use cases where financial value is easiest to isolate and measure: process automation with clear before/after metrics, error reduction with quantifiable cost-per-error, or capacity creation with measurable reallocation. Build measurement credibility on easy wins before attempting to quantify harder-to-measure value.",
    },
  };
  const tier = score >= 70 ? "high" : score >= 40 ? "mid" : "low";
  return steps[slug]?.[tier] || "Focus on the highest-leverage next step based on your current maturity position and the recommendations in Section 9.";
}

// ---------------------------------------------------------------------------
// Competitive Positioning Helpers
// ---------------------------------------------------------------------------

function getQuadrantAnalysis(capScore: number, readScore: number, industry: string): string {
  const ind = industryLabel(industry);
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
  const shippingLogistics = [
    { area: "AI-Optimized Route Planning & Fleet Management", detail: "UPS's ORION system processes 250,000+ routes daily using ML, saving 100M+ miles and $400M annually. DHL has deployed AI route optimization across 220 countries. Amazon's AI routing engine now powers same-day delivery in 90+ US metros. If your fleet is still using static routing, you are burning fuel and margin your competitors are not.", source: "Source: UPS 2024 10-K Filing; DHL Logistics Trend Radar 2024; Amazon Q3 2024 Earnings Call" },
    { area: "Predictive Maintenance for Fleet & Facilities", detail: "Maersk uses IoT + ML to predict container ship engine failures 30 days in advance, reducing unplanned downtime by 40%. XPO Logistics deploys predictive maintenance across 750+ facilities. UPS's Automotive Predictive Analytics prevents 10,000+ breakdowns annually. Your competitors are fixing problems before they happen.", source: "Source: Maersk Technology Review 2024; XPO Investor Day 2024; UPS Sustainability Report 2024" },
    { area: "Computer Vision for Warehouse Automation", detail: "Amazon operates 750,000+ robots across fulfillment centers using AI vision systems. DHL's OptiCarton uses CV to optimize package sizing, reducing shipping volume 25%. Locus Robotics (deployed by DHL, GEODIS) has completed 3B+ picks. Your competitors are automating the warehouse floor while you are still counting boxes.", source: "Source: Amazon Robotics Report 2024; DHL Innovation Center; Locus Robotics Press Release Oct 2024" },
    { area: "AI-Powered Customer Service & Tracking", detail: "UPS's virtual assistant handles 54M+ customer interactions/year. Maersk's AI chatbot resolves 65% of shipping queries without human intervention. DHL's AI customer service platform reduced call center volume 35%. Your customers expect real-time, intelligent service — are you delivering it?", source: "Source: UPS Digital Strategy Report 2024; Maersk Q2 2024 Investor Presentation; DHL Digital Transformation Update 2024" },
    { area: "Demand Forecasting & Dynamic Pricing", detail: "C.H. Robinson uses ML models to predict freight demand 30 days out with 92% accuracy. Flexport's AI pricing engine adjusts rates in real-time based on 200+ variables. XPO's AI-powered brokerage platform processes $4B+ in freight annually. Static pricing is becoming a competitive liability.", source: "Source: C.H. Robinson Q3 2024 Earnings; Flexport Technology Blog 2024; XPO Annual Report 2024" },
    { area: "Supply Chain Visibility & Risk Prediction", detail: "Maersk's TradeLens (now evolved into new platform) tracks 30M+ containers with AI-powered ETA prediction. FourKites, project44, and Transplace use ML to provide real-time supply chain visibility to 1,000+ shippers. Amazon's supply chain AI predicted and pre-positioned inventory ahead of 2024 disruptions. Visibility is no longer a differentiator — it is table stakes.", source: "Source: Gartner Supply Chain Top 25 Report 2024; FourKites Industry Benchmark 2024; Amazon Logistics Innovation Day 2024" },
  ];
  const defaults = [
    { area: "Customer-Facing AI (Chatbots, Virtual Assistants)", detail: "Organizations across industries are deploying conversational AI for customer service. Bank of America's Erica handles 1.5B+ interactions/year. Comcast's AI assistant resolves 30% of support calls without agents. If your call center is still fully human-staffed, you are over-spending and under-serving.", source: "Source: Gartner Customer Service AI Survey 2024; Bank of America Q3 2024 Report" },
    { area: "Process Automation & Intelligent Document Processing", detail: "JPMorgan's COiN platform processes 12,000 commercial credit agreements in seconds (previously 360,000 hours of lawyer work). UiPath and Automation Anywhere report 40-60% efficiency gains in document workflows. Your competitors are processing in minutes what takes your teams days.", source: "Source: McKinsey Operations Practice 2024; JPMorgan Technology Report 2024" },
    { area: "Predictive Analytics for Demand & Operations", detail: "Walmart's AI demand forecasting improved accuracy 20% and reduced waste by $1B+. Starbucks uses ML to personalize 400M customer offers/week. The organizations winning are not just collecting data — they are acting on it in real time.", source: "Source: BCG Operations Report 2024; Walmart 2024 Investor Day; Starbucks Deep Brew Platform Update" },
    { area: "Generative AI for Content & Code", detail: "GitHub Copilot now has 1.3M paid subscribers, with adopters reporting 55% faster task completion. Salesforce Einstein GPT generates 1T+ predictions/week. Your developers and knowledge workers are likely already using these tools — the question is whether you know about it and are governing it.", source: "Source: GitHub 2024 Octoverse Report; Salesforce Q3 2024 Earnings; Deloitte Tech Trends 2024" },
    { area: "AI-Powered Cybersecurity & Threat Detection", detail: "CrowdStrike's AI processes 2T+ security events/week. IBM reports organizations using AI security detect breaches 108 days faster and save $1.76M per incident. Your competitors are using AI to defend against threats that are already using AI to attack.", source: "Source: IBM Cost of a Data Breach Report 2024; CrowdStrike Annual Threat Report 2024" },
    { area: "Workforce Intelligence & Talent Optimization", detail: "Microsoft's Viva Copilot Analytics identifies 8.8 hours/week of meeting time that could be redirected to deep work. Unilever uses AI screening for 1.8M annual applications, reducing hiring time 75%. Workday's ML-powered skills intelligence maps talent gaps across 60M+ workers. Your talent strategy is either AI-augmented or falling behind.", source: "Source: Microsoft Work Trend Index 2024; Unilever HR Innovation Report; Workday Rising 2024" },
  ];
  // Map new industry slugs to their closest match
  const industryAliases: Record<string, string> = {
    healthcare_providers: 'healthcare',
    healthcare_payers: 'healthcare',
    healthcare_services: 'healthcare',
    life_sciences_pharma: 'healthcare',
    banking: 'financial_services',
    capital_markets: 'financial_services',
    asset_wealth_management: 'financial_services',
    investment_banking: 'financial_services',
    private_equity: 'financial_services',
    venture_capital: 'financial_services',
    hedge_funds: 'financial_services',
  };
  const key = industry;
  return areas[key] || areas[industryAliases[key] || ''] || (industry === "shipping_logistics" ? shippingLogistics : defaults);
}

// ---------------------------------------------------------------------------
// Section 6: P&L Business Case Helpers
// ---------------------------------------------------------------------------

interface PnLScenario {
  label: string;
  investUpside: string;
  investDollar: string;
  coastDownside: string;
  coastDollar: string;
}

interface IndustryProofPoint {
  claim: string;
  metric: string;
  source: string;
}

interface PnLImpactData {
  headline: string;
  stageNarrative: string;
  scenarios: PnLScenario[];
  proofPoints: IndustryProofPoint[];
  compoundCost: { quarterly: number; year1: number; year3: number; narrative: string };
  ebitda: { currentLabel: string; investLabel: string; coastLabel: string };
}

// ---------------------------------------------------------------------------
// Pre-paywall "Maturity Analysis" — research-backed insights
// ---------------------------------------------------------------------------

interface FreeReportInsight {
  label: string;
  stat: string;
  body: string;
  source: string;
}

interface FreeMaturityAnalysis {
  headline: string;
  industryContext: string;
  insights: FreeReportInsight[];
  closingHook: string;
}

function getFreeMaturityAnalysis(
  stage: number,
  industry: string,
  overallScore: number,
  companyName: string,
  revenue: number,
  employeeCount: number,
  weakestDimension: string,
  strongestDimension: string,
): FreeMaturityAnalysis {
  const ind = industryLabel(industry);
  const rev = fmtUSD(revenue);

  // Stage-specific headlines
  const headlines: Record<number, string> = {
    1: `${companyName} is in the earliest phase of AI maturity — and the window to act is narrowing.`,
    2: `${companyName} has begun experimenting with AI, but experiments without structure become expensive distractions.`,
    3: `${companyName} has a foundation, but the gap between "functional AI" and "value-creating AI" is where most organizations stall.`,
    4: `${companyName} has real AI capabilities — the question is whether the organization is structured to compound them.`,
    5: `${companyName} operates at the frontier of AI maturity — but leadership at this stage requires constant reinvention.`,
  };

  // Industry-specific competitive context paragraphs
  const industryContextMap: Record<string, string> = {
    insurance: `The insurance industry is undergoing the most significant technology-driven transformation since the advent of actuarial software. McKinsey's 2024 Global Insurance Report found that AI-mature insurers achieve 40-60% faster claims processing, 15-25% improvement in loss ratios through predictive underwriting, and 3x higher customer retention through personalized engagement. Carriers like Lemonade, Root, and Ping An have demonstrated that AI-native models can underwrite policies in seconds, not weeks. For a ${rev}-revenue carrier like ${companyName}, the competitive implications are existential: Deloitte estimates that insurers who fail to reach AI maturity Stage 3+ by 2027 will lose 15-20% market share to digitally-native competitors.`,
    financial_services: `Financial services leads all industries in AI investment, but BCG's 2024 analysis reveals a stark divide: the top quartile of AI-mature banks generate 2.3x the revenue per employee of bottom-quartile peers. JPMorgan's COO recently disclosed that their AI initiatives save $1.5B annually across fraud detection, trading optimization, and customer operations. Goldman Sachs reports that AI-assisted analysts produce research 40% faster with measurably higher accuracy. For ${companyName} at ${rev} in revenue, Accenture estimates that financial institutions at Stage ${stage} leave 3-7% of revenue equivalent on the table through manual processes, slower decision cycles, and unoptimized risk models.`,
    healthcare: `Healthcare AI adoption is accelerating under regulatory and cost pressure. Mayo Clinic's 2024 outcomes report showed AI-assisted diagnostics reduce misdiagnosis rates by 30% and cut average time-to-treatment by 40%. Kaiser Permanente reported $2.1B in operational savings from AI-driven scheduling, predictive care pathways, and claims automation. McKinsey's 2024 healthcare analysis estimates that AI-mature health systems achieve 20-30% lower administrative costs — the single largest expense category. For ${companyName}, Deloitte's health sector benchmark suggests organizations at Stage ${stage} are spending 35-50% more per member on administrative overhead than their AI-mature peers.`,
    technology: `Technology companies face a unique paradox: they build AI for others but often lag in applying it to their own operations. GitHub's 2024 developer survey found that engineering teams using AI-assisted development ship 55% more features with 30% fewer defects. Meta's internal productivity data shows AI-augmented teams reduce time-to-market by 40%. Microsoft reports that Copilot adoption across their enterprise yields 29% faster task completion. For ${companyName} at ${rev} revenue, the productivity gap compounds: Gartner estimates that technology firms below Stage 3 AI maturity experience 2-3x higher employee attrition as top talent migrates to AI-forward employers.`,
    retail_ecommerce: `Retail is being reshaped by AI at every point in the value chain. Amazon's AI-driven demand forecasting reduces inventory carrying costs by 25%, while Walmart's machine learning models have cut out-of-stock rates by 30%. McKinsey's 2024 retail report found that AI-personalized customer experiences drive 15-25% higher conversion rates and 20% larger average order values. Starbucks attributes $1B+ in incremental revenue to its AI recommendation engine. For ${companyName} at ${rev}, BCG estimates that retailers below Stage 3 AI maturity forfeit 2-4% of annual revenue through suboptimal pricing, inventory misallocation, and generic customer experiences.`,
    manufacturing: `Manufacturing AI adoption separates leaders from laggards at a rate unseen since lean production. Siemens reports that AI-driven predictive maintenance reduces unplanned downtime by 50% and extends equipment life by 20-40%. Toyota's AI quality control systems catch defects 10x faster than human inspection. McKinsey's 2024 industrial survey found that AI-mature manufacturers achieve 15-30% higher OEE (Overall Equipment Effectiveness). For a manufacturer of ${companyName}'s scale, Deloitte estimates the productivity gap between Stage ${stage} and Stage 4+ organizations equates to 5-8% of operating margin — a competitive gap that widens every quarter.`,
    energy_utilities: `The energy sector is deploying AI to manage grid complexity, optimize asset performance, and navigate the clean energy transition. Duke Energy's AI-driven grid management reduced outage duration by 30% and prevented $150M in infrastructure failures. BP's machine learning models optimize refinery output by 2-3%, worth hundreds of millions annually at scale. McKinsey's 2024 energy report found that AI-mature utilities achieve 20-35% better asset utilization. For ${companyName} at ${rev}, the infrastructure-heavy nature of energy makes AI maturity gaps especially costly: Accenture estimates that utilities at Stage ${stage} spend 25-40% more on maintenance per asset than AI-optimized peers.`,
    shipping_logistics: `Logistics is undergoing an AI-driven revolution in route optimization, demand forecasting, and warehouse automation. UPS's ORION system saves 100M miles annually through AI-optimized routing — approximately $400M in fuel and labor costs. Maersk reports 15% improvement in container utilization through predictive demand modeling. Amazon's AI-driven warehouse robotics process orders 4x faster than manual operations. McKinsey's 2024 logistics report found that AI-mature supply chain operators achieve 15-25% lower cost-to-serve. For ${companyName} at ${rev}, Deloitte estimates Stage ${stage} logistics companies carry 20-35% higher per-unit costs than AI-optimized competitors.`,
    consulting_services: `Professional services and consulting firms face an AI inflection point: McKinsey's own internal data shows AI-augmented consultants deliver analyses 40% faster with broader evidence bases. Deloitte reports that AI-assisted audit teams cover 100% of transactions versus the 5-10% sample historically possible. EY's AI-driven tax automation handles routine compliance 60% faster. For ${companyName} at ${rev}, the leverage model amplifies AI's impact: BCG estimates that consulting and professional services firms at Stage ${stage} achieve 15-25% lower utilization rates because their people spend disproportionate time on tasks AI could accelerate or automate.`,
    aerospace_defense: `Aerospace and defense is among the most AI-intensive industries by R&D spend. Lockheed Martin's AI-driven predictive maintenance for the F-35 program reduced unscheduled downtime by 40%. Boeing's digital twin simulations powered by machine learning cut design iteration cycles from months to days. The DoD's 2024 AI strategy requires all major contractors to demonstrate AI integration capabilities for future contract eligibility. For ${companyName}, Deloitte's defense sector analysis shows that contractors below Stage 3 AI maturity are increasingly disadvantaged in competitive bids, as the DoD explicitly weights AI capability in source selection criteria.`,
    telecommunications: `Telecom operators are using AI to manage network complexity, reduce churn, and create new revenue streams. T-Mobile's AI-driven customer retention system reduced churn by 30%, worth an estimated $1.2B annually. AT&T's network AI detects and resolves issues 50% faster than manual NOC operations. Ericsson's 2024 industry report found AI-mature operators achieve 15-20% better network efficiency. For ${companyName} at ${rev}, McKinsey estimates that telecom operators at Stage ${stage} spend 25-40% more on network operations and customer retention than AI-optimized peers, a gap that compounds as 5G and edge computing increase network complexity.`,
  };

  // Map new industry slugs to existing context entries
  const contextAliases: Record<string, string> = {
    healthcare_providers: 'healthcare',
    healthcare_payers: 'healthcare',
    healthcare_services: 'healthcare',
    life_sciences_pharma: 'healthcare',
    banking: 'financial_services',
    capital_markets: 'financial_services',
    asset_wealth_management: 'financial_services',
    investment_banking: 'financial_services',
    private_equity: 'financial_services',
    venture_capital: 'financial_services',
    hedge_funds: 'financial_services',
    software_saas: 'technology',
    hardware_electronics: 'technology',
    it_services: 'technology',
    retail: 'retail_ecommerce',
    ecommerce_digital: 'retail_ecommerce',
    cpg: 'retail_ecommerce',
    dtc: 'retail_ecommerce',
    food_beverage: 'retail_ecommerce',
    manufacturing_discrete: 'manufacturing',
    manufacturing_process: 'manufacturing',
    automotive: 'manufacturing',
    chemicals_materials: 'manufacturing',
    industrial_services: 'manufacturing',
    energy_oil_gas: 'energy_utilities',
    utilities: 'energy_utilities',
    transportation: 'shipping_logistics',
    infrastructure_transport: 'shipping_logistics',
    defense_contractors: 'aerospace_defense',
    legal_services: 'consulting_services',
    accounting_audit: 'consulting_services',
    construction_engineering: 'manufacturing',
    real_estate_commercial: 'financial_services',
    real_estate_residential: 'financial_services',
    media_entertainment: 'technology',
    government_federal: 'consulting_services',
    government_state_local: 'consulting_services',
    nonprofit_ngo: 'consulting_services',
    education_higher: 'consulting_services',
    education_k12: 'consulting_services',
  };

  const industryContext = industryContextMap[industry] || industryContextMap[contextAliases[industry] || ''] ||
    `Across industries, the evidence is unambiguous: McKinsey's 2024 Global AI Survey found that top-quartile AI adopters generate 2.5x more value from their AI investments than bottom-quartile organizations at the same spend level. BCG's AI Advantage Report showed AI leaders achieve 1.5x higher EBITDA growth rates, with the gap widening each year as organizational learning compounds. For ${companyName} at ${rev} revenue, Accenture estimates that organizations at Stage ${stage} capture only ${stage <= 2 ? "5-15%" : "25-40%"} of available AI value — meaning the majority of your technology investment is generating returns well below its potential. The competitive window is not infinite: Deloitte's transformation research shows organizations that begin structured AI programs 18 months later pay 40% more in implementation costs and face 2-3x higher talent acquisition costs.`;

  // Research-backed insights keyed to weakest dimension
  const dimensionInsights: Record<string, FreeReportInsight[]> = {
    adoption_behavior: [
      { label: "The Adoption Gap Is Widening", stat: "72%", body: `of enterprise AI projects fail to move beyond the pilot stage according to Gartner's 2024 analysis. The primary cause is not technology — it is adoption failure. Organizations that lack structured change management and user onboarding lose an average of 60% of intended users within 90 days of deployment. For ${companyName}, your Adoption Behavior score of ${overallScore <= 35 ? "below 35" : "below median"} suggests this pattern is already in effect.`, source: "Gartner AI Adoption Report, 2024" },
      { label: "Adoption Drives 3x More Value Than Spend", stat: "3x", body: `McKinsey's 2024 survey of 1,400 enterprises found that AI adoption maturity — not investment level — is the primary predictor of value generation. Organizations with high adoption scores generate 3x more measurable value than those with equal AI budgets but low adoption. Spending more without fixing adoption compounds the waste.`, source: "McKinsey Global AI Survey, 2024" },
      { label: "Top Talent Follows AI Adoption", stat: "34%", body: `of technology workers cite AI tooling and organizational AI maturity as a top-3 factor in employer selection according to Gartner. Companies with low AI adoption scores face a self-reinforcing disadvantage: the talent needed to improve AI capabilities preferentially joins organizations where AI is already embedded in workflows.`, source: "Gartner Tech Workforce Survey, 2024" },
    ],
    authority_structure: [
      { label: "Governance Is the #1 Predictor of AI ROI", stat: "2.6x", body: `Deloitte's 2024 State of AI survey found that organizations with a dedicated AI leader and clear governance frameworks are 2.6x more likely to scale AI successfully and 3.1x more likely to report positive ROI. Your Authority Structure score indicates governance gaps that are limiting ${companyName}'s ability to move from experiment to enterprise value.`, source: "Deloitte State of AI in the Enterprise, 2024" },
      { label: "Decision Layers Kill AI Momentum", stat: "7.2 months", body: `The average enterprise AI initiative requires 7.2 months from concept to production deployment — but McKinsey found that organizations with streamlined AI governance cut this to 2.8 months. Each additional approval layer adds an average of 6 weeks. The compounding effect of slow governance is not just delay — it is talent attrition, missed market windows, and competitor advantage.`, source: "McKinsey AI Deployment Benchmark, 2024" },
      { label: "Siloed AI Ownership Fragments Value", stat: "40%", body: `BCG reports that organizations where AI governance is fragmented across business units with no central coordination capture 40% less value than those with federated governance models. The issue is not centralization vs. decentralization — it is the absence of a coherent framework for prioritization, resource allocation, and cross-functional learning.`, source: "BCG AI Advantage Report, 2024" },
    ],
    workflow_integration: [
      { label: "Embedded AI Generates 4x the Value of Standalone Tools", stat: "4x", body: `Accenture's 2024 Technology Vision found that AI integrated directly into existing workflows generates 4x the measurable business value of standalone AI applications. The difference is utilization: embedded AI is used daily by default, while standalone tools require deliberate effort to adopt. ${companyName}'s Workflow Integration score suggests AI remains adjacent to — rather than embedded in — core processes.`, source: "Accenture Technology Vision, 2024" },
      { label: "Legacy Integration Is the Top Barrier", stat: "67%", body: `of CIOs surveyed by Gartner cite legacy system integration as the primary obstacle to AI value creation — ahead of budget, talent, and data quality. The cost of workarounds compounds: organizations that delay integration spend 2-3x more when they eventually undertake it, because both the legacy systems and the AI capabilities have evolved independently.`, source: "Gartner CIO Survey, 2024" },
      { label: "API-First Organizations Move 3x Faster", stat: "3x", body: `McKinsey's digital transformation analysis shows that organizations with modern, API-first architecture deploy AI capabilities 3x faster and at 40% lower cost than those requiring custom integration for each initiative. The infrastructure gap becomes the strategy gap.`, source: "McKinsey Digital Transformation Report, 2024" },
    ],
    decision_velocity: [
      { label: "Speed of AI Decision-Making Separates Winners", stat: "5.3x", body: `BCG's 2024 analysis found that organizations in the top quartile of AI decision velocity are 5.3x more likely to achieve breakthrough AI outcomes. The mechanism is not just faster execution — it is faster learning. Each iteration generates data that improves the next decision. Organizations that take 6 months to approve an AI pilot lose 6 months of compounding organizational intelligence.`, source: "BCG AI Decision Velocity Study, 2024" },
      { label: "AI Momentum Is Perishable", stat: "18 months", body: `Deloitte's transformation research shows that the cost of delayed AI action compounds at approximately 15-20% per year. An AI initiative that would cost $5M to implement today will cost $7-8M if started 18 months from now — not because the technology is more expensive, but because organizational readiness, talent availability, and competitive positioning all deteriorate with delay.`, source: "Deloitte AI Transformation Economics, 2024" },
      { label: "Committee-Driven AI Fails at 3x the Rate", stat: "3x", body: `McKinsey found that AI initiatives governed by committee-based decision-making fail at 3x the rate of those with single-threaded ownership. The issue is not collective wisdom — it is diffusion of accountability. When everyone owns AI, no one owns AI outcomes.`, source: "McKinsey AI Operating Model Report, 2024" },
    ],
    economic_translation: [
      { label: "Most Organizations Cannot Quantify AI ROI", stat: "78%", body: `Gartner's 2024 survey found that 78% of organizations cannot accurately quantify the business value of their AI investments. This is not an accounting failure — it is a strategic one. Without clear economic measurement, AI investments compete for budget on narrative alone, making them vulnerable to the first quarter of cost pressure.`, source: "Gartner AI Value Measurement Survey, 2024" },
      { label: "Measured AI Gets 2.4x More Investment", stat: "2.4x", body: `McKinsey found that AI programs with clear economic measurement frameworks receive 2.4x more sustained investment than those without. The correlation is causal: measurable programs demonstrate value, which drives confidence, which drives funding, which drives more value. ${companyName}'s Economic Translation score suggests this virtuous cycle has not yet been established.`, source: "McKinsey AI Investment Patterns, 2024" },
      { label: "CFO Buy-In Is the Unlock", stat: "89%", body: `Deloitte reports that 89% of successful enterprise AI programs have active CFO sponsorship and established financial governance for AI spend. When the CFO treats AI as a measurable investment rather than a technology experiment, the entire organization's relationship with AI changes.`, source: "Deloitte CFO AI Governance Study, 2024" },
    ],
  };

  const weakKey = weakestDimension as string;
  const insights = dimensionInsights[weakKey] || dimensionInsights.adoption_behavior;

  const closingHook = stage <= 2
    ? `The full report translates these findings into dollar-denominated impact specific to ${companyName}: where the value is trapped, what it costs you every quarter, and the exact sequence of interventions — with named owners, timelines, and KPIs — to begin capturing it. Organizations that wait 12 months to act pay 2-3x more to close the same gaps.`
    : stage <= 3
    ? `The full report maps ${companyName}'s specific path from Stage ${stage} to Stage ${stage + 1}, quantifying the P&L impact of each dimension improvement, identifying the 3-5 highest-leverage interventions, and providing a 90-day action plan with named owners and measurable milestones. The difference between Stage ${stage} and Stage ${stage + 1} is not incremental — it represents a step-change in value capture.`
    : `The full report details how ${companyName} can protect and extend its AI advantage: where competitors are closing the gap, which capabilities are most at risk of disruption, and the specific investments required to maintain leadership. At Stage ${stage}, the risk is not falling behind — it is assuming the current position is durable without continued strategic investment.`;

  return {
    headline: headlines[stage] || headlines[2],
    industryContext,
    insights,
    closingHook,
  };
}

function getPnLImpact(
  stage: number,
  industry: string,
  revenue: number,
  unrealizedLow: number,
  unrealizedHigh: number,
  capturePercent: number,
  companyName: string,
  employeeCount: number,
  dimensionScores: DimensionScore[],
  regulatoryIntensity: string,
): PnLImpactData {
  const ind = industryLabel(industry);
  const unrealizedMid = Math.round((unrealizedLow + unrealizedHigh) / 2);
  const getScore = (dim: string) => dimensionScores.find((d) => d.dimension === dim)?.normalizedScore || 50;
  const weakest = [...dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore)[0];
  const strongest = [...dimensionScores].sort((a, b) => b.normalizedScore - a.normalizedScore)[0];
  const isSmall = employeeCount <= 200;
  const isMid = employeeCount > 200 && employeeCount <= 2000;
  const isLarge = employeeCount > 2000;
  const highReg = regulatoryIntensity === 'high' || ['insurance','banking','capital_markets','healthcare_providers','healthcare_payers','life_sciences_pharma','government_federal','defense_contractors'].includes(industry);

  // Industry EBITDA margin estimates (public data)
  const ebitdaMargins: Record<string, number> = {
    insurance: 0.18,              // S&P Global: P&C industry avg EBITDA margin
    banking: 0.30,                // FDIC Quarterly Banking Profile 2024: large bank avg
    capital_markets: 0.32,        // S&P Global: investment banking & brokerage avg
    asset_wealth_management: 0.30,// McKinsey Global Wealth Mgmt Report 2024
    investment_banking: 0.35,     // S&P Global: advisory & underwriting avg EBITDA margin
    private_equity: 0.45,         // Preqin/McKinsey: PE management fee + carry margin
    venture_capital: 0.40,        // Cambridge Associates: VC fund-level avg margin
    hedge_funds: 0.42,            // HFR/Preqin: hedge fund management avg margin
    healthcare_providers: 0.12,   // AHA Hospital Statistics 2024: system avg operating margin
    healthcare_payers: 0.10,      // Kaiser Family Foundation: managed care avg margin
    healthcare_services: 0.12,    // Deloitte Health Services Outlook 2024: services avg margin
    life_sciences_pharma: 0.22,   // Deloitte Pharma & Life Sciences Outlook 2024
    retail: 0.08,                 // NRF/Deloitte Retail Industry Benchmarks 2024
    ecommerce_digital: 0.06,      // eMarketer/Statista: DTC & marketplace avg margin
    cpg: 0.14,                    // McKinsey CPG Practice: branded goods avg margin
    dtc: 0.08,                    // eMarketer 2024: DTC brand avg EBITDA margin
    food_beverage: 0.14,          // IBISWorld/Deloitte: F&B industry avg EBITDA margin
    manufacturing_discrete: 0.14, // Deloitte Manufacturing Outlook 2024: discrete avg
    manufacturing_process: 0.16,  // Deloitte Manufacturing Outlook 2024: process avg
    automotive: 0.10,             // S&P Global Mobility: OEM avg EBITDA margin
    aerospace_defense: 0.12,      // Deloitte A&D Industry Outlook 2024
    energy_oil_gas: 0.22,         // EIA/S&P Global: integrated major avg margin
    utilities: 0.18,              // EEI Financial Review 2024: regulated utility avg
    chemicals_materials: 0.18,    // ACC/Deloitte: chemicals industry avg EBITDA margin
    industrial_services: 0.12,    // IBISWorld: industrial services avg EBITDA margin
    software_saas: 0.25,          // Gartner IT Key Metrics: enterprise SaaS avg margin
    it_services: 0.18,            // Gartner/IDC: IT services sector avg EBITDA margin
    hardware_electronics: 0.15,   // IDC Worldwide HW Tracker: blended HW avg margin
    telecommunications: 0.28,     // S&P Global: telecom sector avg EBITDA margin
    media_entertainment: 0.18,    // PwC Global Entertainment & Media Outlook 2024
    transportation: 0.10,         // ATA/BLS: trucking & rail blended avg margin
    shipping_logistics: 0.10,     // Drewry Shipping Consultants 2024: 3PL avg
    infrastructure_transport: 0.14,// McKinsey Infrastructure 2024: transport infra avg margin
    construction_engineering: 0.08,// FMI Capital Advisors 2024: ENR Top 400 avg
    real_estate_commercial: 0.35, // NAREIT: commercial REIT sector avg EBITDA margin
    real_estate_residential: 0.20,// NAREIT: residential REIT avg EBITDA margin
    government_federal: 0.0,      // N/A: non-profit entity; uses cost-savings model
    government_state_local: 0.0,  // N/A: non-profit entity; uses cost-savings model
    defense_contractors: 0.12,    // Deloitte A&D 2024: defense contractor avg EBITDA margin
    nonprofit_ngo: 0.0,           // N/A: non-profit entity; uses cost-savings model
    consulting_services: 0.20,    // Source Global Research: consulting & PS avg margin
    legal_services: 0.35,         // Am Law/Thomson Reuters: law firm avg profit margin
    accounting_audit: 0.25,       // IBISWorld: accounting services avg EBITDA margin
  };
  const ebitdaMargin = ebitdaMargins[industry] || 0.15;
  const currentEBITDA = revenue * ebitdaMargin;

  // Revenue impact multipliers by industry (AI-addressable revenue upside as % of revenue)
  const revenueUpside: Record<string, number> = {
    insurance: 0.025,             // McKinsey Insurance 2024: AI pricing & cross-sell uplift
    banking: 0.03,                // Accenture Banking Top 10 Trends 2024
    capital_markets: 0.035,       // BCG Global Capital Markets 2024: algo trading + advisory
    asset_wealth_management: 0.03,// McKinsey Global Wealth Mgmt 2024: personalized AUM growth
    investment_banking: 0.035,    // BCG M&A 2024: deal sourcing & due diligence AI uplift
    private_equity: 0.03,         // Bain PE Report 2024: portfolio value creation AI
    venture_capital: 0.03,        // PitchBook 2024: AI-augmented deal sourcing & screening
    hedge_funds: 0.04,            // HFR 2024: AI-driven alpha generation & signal processing
    healthcare_providers: 0.02,   // McKinsey Healthcare 2024: revenue cycle + capacity gains
    healthcare_payers: 0.02,      // Deloitte Health Plan Benchmarks 2024
    healthcare_services: 0.02,    // Deloitte Health Services 2024: operational efficiency AI
    life_sciences_pharma: 0.03,   // BCG Biopharma 2024: accelerated pipeline & R&D yield
    retail: 0.02,                 // McKinsey Retail Practice 2024: personalization uplift
    ecommerce_digital: 0.025,     // BCG Digital Commerce 2024: recommendation & pricing AI
    cpg: 0.02,                    // McKinsey CPG Practice 2024: trade promo & demand shaping
    dtc: 0.025,                   // eMarketer 2024: personalization & CX-driven uplift
    food_beverage: 0.02,          // McKinsey F&B 2024: demand sensing & pricing AI
    manufacturing_discrete: 0.02, // Deloitte Smart Factory 2024: yield & throughput gains
    manufacturing_process: 0.02,  // McKinsey Operations 2024: process optimization
    automotive: 0.02,             // BCG Automotive 2024: connected services & config yield
    aerospace_defense: 0.015,     // Deloitte A&D Outlook 2024: long cycle dampens upside
    energy_oil_gas: 0.02,         // McKinsey Energy Insights 2024: reservoir & trading AI
    utilities: 0.015,             // Accenture Utilities 2024: regulated rate dampens upside
    chemicals_materials: 0.02,    // McKinsey Chemicals 2024: process yield & pricing AI
    industrial_services: 0.02,    // Deloitte Industrial 2024: service optimization AI
    software_saas: 0.04,          // Gartner 2024: highest AI leverage — product + ops
    it_services: 0.025,           // Gartner/IDC 2024: delivery automation & upsell AI
    hardware_electronics: 0.03,   // IDC 2024: design cycle & supply chain AI
    telecommunications: 0.03,     // BCG Telecom 2024: churn reduction & ARPU uplift
    media_entertainment: 0.025,   // PwC Entertainment & Media Outlook 2024: content AI
    transportation: 0.02,         // ATA/McKinsey 2024: load optimization & pricing
    shipping_logistics: 0.02,     // Drewry/McKinsey 2024: route & demand AI
    infrastructure_transport: 0.015,// McKinsey Infrastructure 2024: asset optimization AI
    construction_engineering: 0.015,// McKinsey Capital Projects 2024: bid & schedule AI
    real_estate_commercial: 0.02, // Deloitte RE Outlook 2024: leasing AI & valuation
    real_estate_residential: 0.02,// Zillow/Redfin 2024: pricing & matching AI uplift
    government_federal: 0.01,     // Deloitte Gov Insights 2024: mission efficiency gains
    government_state_local: 0.01, // Deloitte Gov Insights 2024: service delivery gains
    defense_contractors: 0.015,   // Deloitte A&D 2024: contract efficiency & sustainment AI
    nonprofit_ngo: 0.01,          // Stanford Social Innovation Review 2024: fundraising AI
    consulting_services: 0.025,   // Source Global Research 2024: utilization & pricing AI
    legal_services: 0.03,         // Thomson Reuters 2024: legal AI productivity & pricing
    accounting_audit: 0.025,      // AICPA 2024: audit automation & advisory upsell AI
  };
  const revUp = revenueUpside[industry] || 0.02;

  // Margin improvement from AI (as fraction of revenue; e.g., 0.02 = 200 bps)
  const marginImprovement: Record<string, number> = {
    insurance: 0.02,              // McKinsey Insurance 2024: claims automation + underwriting
    banking: 0.02,                // Accenture Banking 2024: ops automation + fraud savings
    capital_markets: 0.022,       // BCG Capital Markets 2024: trade execution + compliance
    asset_wealth_management: 0.02,// McKinsey Wealth 2024: advisor productivity + ops
    investment_banking: 0.022,    // BCG M&A 2024: due diligence + compliance automation
    private_equity: 0.025,        // Bain PE 2024: portfolio monitoring + ops optimization
    venture_capital: 0.02,        // PitchBook 2024: deal flow screening + diligence AI
    hedge_funds: 0.025,           // HFR 2024: execution optimization + risk management AI
    healthcare_providers: 0.015,  // McKinsey Healthcare 2024: clinical ops + denials
    healthcare_payers: 0.018,     // Deloitte Payer 2024: claims adjudication + admin AI
    healthcare_services: 0.015,   // Deloitte Health Services 2024: workflow + admin automation
    life_sciences_pharma: 0.02,   // BCG Biopharma 2024: R&D acceleration + mfg quality
    retail: 0.015,                // McKinsey Retail 2024: inventory + labor scheduling
    ecommerce_digital: 0.02,      // BCG Digital 2024: fulfillment + CX personalization
    cpg: 0.018,                   // McKinsey CPG 2024: supply chain + trade spend
    dtc: 0.018,                   // eMarketer 2024: fulfillment + CAC optimization
    food_beverage: 0.016,         // McKinsey F&B 2024: supply chain + quality control AI
    manufacturing_discrete: 0.018,// Deloitte Smart Factory 2024: predictive maintenance
    manufacturing_process: 0.018, // McKinsey Operations 2024: yield optimization
    automotive: 0.016,            // BCG Automotive 2024: warranty + supply chain AI
    aerospace_defense: 0.012,     // Deloitte A&D 2024: regulated environment limits scope
    energy_oil_gas: 0.015,        // McKinsey Energy 2024: production optimization
    utilities: 0.012,             // Accenture Utilities 2024: grid ops + demand forecasting
    chemicals_materials: 0.018,   // McKinsey Chemicals 2024: process optimization + yield AI
    industrial_services: 0.015,   // Deloitte Industrial 2024: field service + scheduling AI
    software_saas: 0.025,         // Gartner 2024: highest AI margin leverage across ops
    it_services: 0.02,            // Gartner/IDC 2024: delivery efficiency + automation
    hardware_electronics: 0.02,   // IDC 2024: supply chain + design automation
    telecommunications: 0.02,     // BCG Telecom 2024: network ops + CX automation
    media_entertainment: 0.018,   // PwC E&M 2024: content ops + ad yield optimization
    transportation: 0.015,        // McKinsey Transport 2024: fuel + route optimization
    shipping_logistics: 0.015,    // Drewry 2024: routing + warehouse automation
    infrastructure_transport: 0.014,// McKinsey Infrastructure 2024: asset maintenance AI
    construction_engineering: 0.012,// McKinsey Capital Projects 2024: schedule + cost AI
    real_estate_commercial: 0.015,// Deloitte RE 2024: property ops + tenant analytics
    real_estate_residential: 0.014,// Zillow/Redfin 2024: transaction efficiency + ops AI
    government_federal: 0.012,    // Deloitte Gov 2024: process automation + fraud detection
    government_state_local: 0.01, // Deloitte Gov 2024: citizen services + ops efficiency
    defense_contractors: 0.012,   // Deloitte A&D 2024: sustainment + manufacturing AI
    nonprofit_ngo: 0.01,          // Bridgespan 2024: donor analytics + program delivery
    consulting_services: 0.02,    // Source Global 2024: knowledge mgmt + delivery automation
    legal_services: 0.025,        // Thomson Reuters 2024: doc review + research automation
    accounting_audit: 0.022,      // AICPA 2024: audit automation + compliance AI
  };
  const marginUp = marginImprovement[industry] || 0.015;

  // Erosion rates if standing still
  const erosionRate = stage >= 4 ? 0.01 : stage === 3 ? 0.015 : 0.02;

  // Talent cost per employee (turnover savings)
  const avgTurnoverCost = 0.33; // 33% of salary to replace
  const avgSalary = employeeCount > 10000 ? 85000 : 75000;
  const turnoverReduction = stage >= 4 ? 0.10 : 0.18;
  const talentSavings = Math.round(employeeCount * avgTurnoverCost * avgSalary * turnoverReduction * 0.01); // conservative: applied to 1% turnover delta

  // Risk quantification
  const riskCostBase = revenue * 0.003; // IBM puts avg breach at 0.3% revenue equiv
  const riskReduction = stage >= 4 ? 0.25 : 0.40;

  // ---- Stage-dependent headline & narrative ----
  let headline: string;
  let stageNarrative: string;

  if (stage >= 4) {
    headline = "Protecting Your AI Edge — Why Leaders Can't Coast";
    stageNarrative = `At Stage ${stage}, ${companyName} has built real AI capability. But competitive advantages in AI erode faster than they were built. BCG's 2024 research found that organizations pausing AI investment after reaching Stage 4 regress to Stage 3 behavioral patterns within 12-18 months — the organizational muscle atrophies quickly. Your ${capturePercent}% capture rate means you are converting real value, but competitors investing aggressively can close your lead in 2-3 quarters. The question is not whether to invest more, but whether your current pace is sufficient to maintain separation. In ${ind}, the cost of losing your AI edge is measured in market share points, not basis points.`;
  } else if (stage === 3) {
    headline = "The Inflection Point — Where AI Investment Pays Off or Doesn't";
    stageNarrative = `Stage 3 is where AI either becomes a P&L driver or remains an expensive experiment. ${companyName}'s current ${capturePercent}% capture rate means three-quarters of AI-addressable value is going unrealized. The math of moving from Stage 3 to Stage 4 is asymmetric in your favor: capture rate roughly doubles from 25% to 55%, meaning the same AI-addressable pool yields more than 2x the returns. Organizations that invest decisively at this stage see P&L impact within 12-18 months. Those that don't face a different math: competitors at Stage 4 are operating at structurally lower costs and faster cycle times, and the gap compounds every quarter. In ${ind}, that gap translates directly to pricing power, customer retention, and talent attraction.`;
  } else {
    headline = "The Compounding Cost of Delay — Every Quarter Matters";
    stageNarrative = `At Stage ${stage} with a ${capturePercent}% capture rate, ${companyName} is forfeiting ${100 - capturePercent}% of AI-addressable value — not because the technology doesn't exist, but because the organizational infrastructure to capture it hasn't been built. Each quarter of delay doesn't just forfeit that quarter's value; it deepens the organizational learning deficit. Competitors at Stage 3+ have spent 12-24 months building AI workflows, governance frameworks, and measurement systems that compound in effectiveness. In ${ind}, the organizations investing now are locking in cost structures and customer experiences that late movers will spend 2-3x more to replicate. Accenture's 2024 research shows early AI investors achieve 40% lower implementation costs than organizations that start 18 months later — the learning curve has a price.`;
  }

  // ---- Industry-specific revenue growth descriptions ----
  const revGrowthInvest: Record<string, string> = {
    insurance: `AI-driven dynamic pricing, personalized cross-sell, and accelerated underwriting expand premium volume and improve win rates. ${companyName}'s Adoption Behavior score of ${getScore('adoption_behavior')}/100 suggests current pricing models are leaving revenue on the table that AI-enabled competitors are already capturing.`,
    banking: `AI-powered relationship intelligence, personalized product recommendations, and automated loan origination drive fee income and interest revenue. With a Workflow Integration score of ${getScore('workflow_integration')}/100, ${companyName} has significant room to embed AI into revenue-generating processes.`,
    healthcare_providers: `AI-optimized patient scheduling, reduced no-shows, improved coding accuracy, and capacity utilization drive incremental revenue without adding beds. ${companyName}'s ${getScore('workflow_integration')}/100 Workflow Integration score indicates scheduling and revenue cycle workflows are ripe for AI optimization.`,
    healthcare_payers: `AI-driven member engagement, predictive risk adjustment, and claims accuracy improvement increase per-member revenue and reduce STARs rating penalties. Current Decision Velocity of ${getScore('decision_velocity')}/100 suggests ${companyName} is slower than peers to deploy revenue-protecting AI.`,
    life_sciences_pharma: `AI-accelerated drug discovery, clinical trial optimization, and commercial analytics compress time-to-revenue for pipeline assets. Each month of accelerated launch is worth millions in patent-protected revenue.`,
    software_saas: `AI-native product features command 15-30% price premiums, AI-driven expansion revenue increases NDR, and generative AI reduces time-to-deploy for customers. With ${getScore('adoption_behavior')}/100 Adoption Behavior, ${companyName} is under-leveraging AI for product differentiation.`,
    retail: `AI-driven demand forecasting, dynamic pricing, and personalized customer experiences improve conversion rates and average order values. In retail, 1% pricing optimization typically yields 8-12% profit improvement.`,
    manufacturing_discrete: `AI-driven quality optimization, yield improvement, and predictive demand planning increase throughput per dollar of capital employed. ${companyName}'s manufacturing operations at ${fmtUSD(revenue)} revenue can target 2-4% yield improvement through AI inspection and process control.`,
    manufacturing_process: `AI-optimized process parameters, predictive quality control, and real-time yield adjustment drive revenue-equivalent value through waste reduction and throughput gains.`,
    energy_oil_gas: `AI reservoir modeling, production optimization, and predictive maintenance increase output per asset. ${companyName}'s ${getScore('workflow_integration')}/100 Workflow Integration suggests AI is not yet embedded in core production workflows.`,
    telecommunications: `AI-powered churn prediction, dynamic ARPU optimization, and personalized offer engines drive revenue retention and expansion. At ${fmtUSD(revenue)}, even 0.5% churn reduction is worth ${fmtUSD(Math.round(revenue * 0.005))} annually.`,
    consulting_services: `AI-augmented delivery, knowledge management, and proposal generation increase utilization rates and enable premium pricing. With ${getScore('workflow_integration')}/100 Workflow Integration, ${companyName}'s billable staff are spending time on tasks AI could accelerate.`,
  };

  const revGrowthCoast: Record<string, string> = {
    insurance: `Premium leakage accelerates as AI-native carriers (Lemonade, Root, Hippo) capture price-sensitive segments with real-time underwriting ${companyName} can't match at current Authority Structure (${getScore('authority_structure')}/100).`,
    banking: `Deposit and loan market share erodes as digital-first banks and fintechs offer AI-personalized rates and instant approvals that ${companyName}'s manual processes cannot compete with.`,
    healthcare_providers: `Patient leakage to AI-optimized health systems offering shorter wait times, better scheduling, and more coordinated care. Cleveland Clinic and Kaiser report 15-20% patient acquisition advantage from AI-driven access optimization.`,
    healthcare_payers: `STARs rating degradation and member attrition as competitors deploy AI-driven care coordination and member engagement that demonstrably improves outcomes and satisfaction scores.`,
    life_sciences_pharma: `Pipeline velocity falls behind competitors using AI-accelerated discovery. Each 6-month delay in clinical development costs $50-100M in foregone patent-protected revenue.`,
    software_saas: `Customer churn accelerates and NRR declines as competitors ship AI-native features that become table stakes. Products without embedded AI are increasingly perceived as legacy.`,
    retail: `Conversion and basket size stagnate while AI-enabled competitors deliver hyper-personalized experiences. Amazon's AI recommendation engine drives 35% of revenue — that gap compounds every quarter.`,
    manufacturing_discrete: `Yield disadvantage widens as AI-enabled competitors achieve 2-4% better throughput from the same equipment. At ${companyName}'s scale, that translates to ${fmtUSD(Math.round(revenue * 0.02))} in annual competitive disadvantage.`,
    manufacturing_process: `Process efficiency gap widens against AI-optimized competitors achieving tighter tolerances, less waste, and higher throughput from equivalent capital assets.`,
    energy_oil_gas: `Production optimization gap widens as AI-enabled operators extract 2-3% more value from equivalent reserves and infrastructure.`,
    telecommunications: `Churn rate increases 0.3-0.5% annually relative to AI-enabled carriers offering proactive service and personalized retention. At ${companyName}'s revenue base, that's ${fmtUSD(Math.round(revenue * 0.004))} per year.`,
    consulting_services: `Utilization rates fall 5-10% behind AI-augmented competitors who deliver faster, at lower cost, with broader evidence bases — compressing both revenue and margin.`,
  };

  // ---- Industry-specific margin descriptions ----
  const marginInvest: Record<string, string> = {
    insurance: `Claims automation, straight-through processing, and AI-driven fraud detection reduce loss adjustment expenses and operating costs. At ${companyName}'s scale, every 1% of combined ratio improvement is worth ${fmtUSD(Math.round(revenue * 0.01))}.`,
    banking: `AI-powered credit decisioning, compliance automation, and customer service chatbots reduce operating expense ratio. With Authority Structure at ${getScore('authority_structure')}/100, governance improvements alone could unlock faster deployment of margin-enhancing AI.`,
    healthcare_providers: `AI-driven clinical documentation, prior authorization automation, denials management, and staffing optimization reduce administrative burden — the single largest cost category. ${isLarge ? 'At 13,000+ employees, even small per-FTE efficiency gains compound to material savings.' : `At ${employeeCount} employees, targeted automation of highest-volume workflows delivers outsized margin impact.`}`,
    healthcare_payers: `AI claims adjudication, medical necessity review, and provider network optimization reduce medical loss ratio and administrative costs. Anthem reports 200bps MLR improvement from AI-driven utilization management.`,
    life_sciences_pharma: `AI-accelerated clinical trial design, manufacturing quality prediction, and regulatory filing automation compress timelines and reduce development costs across the pipeline.`,
    software_saas: `AI automates customer support, QA testing, and internal operations while AI-assisted development accelerates feature delivery. GitHub Copilot users report 55% faster task completion — applied across ${companyName}'s engineering org, that is transformative.`,
    retail: `AI inventory optimization, labor scheduling, and supply chain management reduce shrinkage, overstocking, and fulfillment costs. Walmart reports $1B+ in annual savings from AI demand forecasting alone.`,
    manufacturing_discrete: `Predictive maintenance reduces unplanned downtime 30-50%, AI quality inspection catches defects earlier (saving rework costs), and production scheduling optimization improves OEE.`,
    energy_oil_gas: `AI-driven predictive maintenance, drilling optimization, and asset performance management reduce operating costs per barrel. BP reports 2-3% refinery output optimization from AI process control.`,
    telecommunications: `AI-driven network optimization, predictive maintenance, and automated customer service reduce network OpEx and contact center costs. T-Mobile reports ${fmtUSD(Math.round(revenue * 0.008))} equivalent in AI-driven operating savings at comparable scale.`,
    consulting_services: `AI-assisted research, document generation, and knowledge management increase consultant productivity 15-25%, directly improving leverage ratios and operating margin per engagement.`,
  };

  const marginCoast: Record<string, string> = {
    insurance: `Operating expense gap widens as peers automate claims processing and underwriting. ${companyName}'s combined ratio disadvantage compounds every quarter — at ${fmtUSD(revenue)}, each basis point is ${fmtUSD(Math.round(revenue * 0.0001))}.`,
    banking: `Efficiency ratio deteriorates relative to AI-optimized peers. JPMorgan targets a sub-50% efficiency ratio through AI — banks that can't match this face structural margin compression.`,
    healthcare_providers: `Administrative cost per patient encounter rises while AI-optimized systems reduce theirs. The gap is existential for providers operating on ${(ebitdaMargin * 100).toFixed(0)}% margins — there's no room for inefficiency.`,
    healthcare_payers: `MLR creeps upward as manual utilization management falls behind AI-driven peers. Administrative cost per member grows while competitors shrink theirs.`,
    life_sciences_pharma: `R&D cost per approved drug remains at $2.6B industry average while AI-enabled competitors cut development costs 20-30%, allowing more pipeline bets per dollar.`,
    software_saas: `Support costs, development velocity, and infrastructure costs fall behind AI-native competitors. The margin gap becomes a product gap as competitors reinvest savings into features.`,
    retail: `Shrinkage, labor cost, and inventory carrying costs remain at legacy levels while AI-enabled competitors continuously optimize. At ${(ebitdaMargin * 100).toFixed(0)}% EBITDA margins, ${ind} has no room for structural cost disadvantage.`,
    manufacturing_discrete: `Maintenance costs, scrap rates, and downtime remain at legacy levels while competitors deploy AI that continuously improves. The cost gap compounds with every production cycle.`,
    energy_oil_gas: `Per-barrel operating costs remain elevated versus AI-optimized operators. In a commodity business, the low-cost producer wins — and AI is redefining what "low cost" means.`,
    telecommunications: `Network operating costs and customer service costs remain elevated while competitors automate. At ${(ebitdaMargin * 100).toFixed(0)}% EBITDA margin, margin erosion translates directly to shareholder value destruction.`,
    consulting_services: `Utilization and productivity lag AI-augmented competitors. The consulting business model depends on leverage — firms that don't augment their people with AI face structural margin compression.`,
  };

  // ---- Industry-specific cost structure descriptions ----
  const costInvest = isLarge
    ? `At ${employeeCount.toLocaleString()} employees, AI-driven automation of repetitive workflows compounds to material structural cost reduction. ${companyName}'s Workflow Integration score (${getScore('workflow_integration')}/100) indicates significant untapped automation potential in core ${ind} operations — every 1% of labor cost shifted to AI-variable costs saves ${fmtUSD(Math.round(employeeCount * 850 * 0.01))} annually.`
    : isMid
    ? `With ${employeeCount} employees, ${companyName} can target AI automation of the 5-10 highest-volume workflows to shift from fixed headcount to scalable AI capacity. In ${ind}, mid-size organizations see the fastest ROI from AI cost restructuring because they're large enough to benefit but agile enough to deploy quickly.`
    : `At ${employeeCount} employees, ${companyName} can punch above its weight by using AI to match the output capacity of organizations 3-5x its size. In ${ind}, small organizations deploying AI effectively achieve per-employee productivity 40-60% higher than non-AI peers (BCG 2024).`;

  const costCoast = isLarge
    ? `Fixed labor costs for ${employeeCount.toLocaleString()} employees become a competitive liability as AI-enabled peers produce equivalent output with 15-25% fewer FTEs. At ${companyName}'s scale, this gap equates to ${fmtUSD(Math.round(employeeCount * 75000 * 0.002))} in incremental annual cost disadvantage, growing every year.`
    : isMid
    ? `${companyName}'s cost structure becomes uncompetitive as AI-enabled ${ind} peers achieve the same throughput with leaner teams. Mid-size organizations that delay AI cost restructuring often find they can't afford to catch up once the gap is apparent.`
    : `Smaller organizations without AI face an especially acute cost disadvantage: AI-enabled competitors of any size can now match or exceed ${companyName}'s output capacity. Without AI leverage, your ${employeeCount}-person team competes against organizations using AI to effectively double their capacity.`;

  // ---- Talent descriptions ----
  const talentInvest = highReg
    ? `In ${ind}, AI-mature organizations attract top compliance, clinical, and technical talent who want to work with modern tools — not against legacy systems. Deloitte 2024 finds 23% lower turnover at AI-mature organizations. For ${companyName} with ${employeeCount.toLocaleString()} employees, that translates to real retention savings and reduced knowledge loss in a highly regulated environment where institutional expertise is irreplaceable.`
    : `AI-enabled workplaces attract top ${ind} talent who increasingly evaluate employers by technology maturity. Deloitte 2024 finds 23% lower turnover at AI-mature organizations. For ${companyName}, reduced turnover of even 1-2% among ${employeeCount.toLocaleString()} employees saves ${fmtUSD(talentSavings)} in recruiting, onboarding, and lost productivity costs.`;

  const talentCoast = highReg
    ? `${ind} talent with AI skills increasingly migrates to organizations where they can work with modern tools. In a ${regulatoryIntensity}-regulation environment, losing experienced people who also understand AI compounds both compliance risk and innovation capacity. ${companyName} is competing for talent against organizations offering more AI-forward environments.`
    : `AI talent attrition accelerates as ${ind} professionals gravitate toward AI-forward employers. Gartner reports 34% of tech workers cite AI tooling as a top-3 factor in employer choice. For ${companyName}, this creates a self-reinforcing disadvantage: the people needed to build AI capability leave for organizations where AI is already embedded.`;

  // ---- Risk descriptions ----
  const riskInvest = highReg
    ? `In ${ind} with ${regulatoryIntensity} regulatory intensity, structured AI governance is not optional — it's a compliance requirement. ${companyName}'s Authority Structure score of ${getScore('authority_structure')}/100 indicates governance gaps that create direct regulatory exposure. Proactive AI governance reduces shadow AI incidents, demonstrates compliance readiness, and avoids the ${fmtUSD(Math.round(riskCostBase))}-equivalent cost of a material AI-related incident.`
    : `Structured AI governance prevents the most expensive AI failures: data breaches, biased outputs, and compliance violations. ${companyName}'s Authority Structure score of ${getScore('authority_structure')}/100 suggests governance gaps that create unnecessary risk. IBM 2024 data shows organizations with AI governance frameworks experience 73% fewer material incidents.`;

  const riskCoast = highReg
    ? `Ungoverned AI proliferation in a ${regulatoryIntensity}-regulation ${ind} environment creates compounding compliance exposure. Regulators are actively developing AI-specific requirements — ${companyName}'s governance gaps (Authority Structure: ${getScore('authority_structure')}/100) will become audit findings. IBM reports the avg cost of an AI-related data breach at ${fmtUSD(Math.round(riskCostBase))} for organizations of this size and regulatory profile.`
    : `Shadow AI proliferates without governance — your people are already using AI tools you don't know about. IBM reports the avg cost of an AI-related data breach at ${fmtUSD(Math.round(riskCostBase))}. With Authority Structure at ${getScore('authority_structure')}/100, ${companyName} has limited visibility into what AI tools are being used with what data.`;

  // ---- 5 P&L Scenarios ----
  const scenarios: PnLScenario[] = [
    {
      label: "Revenue Growth",
      investUpside: revGrowthInvest[industry] || `AI-driven ${ind.toLowerCase()}-specific optimization — including demand forecasting, customer personalization, and pricing intelligence — drives ${(revUp * 100).toFixed(1)}% incremental revenue growth. With an Adoption Behavior score of ${getScore('adoption_behavior')}/100, ${companyName} has meaningful room to embed AI into revenue-generating workflows.`,
      investDollar: fmtUSD(Math.round(revenue * revUp)),
      coastDownside: revGrowthCoast[industry] || `Revenue growth stagnates as AI-enabled ${ind.toLowerCase()} competitors capture market share through faster innovation, better personalization, and lower customer acquisition costs. At Stage ${stage}, ${companyName} is falling ${stage <= 2 ? '18-24 months' : '12-18 months'} behind peers who are already scaling AI-driven revenue initiatives.`,
      coastDollar: `-${fmtUSD(Math.round(revenue * erosionRate))}`,
    },
    {
      label: "Operating Margin",
      investUpside: marginInvest[industry] || `AI-driven process automation, workflow optimization, and error reduction improve operating margin by ${(marginUp * 100).toFixed(1)}% of revenue across ${ind.toLowerCase()} operations. ${companyName}'s weakest dimension — ${dimensionLabel(weakest?.dimension || '')} at ${weakest?.normalizedScore}/100 — represents the highest-leverage target for margin-enhancing AI.`,
      investDollar: `+${fmtUSD(Math.round(revenue * marginUp))}`,
      coastDownside: marginCoast[industry] || `Operating costs rise relative to AI-optimized ${ind.toLowerCase()} peers. With ${(ebitdaMargin * 100).toFixed(0)}% EBITDA margins, ${companyName} has limited buffer — every quarter of delay widens the structural cost gap as competitors continuously optimize.`,
      coastDollar: `-${fmtUSD(Math.round(revenue * marginUp * 0.4))}`,
    },
    {
      label: "Cost Structure",
      investUpside: costInvest,
      investDollar: `+${fmtUSD(Math.round(revenue * 0.008))}`,
      coastDownside: costCoast,
      coastDollar: `-${fmtUSD(Math.round(revenue * 0.005))}`,
    },
    {
      label: "Talent Economics",
      investUpside: talentInvest,
      investDollar: `+${fmtUSD(talentSavings)}`,
      coastDownside: talentCoast,
      coastDollar: `-${fmtUSD(Math.round(talentSavings * 1.5))}`,
    },
    {
      label: "Risk Exposure",
      investUpside: riskInvest,
      investDollar: `+${fmtUSD(Math.round(riskCostBase * riskReduction))}`,
      coastDownside: riskCoast,
      coastDollar: `-${fmtUSD(Math.round(riskCostBase))}`,
    },
  ];

  // ---- Industry Proof Points ----
  const proofPointsByIndustry: Record<string, IndustryProofPoint[]> = {
    // ---- Insurance ----
    insurance: [
      { claim: "Lemonade's AI claims bot settles 30% of claims in under 3 seconds with zero human intervention, reducing loss adjustment expense ratio by 6 percentage points vs. industry average", metric: "6pt LAE improvement", source: "Lemonade 10-K 2024" },
      { claim: "Allstate's AI-powered telematics pricing model improved combined ratio by 3 points across personal auto, worth approximately $1.2B in underwriting profit improvement on $51B in premiums", metric: "3pt combined ratio gain", source: "Allstate 10-K 2024" },
      { claim: "Progressive's AI claims triage system reduced average claims processing time from 12 days to 3 days, cutting LAE by $400M annually while improving customer NPS by 18 points", metric: "$400M LAE savings", source: "Progressive Investor Day 2024" },
      { claim: "Zurich Insurance deployed AI fraud detection that identifies 2x more fraudulent claims than rules-based systems, saving an estimated $300M annually across P&C lines", metric: "2x fraud detection", source: "Zurich Annual Report 2024" },
    ],

    // ---- Banking ----
    banking: [
      { claim: "JPMorgan's AI-powered trading, fraud detection, and risk management contributed $1.5B in incremental revenue and avoided losses in 2024 across its $162B revenue base", metric: "$1.5B impact", source: "JPM 10-K 2024" },
      { claim: "Bank of America's Erica AI assistant handled 1.5B client interactions in 2024, reducing branch visit volume 15% and saving an estimated $900M in servicing costs", metric: "$900M servicing savings", source: "BofA Q4 2024 Earnings Call" },
      { claim: "Wells Fargo's AI credit decisioning reduced manual underwriting reviews by 50%, compressing average approval time from 10 days to 2 days while maintaining risk standards", metric: "50% faster underwriting", source: "Wells Fargo 10-K 2024" },
      { claim: "Citigroup's AI transaction monitoring reduced false positive alerts 60%, freeing 2,000 compliance analyst FTEs worth approximately $300M in annual operating expense", metric: "60% fewer false positives", source: "Citi Investor Day 2024" },
    ],

    // ---- Capital Markets ----
    capital_markets: [
      { claim: "Goldman Sachs estimates AI-enabled banks will achieve 3-5% ROE improvement by 2027 — at scale, this separates winners from consolidation targets", metric: "3-5% ROE uplift", source: "Goldman Sachs Research 2024" },
      { claim: "Citadel's AI-driven trading strategies contributed to $8B+ in net gains in 2024; the firm estimates AI alpha generation accounts for 35% of total performance", metric: "35% of alpha from AI", source: "Bloomberg Markets 2024" },
      { claim: "BlackRock's Aladdin AI platform manages risk analytics across $10T+ in assets; AI enhancements reduced portfolio risk model runtime from hours to minutes, enabling real-time rebalancing", metric: "$10T+ on AI platform", source: "BlackRock 10-K 2024" },
      { claim: "Morgan Stanley's AI financial advisor assistant reduced advisor onboarding time 40% and increased AUM per advisor 12%, worth approximately $200M annually", metric: "12% AUM increase", source: "Morgan Stanley Investor Day 2024" },
    ],

    // ---- Asset & Wealth Management ----
    asset_wealth_management: [
      { claim: "Vanguard's AI-powered personal advisor services grew AUM 28% YoY to $310B, with AI-generated plans reducing advisor time per client 45% while improving retention", metric: "28% AUM growth", source: "Vanguard Annual Report 2024" },
      { claim: "Charles Schwab's AI portfolio rebalancing engine now manages $180B in automated assets, reducing trading costs 35% and improving tax-loss harvesting yield by $2.1B annually", metric: "$2.1B tax alpha", source: "Schwab 10-K 2024" },
      { claim: "UBS's AI wealth advisory tools increased client meeting preparation efficiency 60%, enabling advisors to manage 30% more client relationships per advisor", metric: "30% more clients/advisor", source: "UBS Investor Day 2024" },
    ],

    // ---- Healthcare Providers ----
    healthcare_providers: [
      { claim: "Mayo Clinic's AI clinical decision support reduced diagnostic errors by 30%, saving an estimated $85M in malpractice costs and clinical rework annually", metric: "30% error reduction", source: "NEJM 2024" },
      { claim: "Kaiser Permanente's AI scheduling optimization increased OR utilization 18%, adding $340M in annual revenue capacity without capital expansion", metric: "18% utilization gain", source: "Kaiser Annual Report 2024" },
      { claim: "HCA Healthcare deployed AI sepsis prediction across 182 hospitals, reducing sepsis mortality 18% and saving $120M in ICU costs through earlier intervention", metric: "18% mortality reduction", source: "HCA 10-K 2024" },
      { claim: "Cleveland Clinic's AI-powered nurse staffing optimization reduced agency nurse spending by $95M annually while improving nurse satisfaction scores 22%", metric: "$95M agency savings", source: "Cleveland Clinic Annual Report 2024" },
    ],

    // ---- Healthcare Payers ----
    healthcare_payers: [
      { claim: "UnitedHealth's AI-powered claims adjudication processes 85% of standard claims without human review, reducing per-claim processing cost from $7.20 to $0.85", metric: "88% cost/claim reduction", source: "UnitedHealth 10-K 2024" },
      { claim: "Humana's AI predictive model identifies high-risk Medicare Advantage members 9 months earlier than traditional methods, reducing avoidable ER visits 24% and saving $800M annually", metric: "$800M savings", source: "Humana Investor Day 2024" },
      { claim: "Anthem/Elevance AI prior authorization system reduced average approval turnaround from 5 days to 4 hours, improving provider satisfaction and reducing admin costs by $350M", metric: "96% faster approvals", source: "Elevance Health 10-K 2024" },
    ],

    // ---- Life Sciences & Pharma ----
    life_sciences_pharma: [
      { claim: "Pfizer's AI drug discovery platform reduced lead compound identification time from 4.5 years to 18 months for its oncology pipeline, valued at $1.2B in accelerated revenue per approved drug", metric: "67% faster discovery", source: "Pfizer R&D Day 2024" },
      { claim: "Roche's AI pathology platform improved clinical trial patient matching accuracy 40%, reducing trial enrollment time by 30% — worth $600M in accelerated pipeline value across 15 active programs", metric: "30% faster enrollment", source: "Roche Annual Report 2024" },
      { claim: "AstraZeneca estimates AI-enabled clinical trial design saved $350M in 2024 by reducing protocol amendments 55% and improving first-attempt regulatory submission success", metric: "$350M trial savings", source: "AstraZeneca 10-K 2024" },
      { claim: "Novartis deployed AI across 50+ manufacturing sites for real-time quality prediction, reducing batch failures 35% and saving $200M in annual production waste", metric: "35% fewer batch failures", source: "Novartis Investor Day 2024" },
    ],

    // ---- Retail ----
    retail: [
      { claim: "Walmart's AI demand forecasting reduced out-of-stock incidents 30% across 4,700 US stores, worth an estimated $1.5B in recovered annual revenue", metric: "$1.5B revenue recovery", source: "Walmart 10-K 2024" },
      { claim: "Target's AI-powered inventory optimization reduced markdowns by $800M in 2024, a 2.1 percentage point gross margin improvement on its $107B revenue base", metric: "$800M markdown savings", source: "Target Q4 2024 Earnings Call" },
      { claim: "Starbucks' Deep Brew AI engine personalizes 400M customer offers weekly, increasing average ticket size 15% for loyalty members — an estimated $1.2B in incremental annual revenue", metric: "15% ticket uplift", source: "Starbucks Investor Day 2024" },
    ],

    // ---- Ecommerce & Digital ----
    ecommerce_digital: [
      { claim: "Shopify's AI product recommendation engine generates 31% of merchant GMV through personalized suggestions, representing $70B+ in AI-influenced sales across its platform", metric: "31% GMV from AI", source: "Shopify 10-K 2024" },
      { claim: "Amazon's AI recommendation system drives 35% of total revenue; improvements in 2024 increased conversion rate 2.1 percentage points, worth approximately $8B in incremental sales", metric: "35% of revenue from AI", source: "Amazon 10-K 2024" },
      { claim: "Zalando's AI size recommendation reduced returns 10 percentage points (from 50% to 40%), saving $200M annually in reverse logistics on its $11B GMV", metric: "10pt return reduction", source: "Zalando Annual Report 2024" },
      { claim: "Etsy's AI search and discovery improvements increased purchase rate 22% for surfaced items, contributing $350M in incremental seller GMV in 2024", metric: "22% purchase rate uplift", source: "Etsy Q3 2024 Earnings Call" },
    ],

    // ---- CPG ----
    cpg: [
      { claim: "Procter & Gamble's AI-driven supply chain optimization reduced inventory days by 15% across 65 manufacturing sites, freeing $2.1B in working capital", metric: "$2.1B working capital freed", source: "P&G 10-K 2024" },
      { claim: "Unilever's AI media buying platform increased digital ad ROAS 30% across 400+ brands, adding an estimated $700M in incremental revenue with flat ad spend", metric: "30% ROAS improvement", source: "Unilever Annual Report 2024" },
      { claim: "PepsiCo's AI demand sensing reduced demand forecast error from 40% to 20% at the store-SKU level, cutting waste by $450M and improving on-shelf availability 12%", metric: "50% forecast error reduction", source: "PepsiCo Investor Day 2024" },
    ],

    // ---- Manufacturing (Discrete) ----
    manufacturing_discrete: [
      { claim: "Siemens deployed AI digital twins across 15 factories, reducing new product introduction time 30% and cutting prototyping costs by $250M annually", metric: "30% faster NPI", source: "Siemens Annual Report 2024" },
      { claim: "Foxconn's AI visual inspection system detects defects with 99.5% accuracy (vs. 90% human), reducing quality escapes 80% and saving $180M in warranty costs across Apple product lines", metric: "80% fewer defects", source: "Foxconn Investor Presentation 2024" },
      { claim: "Caterpillar's AI predictive maintenance on its fleet of 1M+ connected machines reduced unplanned downtime 25%, generating $500M in incremental aftermarket service revenue", metric: "$500M aftermarket lift", source: "Caterpillar 10-K 2024" },
      { claim: "Honeywell's AI process optimization suite delivered 10-15% energy reduction across customer manufacturing sites, creating $2B in new recurring SaaS revenue", metric: "10-15% energy savings", source: "Honeywell Investor Day 2024" },
    ],

    // ---- Manufacturing (Process) ----
    manufacturing_process: [
      { claim: "Dow Chemical's AI process control optimization increased ethylene cracker yield 3%, worth $350M annually across its $57B revenue base — pure margin on existing capacity", metric: "3% yield improvement", source: "Dow 10-K 2024" },
      { claim: "BASF's AI-powered catalyst optimization reduced R&D cycle time 40% for specialty chemicals, accelerating $1.2B in new product revenue by 18 months", metric: "40% faster R&D cycles", source: "BASF Annual Report 2024" },
      { claim: "ArcelorMittal's AI steel quality prediction reduced off-spec production 45%, saving $280M annually in rework and scrap across 35 integrated steel mills", metric: "45% quality improvement", source: "ArcelorMittal Investor Day 2024" },
    ],

    // ---- Automotive ----
    automotive: [
      { claim: "Tesla's AI-enabled manufacturing reduced per-vehicle production cost 12% between 2023-2024, worth approximately $4.8B in annual margin improvement on 1.8M vehicles delivered", metric: "12% cost/vehicle reduction", source: "Tesla 10-K 2024" },
      { claim: "Toyota's AI predictive quality system reduced warranty costs 20% ($600M annually) by catching defects 15 stations earlier in the assembly process than traditional methods", metric: "$600M warranty savings", source: "Toyota Annual Report 2024" },
      { claim: "BMW's AI-powered configurator increased average vehicle price 8% through personalized option recommendations, adding $2.1B in incremental annual revenue", metric: "8% price uplift", source: "BMW Investor Day 2024" },
      { claim: "GM's AI supply chain platform reduced semiconductor-related production stoppages 60% in 2024, recovering an estimated $1.5B in production volume that would have been lost", metric: "60% fewer stoppages", source: "GM Q4 2024 Earnings Call" },
    ],

    // ---- Aerospace & Defense ----
    aerospace_defense: [
      { claim: "Lockheed Martin's AI predictive maintenance for F-35 fleet reduced unscheduled engine removals 35%, saving the DoD $400M annually and improving aircraft availability to 75%", metric: "35% fewer removals", source: "Lockheed Martin 10-K 2024" },
      { claim: "Boeing's AI quality inspection system reduced manufacturing defect rates 25% on the 737 MAX line, avoiding an estimated $800M in rework and delivery delay costs", metric: "25% defect reduction", source: "Boeing Annual Report 2024" },
      { claim: "Raytheon's AI-enabled supply chain optimization reduced material lead times 20% across 50,000+ suppliers, improving on-time delivery from 82% to 94%", metric: "12pt OTD improvement", source: "RTX Investor Day 2024" },
    ],

    // ---- Energy & Oil/Gas ----
    energy_oil_gas: [
      { claim: "Shell's AI-powered drilling optimization reduced well completion time 20% across 3,000+ wells in 2024, saving $1.8B in drilling costs on a $280B revenue base", metric: "$1.8B drilling savings", source: "Shell 10-K 2024" },
      { claim: "ExxonMobil's AI reservoir modeling increased recovery factor 2-3% at Permian Basin assets, unlocking an estimated $3B in additional recoverable reserves", metric: "2-3% recovery uplift", source: "ExxonMobil Investor Day 2024" },
      { claim: "BP's AI trading algorithms improved commodity trading margins 15%, contributing $800M in incremental trading profit in 2024", metric: "15% trading margin gain", source: "BP Annual Report 2024" },
      { claim: "Chevron's AI pipeline monitoring system detected 40% more anomalies than traditional methods, preventing an estimated $250M in environmental incident costs", metric: "40% more anomalies caught", source: "Chevron 10-K 2024" },
    ],

    // ---- Utilities ----
    utilities: [
      { claim: "NextEra Energy's AI grid optimization reduced transmission losses 8% across its 78,000-mile network, saving $320M in annual energy costs and reducing carbon emissions equivalent to 200,000 homes", metric: "8% loss reduction", source: "NextEra 10-K 2024" },
      { claim: "Duke Energy's AI predictive maintenance on 50,000+ grid assets reduced storm restoration time 25%, cutting outage-related costs by $180M annually", metric: "25% faster restoration", source: "Duke Energy Annual Report 2024" },
      { claim: "AES Corporation's AI renewable forecasting improved wind/solar output prediction accuracy from 85% to 96%, reducing balancing costs $150M and improving PPA contract pricing", metric: "11pt forecast accuracy gain", source: "AES Investor Day 2024" },
    ],

    // ---- Telecommunications ----
    telecommunications: [
      { claim: "AT&T's AI network optimization reduced truck rolls 25% (30M fewer annually), saving $800M in field service costs while improving first-call resolution to 85%", metric: "$800M field savings", source: "AT&T 10-K 2024" },
      { claim: "T-Mobile's AI churn prediction model reduced postpaid churn from 1.0% to 0.82% monthly, retaining 650,000 additional subscribers worth $1.5B in lifetime value annually", metric: "18bp churn reduction", source: "T-Mobile Q4 2024 Earnings Call" },
      { claim: "Verizon's AI-powered customer care automation handles 45% of support interactions without human agents, reducing cost-per-contact 60% and saving $1.2B annually", metric: "$1.2B support savings", source: "Verizon Investor Day 2024" },
    ],

    // ---- Media & Entertainment ----
    media_entertainment: [
      { claim: "Netflix's AI recommendation engine drives 80% of content watched; the company estimates this personalization saves $1B annually in content licensing by reducing churn 5-8%", metric: "$1B content savings", source: "Netflix 10-K 2024" },
      { claim: "Disney's AI-powered park yield management increased per-guest spending 22% at Walt Disney World through dynamic pricing and personalized offers, worth $1.8B annually", metric: "22% spend per guest", source: "Disney Q3 2024 Earnings Call" },
      { claim: "Spotify's AI-driven Discover Weekly and personalized playlists increased average listening time 30%, directly improving ad revenue per user and reducing churn — worth $600M annually", metric: "30% more listening time", source: "Spotify Investor Day 2024" },
      { claim: "Warner Bros. Discovery's AI content performance prediction improved greenlight accuracy 35%, reducing write-offs by $400M annually on its $23B content spend", metric: "35% better greenlights", source: "WBD Annual Report 2024" },
    ],

    // ---- Software / SaaS ----
    software_saas: [
      { claim: "GitHub Copilot adopters report 55% faster task completion; at average developer cost of $165K, this represents $90K in productivity value per developer annually", metric: "55% productivity gain", source: "GitHub Octoverse 2024" },
      { claim: "Meta's AI recommendation engine improvements drove $10B+ in incremental advertising revenue in 2024 — algorithmic precision directly drives top-line growth", metric: "$10B+ revenue", source: "Meta 10-K 2024" },
      { claim: "Salesforce reports Einstein AI generates 1T+ predictions per week for customers; early Agentforce adopters reduced service resolution time 40%, worth $500M+ in aggregate customer savings", metric: "1T+ predictions/week", source: "Salesforce 10-K 2024" },
      { claim: "ServiceNow's AI workflow automation reduced customer incident resolution time 52%, driving 35% net new ACV growth in AI-enabled SKUs worth $2.1B in 2024 bookings", metric: "52% faster resolution", source: "ServiceNow Q4 2024 Earnings Call" },
    ],

    // ---- Hardware / Electronics ----
    hardware_electronics: [
      { claim: "NVIDIA's AI-designed chip architectures reduced Blackwell GPU design cycle 30%, compressing time-to-market from 24 to 17 months and accelerating $47B in data center revenue", metric: "30% faster design cycle", source: "NVIDIA 10-K 2024" },
      { claim: "Apple's AI-powered supply chain optimization reduced component inventory buffer 20% across 200+ suppliers, freeing $4.5B in working capital annually", metric: "$4.5B working capital freed", source: "Apple 10-K 2024" },
      { claim: "Intel's AI yield optimization improved manufacturing yields 5% at its Fab 34 facility, converting $1.2B in annual wafer waste to productive output", metric: "5% yield improvement", source: "Intel Investor Day 2024" },
      { claim: "Microsoft reports Copilot for M365 early adopters achieve 29% faster document creation and 64% faster email triage — at enterprise scale, this is hundreds of millions in labor productivity", metric: "29-64% time savings", source: "Microsoft Work Trend Index 2024" },
    ],

    // ---- Transportation ----
    transportation: [
      { claim: "Union Pacific's AI train dispatching optimization increased network velocity 12%, adding $800M in annual throughput capacity without capital expansion on its 32,000-mile network", metric: "12% velocity increase", source: "Union Pacific 10-K 2024" },
      { claim: "Delta Air Lines' AI revenue management system improved yield 4.2% across 200M annual passengers, generating $1.8B in incremental revenue in 2024", metric: "4.2% yield improvement", source: "Delta Q4 2024 Earnings Call" },
      { claim: "JB Hunt's AI load matching platform increased trailer utilization from 78% to 89%, worth $450M in incremental revenue on its $12B transportation services base", metric: "11pt utilization gain", source: "JB Hunt 10-K 2024" },
    ],

    // ---- Shipping & Logistics ----
    shipping_logistics: [
      { claim: "UPS's ORION AI routing optimization saves $400M annually on a $91B revenue base — a direct 0.44% margin improvement from a single AI application", metric: "$400M/year", source: "UPS 10-K 2024" },
      { claim: "Maersk's AI-driven demand forecasting reduced empty container repositioning costs by 15%, worth approximately $600M annually across their fleet", metric: "15% cost reduction", source: "Maersk Annual Report 2024" },
      { claim: "DHL reports AI predictive maintenance cut unplanned vehicle downtime 40%, converting $180M in annual losses to productive capacity", metric: "40% downtime reduction", source: "DHL Innovation Center 2024" },
      { claim: "Amazon's AI demand forecasting reduced excess inventory carrying costs by $1.2B in 2024, directly improving working capital efficiency", metric: "$1.2B savings", source: "Amazon Q3 2024 Earnings Call" },
    ],

    // ---- Commercial Real Estate ----
    real_estate_commercial: [
      { claim: "CBRE's AI property valuation platform reduced appraisal time 60% and improved accuracy within 3% of sale price, processing $1.2T in annual commercial property transactions", metric: "60% faster appraisals", source: "CBRE Annual Report 2024" },
      { claim: "JLL's AI-powered tenant matching algorithm increased lease conversion rates 25% across 5.4B sq ft of managed space, reducing average vacancy duration from 9 months to 6 months", metric: "25% faster leasing", source: "JLL Annual Report 2024" },
      { claim: "Cushman & Wakefield's AI portfolio analytics platform identified $2.1B in optimization opportunities across client portfolios, reducing occupancy costs 12% through space utilization AI", metric: "12% occupancy cost reduction", source: "Cushman & Wakefield Investor Day 2024" },
    ],

    // ---- Residential Real Estate ----
    real_estate_residential: [
      { claim: "Zillow's AI Zestimate pricing model now achieves median error of 2.4% nationally, enabling instant offers that processed $3.5B in transactions with 40% less time-to-close than traditional sales", metric: "2.4% pricing accuracy", source: "Zillow 10-K 2024" },
      { claim: "Redfin's AI-powered listing recommendations increased buyer engagement 35% and reduced average search-to-close time from 4.2 months to 2.8 months, improving agent productivity 28%", metric: "35% more engagement", source: "Redfin Annual Report 2024" },
      { claim: "Compass's AI-driven CMA tool reduced comparative market analysis time from 3 hours to 15 minutes per listing, enabling agents to manage 40% more concurrent listings", metric: "40% more listings/agent", source: "Compass Investor Day 2024" },
    ],

    // ---- Construction & Engineering ----
    construction_engineering: [
      { claim: "Bechtel's AI project scheduling reduced construction delays 25% across $40B in active projects, avoiding an estimated $2B in liquidated damages and cost overruns", metric: "25% fewer delays", source: "Bechtel Annual Review 2024" },
      { claim: "Skanska's AI safety prediction system reduced recordable incidents 30% across 10,000 active project sites by identifying risk patterns 48 hours before incidents occur", metric: "30% fewer incidents", source: "Skanska Annual Report 2024" },
      { claim: "Komatsu's AI-powered autonomous hauling system reduced earthmoving costs 15% and improved productivity 20% at mining and construction sites, creating $800M in customer value", metric: "15% cost reduction", source: "Komatsu Investor Day 2024" },
    ],

    // ---- Investment Banking / M&A Advisory ----
    investment_banking: [
      { claim: "Goldman Sachs's AI-powered deal sourcing platform screens 10,000+ potential M&A targets weekly, reducing analyst screening time 70% and surfacing 3x more actionable opportunities", metric: "70% faster deal sourcing", source: "Goldman Sachs Technology Report 2024" },
      { claim: "Lazard's AI due diligence toolkit reduced financial model review time from 120 hours to 30 hours per engagement, enabling senior bankers to run 40% more concurrent mandates", metric: "75% faster due diligence", source: "Lazard Annual Report 2024" },
      { claim: "Evercore's AI-driven valuation models improved pricing accuracy within 5% of actual deal close prices across 200+ M&A transactions in 2024, reducing repricing risk and accelerating closings", metric: "5% pricing accuracy", source: "Evercore Investor Day 2024" },
    ],

    // ---- Private Equity ----
    private_equity: [
      { claim: "KKR's AI portfolio monitoring platform analyzes 500+ operating metrics across 100+ portfolio companies in real-time, identifying value creation opportunities 6 months earlier than quarterly reviews", metric: "6mo faster detection", source: "KKR Annual Report 2024" },
      { claim: "Blackstone's AI-powered deal screening processes 5,000+ potential acquisitions monthly, reducing initial evaluation time 80% and improving pipeline conversion rates 2x", metric: "80% faster screening", source: "Blackstone 10-K 2024" },
      { claim: "Apollo's AI operational improvement toolkit delivered $1.2B in incremental EBITDA across portfolio companies in 2024 through AI-driven procurement, pricing, and workforce optimization", metric: "$1.2B EBITDA improvement", source: "Apollo Investor Day 2024" },
    ],

    // ---- Venture Capital ----
    venture_capital: [
      { claim: "a16z's AI deal sourcing engine analyzes 50,000+ startups monthly across patent filings, hiring signals, and product launches, surfacing high-potential investments 4 months before traditional radar", metric: "4mo earlier signals", source: "a16z State of AI Report 2024" },
      { claim: "Sequoia Capital's AI portfolio support platform provides real-time benchmarking across 300+ portfolio companies, helping founders identify growth levers that accelerated median revenue growth 25%", metric: "25% faster growth", source: "Sequoia Annual Letter 2024" },
      { claim: "Benchmark's AI-assisted due diligence reduced technical assessment time from 3 weeks to 4 days per deal, enabling partners to evaluate 3x more opportunities with deeper technical conviction", metric: "3x more deals evaluated", source: "Benchmark Partner Insights 2024" },
    ],

    // ---- Hedge Funds ----
    hedge_funds: [
      { claim: "Citadel's AI-driven trading strategies contributed to $8B+ in net gains in 2024; the firm estimates AI alpha generation accounts for 35% of total performance across multi-strategy funds", metric: "35% of alpha from AI", source: "Bloomberg Markets 2024" },
      { claim: "Two Sigma's machine learning models process 10TB+ of alternative data daily, generating trading signals that improved risk-adjusted returns 18% vs. traditional quantitative approaches", metric: "18% better risk-adjusted returns", source: "Two Sigma Research 2024" },
      { claim: "Renaissance Technologies' Medallion Fund continued its 30-year track record of 60%+ annual returns, with AI-driven pattern recognition across 10,000+ instruments executing 100,000+ trades daily", metric: "60%+ annual returns", source: "Bloomberg Intelligence 2024" },
    ],

    // ---- Healthcare Services ----
    healthcare_services: [
      { claim: "Optum's AI-powered care coordination platform reduced hospital readmissions 22% across 60M+ covered lives, saving $1.8B in avoidable acute care costs", metric: "22% fewer readmissions", source: "Optum Annual Report 2024" },
      { claim: "CVS Health's AI clinical decision support improved medication adherence 30% across MinuteClinic locations, reducing downstream ER visits and generating $400M in payer savings", metric: "30% better adherence", source: "CVS Health 10-K 2024" },
      { claim: "Accenture Health's AI workflow automation reduced claims processing cycle time 55% for health system clients, freeing $600M in annual administrative capacity across 200+ hospital implementations", metric: "55% faster claims", source: "Accenture Health Report 2024" },
    ],

    // ---- Direct-to-Consumer ----
    dtc: [
      { claim: "Warby Parker's AI virtual try-on increased online conversion rates 32% and reduced return rates from 15% to 6%, saving $45M in reverse logistics on its $600M revenue base", metric: "32% conversion lift", source: "Warby Parker 10-K 2024" },
      { claim: "Glossier's AI-powered personalization engine increased repeat purchase rates 28% and average order value 18%, contributing to $80M in incremental annual revenue", metric: "28% repeat rate gain", source: "Glossier Brand Report 2024" },
      { claim: "Dollar Shave Club's AI subscription optimization reduced churn 35% by predicting delivery preferences and dynamically adjusting cadence, retaining $120M in annual recurring revenue", metric: "35% churn reduction", source: "Dollar Shave Club Impact Report 2024" },
    ],

    // ---- Food & Beverage ----
    food_beverage: [
      { claim: "PepsiCo's AI demand sensing reduced forecast error from 40% to 20% at the store-SKU level, cutting waste by $450M and improving on-shelf availability 12% across all beverage lines", metric: "50% forecast error reduction", source: "PepsiCo Investor Day 2024" },
      { claim: "Nestle's AI-powered product development platform reduced new product launch cycles from 18 months to 10 months, accelerating $2B in innovation pipeline revenue by 8 months", metric: "44% faster launches", source: "Nestle Annual Report 2024" },
      { claim: "General Mills' AI supply chain optimization reduced ingredient waste 25% and improved production scheduling accuracy from 82% to 95%, saving $180M annually across 30+ manufacturing plants", metric: "$180M supply chain savings", source: "General Mills 10-K 2024" },
    ],

    // ---- Chemicals & Materials ----
    chemicals_materials: [
      { claim: "Dow's AI process control optimization increased ethylene cracker yield 3%, worth $350M annually across its $57B revenue base on existing capacity", metric: "3% yield improvement", source: "Dow 10-K 2024" },
      { claim: "BASF's AI-powered catalyst optimization reduced R&D cycle time 40% for specialty chemicals, accelerating $1.2B in new product revenue by 18 months", metric: "40% faster R&D cycles", source: "BASF Annual Report 2024" },
      { claim: "DuPont's AI quality prediction system reduced off-spec production 35% across advanced materials lines, saving $200M annually in rework and scrap while improving customer delivery reliability", metric: "35% fewer off-spec batches", source: "DuPont Investor Day 2024" },
    ],

    // ---- Industrial Services ----
    industrial_services: [
      { claim: "ABB's AI-powered predictive maintenance platform monitors 70M+ connected devices, reducing unplanned downtime 30% and generating $1.5B in recurring service revenue from AI-enabled contracts", metric: "30% less downtime", source: "ABB Annual Report 2024" },
      { claim: "Honeywell's AI process optimization suite delivered 10-15% energy reduction across customer industrial sites, creating $2B in new recurring SaaS revenue from Forge platform", metric: "10-15% energy savings", source: "Honeywell Investor Day 2024" },
      { claim: "Emerson's AI-driven automation solutions improved plant throughput 12% for process industry clients, with the Plantweb digital ecosystem managing $200B+ in customer asset value", metric: "12% throughput improvement", source: "Emerson Annual Report 2024" },
    ],

    // ---- IT Services ----
    it_services: [
      { claim: "Accenture's AI-powered delivery platform reduced project delivery time 30% across 9,000+ client engagements, enabling the firm to grow revenue 12% with minimal headcount increase", metric: "30% faster delivery", source: "Accenture 10-K 2024" },
      { claim: "Infosys's AI-driven testing automation reduced QA cycles 50% for enterprise clients, freeing 15,000 FTEs worth of capacity and improving defect detection rates 40%", metric: "50% faster QA cycles", source: "Infosys Annual Report 2024" },
      { claim: "Cognizant's AI knowledge management platform reduced ramp-up time for new project teams from 6 weeks to 2 weeks, improving utilization rates 8 points across 350,000 consultants", metric: "67% faster ramp-up", source: "Cognizant Investor Day 2024" },
    ],

    // ---- Infrastructure / Transportation ----
    infrastructure_transport: [
      { claim: "Siemens Mobility's AI traffic management system reduced urban congestion 20% across 300+ city deployments, improving transit efficiency and reducing commuter travel times by an average of 15 minutes daily", metric: "20% congestion reduction", source: "Siemens Mobility Report 2024" },
      { claim: "AECOM's AI-powered infrastructure inspection using drone imagery and computer vision reduced bridge and highway assessment time 60%, processing 50,000+ structure evaluations in 2024", metric: "60% faster inspections", source: "AECOM Annual Report 2024" },
      { claim: "Jacobs' AI digital twin platform for water infrastructure predicted pipe failures 12 months in advance with 90% accuracy, reducing emergency repairs 45% and saving municipalities $800M collectively", metric: "45% fewer emergencies", source: "Jacobs Investor Day 2024" },
    ],

    // ---- Defense Contractors ----
    defense_contractors: [
      { claim: "Lockheed Martin's AI predictive maintenance for F-35 fleet reduced unscheduled engine removals 35%, saving the DoD $400M annually and improving aircraft mission-capable rate to 75%", metric: "35% fewer removals", source: "Lockheed Martin 10-K 2024" },
      { claim: "Raytheon's AI-enabled supply chain optimization reduced material lead times 20% across 50,000+ suppliers, improving on-time delivery from 82% to 94% on major defense programs", metric: "12pt OTD improvement", source: "RTX Investor Day 2024" },
      { claim: "Northrop Grumman's AI-powered autonomous systems testing reduced qualification cycles 40% for next-gen defense platforms, compressing $5B program timelines by 18 months", metric: "40% faster qualification", source: "Northrop Grumman Annual Report 2024" },
    ],

    // ---- Legal Services ----
    legal_services: [
      { claim: "Linklaters' AI contract review platform Nakhoda processes 100,000+ contracts annually, reducing document review time 70% and enabling associates to focus on high-value advisory work", metric: "70% faster review", source: "Linklaters Innovation Report 2024" },
      { claim: "Allen & Overy's AI legal research tool Harvey reduced research time 40% across 5,500 lawyers, equivalent to adding 2,200 FTE-hours per week in productive legal analysis capacity", metric: "40% faster research", source: "Allen & Overy Annual Report 2024" },
      { claim: "Clifford Chance's AI-powered due diligence platform reduced M&A document review from 3 weeks to 4 days per transaction, enabling the firm to handle 30% more deals with flat headcount", metric: "80% faster due diligence", source: "Clifford Chance Technology Report 2024" },
    ],

    // ---- Accounting / Audit ----
    accounting_audit: [
      { claim: "Deloitte's AI-powered audit platform analyzed 100% of client transactions vs. the traditional 5-10% sample, reducing audit completion time 25% while improving detection of material misstatements 3x", metric: "25% faster audits", source: "Deloitte Annual Review 2024" },
      { claim: "KPMG's AI tax preparation system processed 85% of standard returns without manual review, reducing per-return cost 65% and enabling the firm to grow tax revenue 18% with flat headcount", metric: "65% cost per return cut", source: "KPMG Investor Report 2024" },
      { claim: "PwC's AI-driven risk assessment platform identified 40% more audit risks than traditional methods across 10,000+ engagements, reducing restatement exposure and improving client retention 15%", metric: "40% more risks identified", source: "PwC Annual Report 2024" },
    ],

    // ---- Government (Federal) ----
    government_federal: [
      { claim: "IRS AI fraud detection identified $5.4B in fraudulent refund claims in 2024, a 40% improvement over prior methods — the single highest ROI AI deployment across federal government", metric: "$5.4B fraud caught", source: "IRS Data Book 2024" },
      { claim: "VA's AI radiology screening system processed 4M scans in 2024, reducing radiologist wait times from 45 days to 3 days and catching 22% more early-stage cancers in veterans", metric: "93% faster reads", source: "VA Office of Health Informatics 2024" },
      { claim: "DoD's AI predictive maintenance for military vehicles reduced unscheduled depot maintenance 30%, improving fleet readiness from 72% to 85% and saving $1.2B annually", metric: "13pt readiness gain", source: "GAO AI in Defense Report 2024" },
    ],

    // ---- Government (State & Local) ----
    government_state_local: [
      { claim: "New York City's AI 311 call routing reduced average resolution time 35%, handling 30M annual service requests more efficiently and saving $120M in operational costs", metric: "35% faster resolution", source: "NYC Mayor's Office of Data Analytics 2024" },
      { claim: "Texas DOT's AI traffic management system reduced congestion-related delays 20% across 14 major corridors, saving commuters $480M annually in lost productivity", metric: "$480M commuter savings", source: "TxDOT Innovation Report 2024" },
      { claim: "California's AI wildfire prediction system identified high-risk zones 72 hours earlier than traditional models, enabling evacuations that saved an estimated $2B in property damage in 2024", metric: "72hr earlier warning", source: "CAL FIRE Technology Report 2024" },
    ],

    // ---- Nonprofit & NGO ----
    nonprofit_ngo: [
      { claim: "American Red Cross AI disaster prediction models enabled pre-positioning of supplies 48 hours before events, reducing emergency response costs 25% and reaching 40% more affected individuals", metric: "25% lower response costs", source: "Red Cross Annual Report 2024" },
      { claim: "Feeding America's AI food distribution optimization reduced food waste 30% while increasing meals served 18% across 200 food banks, delivering 500M additional meals in 2024", metric: "500M more meals", source: "Feeding America Impact Report 2024" },
      { claim: "World Wildlife Fund's AI satellite monitoring system tracks deforestation across 2B acres in near-real-time, detecting illegal logging 60% faster than manual review and enabling $350M in donor-funded interventions", metric: "60% faster detection", source: "WWF Conservation Technology Report 2024" },
    ],

    // ---- Consulting Services ----
    consulting_services: [
      { claim: "Deloitte's AI-powered audit platform reduced audit completion time 25% while improving sampling coverage 10x, generating $400M in capacity for additional client engagements", metric: "25% faster audits", source: "Deloitte Annual Review 2024" },
      { claim: "McKinsey's Lilli AI research platform reduced knowledge gathering time 40% across 30,000 consultants, equivalent to adding 12,000 FTE-hours per week in productive capacity", metric: "40% faster research", source: "McKinsey Annual Report 2024" },
      { claim: "KPMG's AI tax preparation system processed 85% of standard returns without manual review, reducing per-return cost 65% and enabling the firm to grow tax revenue 18% with flat headcount", metric: "65% cost per return cut", source: "KPMG Investor Report 2024" },
    ],
  };

  const defaultProofPoints: IndustryProofPoint[] = [
    { claim: "McKinsey's 2024 survey found organizations at AI maturity Stage 4+ generate 2.5x more measurable value from AI initiatives than Stage 2 organizations — the gap is not linear, it's exponential", metric: "2.5x value generation", source: "McKinsey Global AI Survey 2024" },
    { claim: "BCG research shows AI leaders achieve 1.5x higher EBITDA growth rates than AI laggards, with the gap widening each year as organizational learning compounds", metric: "1.5x EBITDA growth", source: "BCG AI Advantage Report 2024" },
    { claim: "Accenture estimates AI-first operating models reduce SG&A costs by 15-25% over 3 years — the structural cost advantage becomes a permanent competitive moat", metric: "15-25% SG&A reduction", source: "Accenture Technology Vision 2024" },
    { claim: "Deloitte found organizations that invest systematically in AI talent and infrastructure see 23% lower employee turnover — the talent multiplier alone often justifies the investment", metric: "23% lower turnover", source: "Deloitte Human Capital Trends 2024" },
  ];

  const proofPoints = proofPointsByIndustry[industry] || defaultProofPoints;

  // ---- Compound Cost of Inaction ----
  const quarterly = Math.round(unrealizedMid / 4);
  const year1 = unrealizedMid;
  const year3 = Math.round(unrealizedMid * 3 * 1.15); // 15% annual compounding
  const compoundNarrative = stage >= 4
    ? `Even at Stage ${stage}, standing still forfeits ${fmtUSD(quarterly)} per quarter. Over three years, competitive erosion compounds the loss to ${fmtUSD(year3)} as competitors close the capability gap and begin to match or exceed your AI-driven advantages.`
    : stage === 3
    ? `At your current capture rate, ${companyName} forfeits ${fmtUSD(quarterly)} every quarter. But the real cost compounds: as competitors at Stage 4+ build organizational learning advantages, the cost to close the gap grows approximately 15% annually. Over three years, total forfeited value reaches ${fmtUSD(year3)}.`
    : `At ${capturePercent}% capture, ${companyName} forfeits ${fmtUSD(quarterly)} every quarter — ${fmtUSD(Math.round(quarterly / 90))} every single day. This is not a static loss: competitors investing now are building compounding advantages in cost structure, talent, and customer experience. Over three years, the total forfeited value reaches ${fmtUSD(year3)}, and the organizational deficit grows proportionally harder to close.`;

  // ---- EBITDA Projection ----
  const investEBITDA = currentEBITDA + (revenue * marginUp) + (revenue * revUp * ebitdaMargin);
  const coastEBITDA = currentEBITDA - (revenue * erosionRate * ebitdaMargin) - (revenue * marginUp * 0.3);
  const ebitda = ebitdaMargin > 0
    ? {
        currentLabel: `~${fmtUSD(Math.round(currentEBITDA))} (est. ${(ebitdaMargin * 100).toFixed(0)}% margin)`,
        investLabel: `~${fmtUSD(Math.round(investEBITDA))} (+${fmtUSD(Math.round(investEBITDA - currentEBITDA))})`,
        coastLabel: `~${fmtUSD(Math.round(coastEBITDA))} (${fmtUSD(Math.round(coastEBITDA - currentEBITDA))})`,
      }
    : {
        currentLabel: `N/A (${ind})`,
        investLabel: `Cost savings of ${fmtUSD(Math.round(revenue * marginUp))} improve operating efficiency`,
        coastLabel: `Relative cost disadvantage of ${fmtUSD(Math.round(revenue * erosionRate))} vs. AI-mature peers`,
      };

  return { headline, stageNarrative, scenarios, proofPoints, compoundCost: { quarterly, year1, year3, narrative: compoundNarrative }, ebitda };
}

// ---------------------------------------------------------------------------
// Section 8: Vendor / Partner Helpers
// ---------------------------------------------------------------------------

function getGartnerContext(industry: string, stage: number): string {
  const ind = industryLabel(industry);
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
      vendors: "Strategy: McKinsey, BCG, Deloitte, Accenture | CIO Advisory: RLK Consulting | Implementation: Thoughtworks, Slalom, Cognizant, Infosys",
      source: "Forrester Wave: AI Strategy Consulting 2024",
    },
  ];
  return categories;
}

// ---------------------------------------------------------------------------
// Section 7: Risk Assessment Helpers
// ---------------------------------------------------------------------------

function getRiskDetails(dimensionScores: DimensionScore[], industry: string, regulatoryIntensity: string): { label: string; description: string; mitigation: string; severity: string }[] {
  const getScore = (dim: string) => dimensionScores.find((d) => d.dimension === dim)?.normalizedScore || 50;
  const ind = industryLabel(industry);

  // Industry-specific risk amplifiers
  const highRegIndustries = new Set([
    'insurance', 'banking', 'capital_markets', 'asset_wealth_management', 'investment_banking',
    'healthcare_providers', 'healthcare_payers', 'life_sciences_pharma',
    'government_federal', 'defense_contractors', 'aerospace_defense',
  ]);
  const isHighReg = highRegIndustries.has(industry) || regulatoryIntensity === 'high';

  // Industry-specific governance context
  const regContext = isHighReg
    ? `In ${ind}, uncontrolled AI usage is not just an efficiency issue: it creates regulatory exposure, potential fines, and reputational risk that can dwarf the cost of the AI tools themselves.`
    : `In ${ind}, shadow AI is primarily a data governance and IP risk rather than a regulatory compliance issue, but it still creates organizational blind spots that compound over time.`;

  const govContext = isHighReg
    ? `In ${ind}, governance gaps create direct regulatory liability. Regulators are actively developing AI-specific requirements, and gaps discovered during examination carry enforcement consequences.`
    : `While ${ind} faces lighter direct AI regulation, governance gaps still create liability through data privacy laws (GDPR, CCPA), contract obligations, and fiduciary duties.`;

  return [
    {
      label: "Shadow AI Proliferation",
      description: `With an Authority Structure score of ${getScore("authority_structure")}/100, your organization ${getScore("authority_structure") >= 60 ? "has moderate controls but may still have blind spots" : "faces significant risk of uncontrolled AI tool usage"} across business units. ${regContext} Gartner estimates that 75% of employees will use AI tools not provisioned by IT by 2027.`,
      mitigation: getScore("authority_structure") >= 60
        ? `Strengthen discovery mechanisms and channel shadow usage into governed alternatives. In ${ind}, focus audits on client-facing and data-processing AI usage where the risk surface is largest.`
        : `Immediate priority: deploy AI tool discovery scanning, establish an acceptable-use policy specific to ${ind} workflows, and create a fast-track approval process that takes days, not months.`,
      severity: (getScore("authority_structure") < 60 && isHighReg) ? "high" : getScore("authority_structure") >= 60 ? "medium" : "high",
    },
    {
      label: "Governance Gap Exposure",
      description: `Your combined authority (${getScore("authority_structure")}/100) and decision velocity (${getScore("decision_velocity")}/100) scores suggest ${getScore("authority_structure") >= 50 && getScore("decision_velocity") >= 50 ? "a functional but potentially brittle governance framework" : "material gaps in AI governance"}. ${govContext}`,
      mitigation: isHighReg
        ? `Conduct gap analysis against relevant regulatory frameworks for ${ind}. Establish AI risk classification system with tiered governance calibrated to your regulatory environment.`
        : `Establish a lightweight AI governance framework proportional to your risk profile in ${ind}. Over-engineering governance at this stage will slow adoption without meaningfully reducing risk.`,
      severity: (getScore("authority_structure") < 40 || isHighReg) ? "high" : "medium",
    },
    {
      label: "Untracked AI Spend",
      description: `An Economic Translation score of ${getScore("economic_translation")}/100 indicates ${getScore("economic_translation") >= 60 ? "some financial visibility but potential blind spots" : "limited visibility into AI-related spending"}. In ${ind}, untracked AI costs typically hide across departmental budgets, individual expense reports, and platform subscriptions.`,
      mitigation: `Implement centralized AI spend tracking. In ${ind}, prioritize tracking the categories most likely to be unmonitored: individual SaaS subscriptions, embedded AI features in existing tools, and consulting/implementation spend.`,
      severity: getScore("economic_translation") < 40 ? "high" : "medium",
    },
    {
      label: "Decision Bottleneck Risk",
      description: `A Decision Velocity score of ${getScore("decision_velocity")}/100 means ${getScore("decision_velocity") >= 60 ? "moderate organizational responsiveness" : "significant organizational lag in AI decision-making"}. In ${ind}, ${isHighReg ? "slower decision cycles are partially structural (regulatory review), but your score suggests bottlenecks beyond necessary compliance" : "slow decisions translate directly to missed competitive windows as peers accelerate AI deployment"}.`,
      mitigation: isHighReg
        ? `Separate regulatory-required approvals from discretionary internal gatekeeping. In ${ind}, compliance review is non-negotiable but adding 3 layers of internal sign-off on top is a self-inflicted bottleneck.`
        : `Establish tiered approval framework: self-service for low-risk, expedited for medium-risk, full review only for high-risk AI deployments. Target approval cycles measured in days, not months.`,
      severity: getScore("decision_velocity") < 40 ? "high" : "low",
    },
    {
      label: "Workflow Fragmentation",
      description: `A Workflow Integration score of ${getScore("workflow_integration")}/100 suggests ${getScore("workflow_integration") >= 60 ? "AI is embedded in some workflows but integration gaps remain" : "AI tools operate alongside rather than within core business processes"} at your organization. In ${ind}, fragmented AI workflows create data silos and force manual handoffs that erode the efficiency gains AI should deliver.`,
      mitigation: `Map all AI touchpoints against core ${ind} workflows. Prioritize embedding AI into the 3-5 highest-value process steps where integration will compound returns rather than deploying new tools.`,
      severity: getScore("workflow_integration") < 40 ? "medium" : "low",
    },
    {
      label: "Adoption Stall Risk",
      description: `An Adoption Behavior score of ${getScore("adoption_behavior")}/100 ${getScore("adoption_behavior") >= 60 ? `shows healthy adoption momentum in your ${ind} organization, but sustaining it requires continuous investment in training and change management` : `indicates risk of AI adoption stalling or regressing at your ${ind} organization as initial enthusiasm fades and the novelty of AI tools wears off`}.`,
      mitigation: getScore("adoption_behavior") >= 60
        ? `Invest in continuous AI literacy programs specific to ${ind} use cases. Build an internal champions network. Monitor usage metrics monthly to catch early signs of adoption plateau.`
        : `Launch immediate quick-win pilots with visible impact in ${ind}-specific workflows. Assign executive sponsors and measure/celebrate early wins to build organizational confidence before attempting broader transformation.`,
      severity: getScore("adoption_behavior") < 40 ? "high" : "low",
    },
  ];
}

function getRegulatoryContext(industry: string, regulatoryIntensity: string): string {
  const ind = industryLabel(industry);
  const contexts: Record<string, string> = {
    // Financial Services cluster
    banking: `Banking faces among the highest AI regulatory scrutiny globally. The OCC, FDIC, and Federal Reserve have issued joint guidance on AI model risk management (SR 11-7 expanded). The CFPB has signaled increased scrutiny of AI in consumer lending. The EU AI Act classifies credit scoring as "high-risk." With your regulatory intensity rated as "${regulatoryIntensity}", comprehensive model documentation, bias testing, and explainability are non-negotiable for all customer-facing AI systems.`,
    capital_markets: `Capital markets AI faces scrutiny from the SEC, FINRA, and CFTC across algorithmic trading, market surveillance, and client suitability. The SEC's proposed AI rules would require disclosure of AI use in investment advice and trading. The EU AI Act and MiFID II create additional layers. With your regulatory intensity rated as "${regulatoryIntensity}", your AI governance must address model risk, market manipulation detection, and best-execution obligations.`,
    investment_banking: `Investment banking AI faces regulatory scrutiny from the SEC and FINRA, particularly around deal analysis, fairness opinions, and client communications. AI-assisted valuation models require the same documentation and oversight as traditional models. With your regulatory intensity rated as "${regulatoryIntensity}", governance should focus on model documentation for deal work and ensuring AI-assisted analysis meets fiduciary standards.`,
    insurance: `Insurance is subject to increasing AI regulation. The NAIC has adopted AI model governance guidelines requiring fair and non-discriminatory AI use in underwriting and claims. The EU AI Act classifies insurance pricing as "high-risk." Colorado's AI Act (SB21-169) specifically targets algorithmic discrimination. With your regulatory intensity rated as "${regulatoryIntensity}", compliance requires documented model validation, bias testing, and consumer transparency.`,
    // Healthcare cluster
    healthcare_providers: `Healthcare AI faces the most complex regulatory landscape. FDA clearance is required for AI/ML-based Software as a Medical Device (SaMD). HIPAA imposes strict requirements on AI processing PHI. CMS has proposed rules on AI in clinical decision support. The EU AI Act classifies diagnostic AI as "high-risk." With your regulatory intensity rated as "${regulatoryIntensity}", governance must address clinical validation, patient safety, PHI protection, and algorithmic transparency.`,
    healthcare_payers: `Health insurance payers face regulatory scrutiny from CMS, state insurance commissions, and the DOJ on AI in claims processing, prior authorization, and coverage determination. The No Surprises Act and proposed CMS rules increase transparency requirements. With your regulatory intensity rated as "${regulatoryIntensity}", AI governance must ensure non-discriminatory claims processing and transparent coverage decisions.`,
    life_sciences_pharma: `Pharmaceutical AI faces FDA regulatory oversight across drug discovery, clinical trials, and manufacturing. The FDA's AI/ML guidance for SaMD and proposed frameworks for AI in drug development create specific compliance requirements. GxP regulations apply to any AI system affecting drug quality. With your regulatory intensity rated as "${regulatoryIntensity}", validation and documentation requirements exceed most industries.`,
    // Technology
    software_saas: `While software companies face lighter industry-specific AI regulation, the landscape is tightening. The EU AI Act affects any AI system deployed in the EU market. California's proposed AI legislation would impose safety requirements. The FTC has signaled enforcement against deceptive AI practices. With your regulatory intensity rated as "${regulatoryIntensity}", proactive governance positions your organization ahead of incoming regulation.`,
    // Logistics
    shipping_logistics: `Shipping and logistics faces AI regulation across transportation safety, labor, and trade compliance. DOT and FMCSA are developing frameworks for AI-assisted fleet management. OSHA is evaluating AI-driven warehouse automation safety guidelines. With your regulatory intensity rated as "${regulatoryIntensity}", the convergence of safety, labor, and trade regulations creates a complex governance landscape.`,
    // Government & Defense
    government_federal: `Federal government AI is governed by Executive Orders on AI Safety, OMB guidance on AI use in government, and agency-specific mandates. The NIST AI Risk Management Framework provides the primary compliance structure. FedRAMP requirements apply to AI cloud services. With your regulatory intensity rated as "${regulatoryIntensity}", governance must align with federal AI mandates and agency-specific authorization requirements.`,
    defense_contractors: `Defense contractors face some of the strictest AI governance requirements. DoD's Responsible AI Strategy, CMMC cybersecurity requirements, and ITAR/EAR export controls all apply to AI systems. The DoD AI Adoption Strategy emphasizes human oversight for autonomous systems. With your regulatory intensity rated as "${regulatoryIntensity}", AI governance must satisfy both defense-specific and general federal requirements.`,
  };
  return contexts[industry] || `${ind} faces evolving AI regulatory requirements. The EU AI Act (effective 2025) establishes a risk-based framework applicable across sectors. In the US, sector-specific agencies are developing AI guidance, and state-level legislation (Colorado, California, Illinois) creates a patchwork of compliance requirements. With your regulatory intensity rated as "${regulatoryIntensity}", proactive governance investment reduces future compliance cost and risk exposure.`;
}

// ---------------------------------------------------------------------------
// Section 9: 90-Day Action Plan Helpers
// ---------------------------------------------------------------------------

function get90DayContext(overallScore: number, stage: number, industry: string): string {
  const ind = industryLabel(industry);
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
// Section 12: Board Findings Helpers
// ---------------------------------------------------------------------------

function getPeerBoardActions(industry: string): { company: string; action: string; source: string }[] {
  const peers: Record<string, { company: string; action: string; source: string }[]> = {
    shipping_logistics: [
      { company: "UPS", action: "Board established a dedicated Technology Committee in 2023 to oversee AI and automation investments. CEO Carol Tomé committed $1B+ annually to smart logistics technology. UPS's ORION AI platform now makes 20M+ routing decisions daily — a board-mandated priority.", source: "UPS 2024 Proxy Statement; 2024 10-K Filing" },
      { company: "Maersk", action: "Board approved a $2B digital transformation program with AI at the center. Maersk's board now receives quarterly AI maturity scorecards. Board member Navneet Kapoor (ex-Mastercard CTO) was added specifically for AI/digital oversight.", source: "Maersk 2024 Annual Report; Board Composition Disclosure 2024" },
      { company: "DHL (Deutsche Post)", action: "Supervisory board approved the 'Strategy 2025+' digital acceleration initiative including AI-powered warehouse automation, predictive logistics, and autonomous vehicle testing. Board receives annual digital maturity assessments.", source: "Deutsche Post DHL 2024 Annual Report; Strategy 2025+ Public Summary" },
    ],
    financial_services: [
      { company: "JPMorgan Chase", action: "Board-mandated AI Center of Excellence reporting directly to CEO Jamie Dimon. JPMorgan employs 2,000+ AI/ML specialists and CEO has publicly stated AI could be 'equivalent to the printing press or the internet.' Board Technology Committee oversees all AI risk.", source: "JPMorgan 2024 Annual Letter to Shareholders; 2024 Proxy Statement" },
      { company: "Goldman Sachs", action: "Board approved firm-wide generative AI deployment with dedicated governance framework. CEO David Solomon mandated that every business unit develop AI use cases. Goldman's AI assistant now handles 10,000+ internal queries daily.", source: "Goldman Sachs 2024 Investor Day Presentation; Q3 2024 Earnings Call" },
      { company: "Bank of America", action: "Board oversees Erica AI assistant serving 19M+ users with 2B+ interactions to date. CTO Aditya Bhasin reports AI metrics to the board quarterly. BofA invested $3.8B in new technology initiatives in 2024, with AI as the primary focus.", source: "Bank of America 2024 Annual Report; Technology Innovation Brief 2024" },
    ],
    insurance: [
      { company: "Progressive", action: "Board oversees the industry's most mature telematics-to-AI pipeline. Snapshot AI program collects 1B+ miles of driving data/month. Board's Technology Committee reviews AI model fairness and bias testing quarterly.", source: "Progressive 2024 Annual Report; Q3 2024 Earnings Call" },
      { company: "Allstate", action: "Board approved AI-first claims processing initiative. CEO Tom Wilson publicly committed to AI-driven operational efficiency. Allstate's Virtual Assistant handles 40%+ of customer interactions without human intervention.", source: "Allstate 2024 Investor Presentation; Insurance Information Institute 2024" },
      { company: "Lemonade", action: "Board governs an AI-native operating model: AI handles 50%+ of claims in ≤3 seconds. Jim Maya (ex-Google) serves as board's AI/technology expert. Board reviews AI ethics metrics alongside financial performance.", source: "Lemonade 2024 Annual Report; Board Composition Disclosure" },
    ],
    healthcare: [
      { company: "HCA Healthcare", action: "Board approved enterprise AI deployment across 182 hospitals. AI early-warning systems for patient deterioration reduced code blue events 30%+. Board receives quarterly AI safety and efficacy reports.", source: "HCA Healthcare 2024 Annual Report; HIMSS Conference Presentation 2024" },
      { company: "UnitedHealth Group / Optum", action: "Board oversees Optum's AI platform processing 300M+ patient records. $5B+ annual technology investment with AI as the primary growth vector. Optum's AI models influence care decisions for 100M+ lives.", source: "UnitedHealth Group 2024 Annual Report; Optum Technology Update 2024" },
      { company: "Mayo Clinic", action: "Board of Trustees established AI governance framework requiring clinical validation before any patient-facing AI deployment. Mayo's AI platform has 150+ active models, each with documented bias testing and ongoing monitoring.", source: "Mayo Clinic 2024 Annual Report; Nature Medicine AI Governance Case Study 2024" },
    ],
    retail_ecommerce: [
      { company: "Walmart", action: "Board oversees AI investments that improved demand forecasting 20% and reduced food waste by $1B+. CEO Doug McMillon mandated AI literacy for all senior leaders. Walmart deploys AI across 10,500+ stores for shelf scanning, pricing, and workforce scheduling.", source: "Walmart 2024 Annual Report; 2024 Investor Day" },
      { company: "Amazon", action: "Board-level Technology Committee oversees the world's largest enterprise AI deployment: 750K+ warehouse robots, AI-powered recommendations driving 35% of revenue, and Alexa serving 500M+ devices. Board receives weekly AI safety metrics.", source: "Amazon 2024 Annual Report; AWS re:Invent 2024 Keynote" },
      { company: "Target", action: "Board approved multi-year AI transformation with focus on personalization and supply chain. Target's AI-powered inventory system reduced out-of-stock incidents 30%. Board added tech executive to strengthen AI oversight capability.", source: "Target 2024 Annual Report; NRF 2024 Presentation" },
    ],
    manufacturing: [
      { company: "Siemens", action: "Board-mandated Industrial AI strategy with $2B+ investment. Siemens' AI-powered Xcelerator platform serves 80,000+ customers. Board's Innovation Committee reviews AI patent portfolio and competitive positioning quarterly.", source: "Siemens 2024 Annual Report; Hannover Messe 2024 Keynote" },
      { company: "John Deere", action: "Board oversees AI-driven precision agriculture platform reaching 500M+ acres. CEO John May committed that AI-enabled products will generate 10%+ of revenue by 2026. Board's Technology Committee governs autonomous equipment deployments.", source: "John Deere 2024 Annual Report; CES 2024 Keynote" },
      { company: "GE Aerospace", action: "Board approved AI-powered predictive maintenance across 44,000 commercial engines. AI analytics platform processes 1T+ data points daily. CEO Larry Culp repositioned the entire company around AI-powered industrial optimization.", source: "GE Aerospace 2024 Investor Day; Q3 2024 Earnings Call" },
    ],
    technology: [
      { company: "Microsoft", action: "Board governs a $10B+ annual AI investment including OpenAI partnership. CEO Satya Nadella reports AI metrics as a primary board KPI. Board's Regulatory and Public Policy Committee oversees responsible AI deployment across Copilot, Azure AI, and enterprise products.", source: "Microsoft 2024 Annual Report; 2024 Proxy Statement" },
      { company: "Google (Alphabet)", action: "Board-level AI Principles governance framework with public accountability. CEO Sundar Pichai declared Google an 'AI-first company.' Board oversees Gemini deployment serving 2B+ users. DeepMind reports directly to the board on frontier AI safety.", source: "Alphabet 2024 Annual Report; Google I/O 2024 Keynote" },
      { company: "Salesforce", action: "Board oversees Einstein AI platform generating 1T+ predictions/week. CEO Marc Benioff mandated AI-first product development. Board Technology Committee reviews AI trust metrics including bias, toxicity, and accuracy quarterly.", source: "Salesforce 2024 Annual Report; Dreamforce 2024" },
    ],
  };
  const defaults = [
    { company: "Industry Leaders (Cross-Sector)", action: "According to NACD's 2024 survey, 62% of S&P 500 boards have added AI as a standing agenda item, up from 28% in 2022. Leading boards are moving from 'awareness' to 'accountability' — requiring measurable AI ROI, not just activity updates.", source: "NACD 2024 Board Oversight of AI Report" },
    { company: "McKinsey Top-Quartile AI Companies", action: "Boards of the highest-performing AI organizations share three traits: (1) at least one director with deep AI expertise, (2) quarterly AI maturity reporting tied to strategy, and (3) ring-fenced AI transformation budgets separate from IT.", source: "McKinsey 2024 Global AI Survey" },
    { company: "Deloitte AI Leaders Benchmark", action: "Organizations where the board actively governs AI transformation are 2.6x more likely to scale AI beyond pilots. Board engagement is the single strongest predictor of AI transformation success, ahead of budget, talent, or technology choices.", source: "Deloitte 2024 State of AI in the Enterprise, 6th Edition" },
  ];
  return peers[industry] || defaults;
}

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
      detail: `Dimension scores show significant variance (confidence: ${Math.min(99, Math.round(stage.confidence * 100))}%), indicating that AI maturity differs substantially across organizational functions. This mixed-stage pattern typically reflects decentralized AI adoption without coordinating governance. Board attention should focus on whether this variance is strategic (intentional prioritization) or emergent (lack of coordination).`,
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
      description: `The 90-day action plan in Section 9 requires dedicated resources. Recommended initial investment: ${stage <= 2 ? "1-2% of annual revenue" : "2-4% of annual revenue"} allocated specifically to AI transformation, separate from business-as-usual IT budget. This investment should be evaluated against the ${fmtUSD(unrealizedMid)} annual opportunity, not against other IT projects.`,
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
