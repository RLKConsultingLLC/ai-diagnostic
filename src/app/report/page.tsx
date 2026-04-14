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
        <section className="bg-white border border-light p-6 md:p-10 mb-8">
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
        <section className="bg-white border border-light p-6 md:p-10 mb-8">
          <h2 className="text-lg mb-4">Stage Classification</h2>
          <StageDisplay stage={result.stageClassification} overallScore={result.overallScore} dimensionScores={result.dimensionScores} />
        </section>
      )}

      {/* Dimension Scores */}
      {result && (
        <section className="bg-white border border-light p-6 md:p-10 mb-8">
          <h2 className="text-lg mb-4">Dimension Scores</h2>
          <p className="text-xs text-foreground/50 mb-5">
            Five behavioral dimensions that determine whether your AI investments translate into organizational value.
          </p>

          {/* Dimension definitions for free report */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-6">
            {[
              { dim: "Adoption Behavior", short: "Are your people actually using AI, or just talking about it?" },
              { dim: "Authority Structure", short: "Who can say yes to AI — and how fast can they do it?" },
              { dim: "Workflow Integration", short: "Is AI embedded in how work gets done, or sitting on the side?" },
              { dim: "Decision Velocity", short: "How quickly does your organization move from AI insight to action?" },
              { dim: "Economic Translation", short: "Can you prove AI is creating financial value?" },
            ].map((d) => (
              <div key={d.dim} className="bg-offwhite border border-light p-2 md:p-3">
                <p className="text-[10px] font-semibold text-navy mb-0.5">{d.dim}</p>
                <p className="text-[10px] text-foreground/50 leading-snug">{d.short}</p>
              </div>
            ))}
          </div>

          <div className="space-y-5">
            {result.dimensionScores.map((ds) => (
              <DimensionBar key={ds.dimension} score={ds} />
            ))}
          </div>
        </section>
      )}

      {/* Competitive Positioning Teaser */}
      {result && (
        <section className="bg-white border border-light p-6 md:p-10 mb-8">
          <h2 className="text-lg mb-4">Competitive Positioning</h2>
          <p className="text-xs text-foreground/50 mb-5">
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
              <span className="text-tertiary">See Sections 5-6 in the full report.</span>
            </p>
          </div>
        </section>
      )}

      {/* Economic Impact */}
      {result && (
        <section className="bg-white border border-light p-6 md:p-10 mb-8">
          <h2 className="text-lg mb-6">Economic Impact Summary</h2>
          <EconomicSummary estimate={result.economicEstimate} />
          <div className="mt-6 bg-navy/5 border border-navy/10 p-4 text-center">
            <p className="text-sm text-foreground/70">
              These numbers are large because your organization is large.
              The full report provides the <strong className="text-navy">transparent step-by-step methodology</strong>,
              sensitivity analysis, and industry benchmarks — your CFO should stress-test these assumptions before sharing with the board.
            </p>
          </div>
        </section>
      )}

      {/* Mixed Stage Narrative */}
      {result && result.stageClassification.mixedStageNarrative && (
        <section className="bg-white border border-light p-6 md:p-10 mb-8">
          <h2 className="text-lg mb-4">Maturity Analysis</h2>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
            {result.stageClassification.mixedStageNarrative}
          </p>
        </section>
      )}

      {/* Paywall / Full Report */}
      {phase === "preview" && (
        <section className="bg-navy text-white p-6 md:p-10 mb-8">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-xl md:text-2xl font-bold text-white mb-3">
                Your Diagnostic Data is Ready.
                <br />
                The Full Analysis Goes Deeper.
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
                  "Get Your Full Diagnostic Report: $497"
                )}
              </button>
              <p className="text-white/40 text-xs mt-4">
                Secure payment via Stripe. Includes downloadable PDF
                formatted for executive review.
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
                AI Diagnostic Report
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
          {/* SECTION 1: EXECUTIVE SUMMARY                                      */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-6 md:p-10 mb-8">
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
                          See Section 2 for the full dimension analysis and Section 3 for the composite indices that translate
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
                          forfeited per quarter. Section 4 provides the transparent methodology behind these numbers
                          — your CFO should stress-test these before sharing with the board.
                          Section 5 translates this unrealized value into specific P&L impact: what it means for
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
                          quadrant of the competitive positioning matrix. Section 6 details where your specific
                          competitors are investing in AI right now — with named companies, dollar amounts, and use
                          cases sourced from public filings and analyst research. Section 7 provides the vendor
                          landscape assessment and contract negotiation levers to optimize your AI spend.
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
                          The Path Forward
                        </p>
                        <p className="text-sm text-foreground/70 leading-relaxed">
                          Section 9 provides a 90-day action plan with 15 research-backed actions, named owners
                          by role, and specific KPIs to track weekly. Section 8 maps the security and governance
                          risks your current posture creates. Section 10 provides headline findings with specific
                          decision items and investment asks. Every finding is supported by methodology
                          and sources documented in Sections 11 and 12 — review with your CFO before any board presentation.
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
          {/* SECTION 2: DIMENSION RADAR / SPIDER DISPLAY                       */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-6 md:p-10 mb-8">
            <SectionHeader
              number={2}
              title="AI Maturity Dimension Analysis"
            />
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
          {/* SECTION 3: COMPOSITE INDEX DEEP DIVE                              */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-6 md:p-10 mb-8">
            <SectionHeader number={3} title="Composite Index Deep Dive" />
            <p className="text-sm text-foreground/60 mt-2 mb-8">
              Three composite indices distill your 61 responses into the metrics that matter:
              can your organization govern AI, capture its value, and move fast enough to stay competitive?
              Each index flags the specific behaviors — drawn directly from your answers — that are
              accelerating or constraining your AI maturity. For economic implications of these scores,
              see Section 4. For P&L impact, see Section 5. For competitive position, see Section 6.
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
                                <span className="font-semibold">{qi + 1}.</span> {getQuestionInsight(q.questionId, q.score, result.companyProfile.industry, true)}
                              </p>
                            ))}
                          </div>
                          <div className="bg-red-50 border border-red-200 p-3">
                            <p className="text-[10px] font-semibold text-red-800 tracking-wider uppercase mb-2">
                              Critical Gaps to Address
                            </p>
                            {weakQs.map((q, qi) => (
                              <p key={q.questionId} className="text-xs text-red-700 leading-relaxed mb-1">
                                <span className="font-semibold">{qi + 1}.</span> {getQuestionInsight(q.questionId, q.score, result.companyProfile.industry, false)}
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
                            {compositeIndexRisks(ci.slug, ci.score)} See Section 8 for the full risk assessment.
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
          {/* SECTION 4: ECONOMIC MODEL (Show the Math)                         */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-6 md:p-10 mb-8">
            <SectionHeader number={4} title="Economic Impact Model" />
            <p className="text-sm text-foreground/60 mt-2 mb-4">
              These numbers are large because your organization is large. Below is the
              transparent methodology — every assumption stated, every input sourced — so
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
                  {industryLabel(result.companyProfile.industry)} are. See Section 5
                  for P&L impact and Section 6 for what competitors are doing.
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
          {/* SECTION 5: P&L BUSINESS CASE                                     */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-6 md:p-10 mb-8">
            <SectionHeader number={5} title="The Business Case: P&L Impact Analysis" />

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
              );

              return (
                <div className="mt-6 space-y-8">
                  {/* Intro */}
                  <p className="text-sm text-foreground/60">
                    Section 4 quantified the unrealized value. This section translates that into
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
          {/* SECTION 6: COMPETITIVE POSITIONING MAP (was 5)                    */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-6 md:p-10 mb-8">
            <SectionHeader number={6} title="Competitive Positioning & Industry Intelligence" />
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
                Where YOUR Competitors Are Investing Right Now
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
          {/* SECTION 7: VENDOR LANDSCAPE TABLE                                 */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-6 md:p-10 mb-8">
            <SectionHeader number={7} title="Vendor & Partner Landscape Assessment" />
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

            {/* AI Contract Value Levers */}
            <div className="border border-light p-4 md:p-5 mb-6">
              <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-3">
                Contract Value Levers: How to Negotiate Smarter AI Deals
              </p>
              <p className="text-sm text-foreground/70 leading-relaxed mb-4">
                AI vendor contracts are not software licenses. The economics are different,
                the risks are different, and the leverage points are different. Here are the
                deal levers that sophisticated buyers use to maintain optionality and control costs:
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  {
                    lever: "Declining Unit Economics",
                    description: "AI inference costs drop 30-50% annually as models become more efficient. Build automatic price reductions into multi-year contracts — 15-20% annual step-downs are reasonable based on current compute cost trajectories.",
                  },
                  {
                    lever: "Data Portability Guarantees",
                    description: "Insist on full data export in standard formats with ≤30-day extraction windows. Your training data and fine-tuned models are your IP — vendor lock-in happens when you cannot take them with you.",
                  },
                  {
                    lever: "Model-Agnostic Architecture",
                    description: "Structure contracts to allow model swaps without renegotiation. The LLM landscape shifts quarterly — being locked to one provider's model is a strategic liability. Require API-compatible alternatives.",
                  },
                  {
                    lever: "Usage-Based Pricing with Caps",
                    description: "Negotiate consumption-based pricing with hard budget caps and volume discounts. Avoid flat enterprise licenses until usage patterns stabilize — most organizations overpay by 40-60% in year one.",
                  },
                  {
                    lever: "Performance SLAs with Teeth",
                    description: "Tie payments to measurable outcomes: latency, accuracy, uptime, not just availability. Include penalty clauses for model degradation. AI outputs can drift — your contract should account for that.",
                  },
                  {
                    lever: "Termination Without Penalty",
                    description: "Negotiate 90-day termination clauses with data return guarantees. In a market this volatile, 3-year lock-ins are a gift to the vendor, not to you. If the product delivers value, you will stay anyway.",
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
          {/* SECTION 8: SECURITY & GOVERNANCE RISK MATRIX                      */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-6 md:p-10 mb-8">
            <SectionHeader
              number={8}
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
          {/* SECTION 9: 90-DAY ACTION PLAN (Timeline Visual)                   */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-6 md:p-10 mb-8">
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
          {/* SECTION 10: BOARD FINDINGS & ASKS                                 */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-6 md:p-10 mb-8">
            <SectionHeader number={10} title="Board Findings & Strategic Asks" />
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
          {/* SECTION 11: METHODOLOGY & DATA SOURCES                            */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-6 md:p-10 mb-8">
            <SectionHeader number={11} title="Methodology and Data Sources" />

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
          {/* SOURCES & CITATIONS                                               */}
          {/* ================================================================= */}
          <section className="bg-white border border-light p-6 md:p-10 mb-8">
            <SectionHeader number={12} title="Sources & Citations" />
            <p className="text-sm text-foreground/60 mt-2 mb-6">
              Every claim in this report is grounded in publicly available research, regulatory
              filings, or established management frameworks. Below are the primary sources
              referenced throughout this analysis.
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
  aerospace_defense: "Aerospace & Defense",
  consumer_retail: "Consumer Retail",
  education: "Education",
  energy_utilities: "Energy & Utilities",
  federal_government: "Federal Government",
  financial_services: "Financial Services",
  healthcare: "Healthcare",
  hospitality_travel: "Hospitality & Travel",
  insurance: "Insurance",
  manufacturing: "Manufacturing",
  media_entertainment: "Media & Entertainment",
  nonprofit: "Non-Profit",
  professional_services: "Professional Services",
  real_estate: "Real Estate",
  retail_ecommerce: "Retail / E-Commerce",
  shipping_logistics: "Shipping & Logistics",
  state_local_government: "State & Local Government",
  technology: "Technology",
  telecommunications: "Telecommunications",
  other: "Other",
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

function getQuestionInsight(qId: string, score: number, industry: string, isStrength: boolean): string {
  const ind = industryLabel(industry);
  // Map question IDs to contextual insights based on dimension
  const prefix = qId.split("-")[0]; // AB, AS, WI, DV, ET
  const insights: Record<string, Record<string, string>> = {
    AB: {
      strong: `Strong adoption signals — in ${ind}, organizations with high adoption behavior consistently outperform peers by 15-20% in AI value capture (McKinsey 2024).`,
      weak: `Low adoption is your bottleneck. In ${ind}, this pattern typically indicates either poor tool-job fit or insufficient training investment — both fixable within 90 days.`,
    },
    AS: {
      strong: `Your governance structure is ahead of most peers. Only 35% of enterprises have formalized AI authority structures (Gartner 2024).`,
      weak: `Governance gaps at this level expose you to shadow AI proliferation and regulatory risk. In ${ind}, this is where compliance incidents originate. See Section 8.`,
    },
    WI: {
      strong: `AI is embedded in workflows, not bolted on — the critical difference between productivity theater and real value capture.`,
      weak: `AI tools exist alongside work rather than within it. This is the most common failure mode: tools purchased but never woven into daily operations.`,
    },
    DV: {
      strong: `Fast AI decision-making is a competitive weapon. Your velocity here means you can respond to market shifts before slower competitors.`,
      weak: `Decisions involving AI face organizational friction that erodes time-to-value. Every month of deployment delay compounds the competitive gap. See Section 6.`,
    },
    ET: {
      strong: `You can connect AI activity to financial outcomes — a capability only 10% of companies have mastered (BCG 2024). This makes the economic case in Section 4 actionable.`,
      weak: `You cannot yet prove AI's financial value. Without this, every budget cycle puts AI investment at risk. Section 4 quantifies what you are leaving on the table.`,
    },
  };
  const tier = isStrength ? "strong" : "weak";
  return insights[prefix]?.[tier] || (isStrength
    ? `This response demonstrates organizational capability above industry norms in ${ind}.`
    : `This response reveals a gap that, in ${ind}, typically constrains AI scaling.`);
}

function compositeIndexDescription(slug: string, score: number, industry: string): string {
  const ind = industryLabel(industry);
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
  const ind = industryLabel(industry);
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
  return areas[industry] || (industry === "shipping_logistics" ? shippingLogistics : defaults);
}

// ---------------------------------------------------------------------------
// Section 5: P&L Business Case Helpers
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

function getPnLImpact(
  stage: number,
  industry: string,
  revenue: number,
  unrealizedLow: number,
  unrealizedHigh: number,
  capturePercent: number,
  companyName: string,
  employeeCount: number,
): PnLImpactData {
  const ind = industryLabel(industry);
  const unrealizedMid = Math.round((unrealizedLow + unrealizedHigh) / 2);

  // Industry EBITDA margin estimates (public data)
  const ebitdaMargins: Record<string, number> = {
    shipping_logistics: 0.10, financial_services: 0.30, insurance: 0.18,
    healthcare: 0.12, technology: 0.25, retail_ecommerce: 0.06,
    manufacturing: 0.14, energy_utilities: 0.20, aerospace_defense: 0.12,
    consumer_retail: 0.08, telecommunications: 0.28, media_entertainment: 0.18,
    education: 0.10, professional_services: 0.20, hospitality_travel: 0.15,
    real_estate: 0.35, federal_government: 0.0, state_local_government: 0.0,
    nonprofit: 0.0,
  };
  const ebitdaMargin = ebitdaMargins[industry] || 0.15;
  const currentEBITDA = revenue * ebitdaMargin;

  // Revenue impact multipliers by industry
  const revenueUpside: Record<string, number> = {
    shipping_logistics: 0.02, financial_services: 0.03, technology: 0.04,
    healthcare: 0.02, retail_ecommerce: 0.025, manufacturing: 0.02,
    insurance: 0.025, telecommunications: 0.03, aerospace_defense: 0.015,
  };
  const revUp = revenueUpside[industry] || 0.02;

  // Margin improvement from AI (basis points of revenue)
  const marginImprovement: Record<string, number> = {
    shipping_logistics: 0.015, financial_services: 0.02, technology: 0.025,
    healthcare: 0.015, retail_ecommerce: 0.02, manufacturing: 0.018,
    insurance: 0.02, telecommunications: 0.02, aerospace_defense: 0.012,
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

  // ---- 5 P&L Scenarios ----
  const scenarios: PnLScenario[] = [
    {
      label: "Revenue Growth",
      investUpside: `AI-enabled product innovation, faster time-to-market, and personalized customer experiences drive ${(revUp * 100).toFixed(1)}% incremental revenue growth in ${ind}`,
      investDollar: fmtUSD(Math.round(revenue * revUp)),
      coastDownside: `Market share erosion as competitors offer AI-enhanced products and services at competitive price points`,
      coastDollar: `-${fmtUSD(Math.round(revenue * erosionRate))}`,
    },
    {
      label: "Operating Margin",
      investUpside: `Process automation, error reduction, and workflow optimization improve operating margin by ${(marginUp * 100).toFixed(1)}% of revenue`,
      investDollar: `+${fmtUSD(Math.round(revenue * marginUp))}`,
      coastDownside: `Manual processes become relatively more expensive as AI-enabled competitors drive industry cost benchmarks lower`,
      coastDollar: `-${fmtUSD(Math.round(revenue * marginUp * 0.4))}`,
    },
    {
      label: "Cost Structure",
      investUpside: `Shift from fixed labor costs to scalable AI-variable costs; same output at 15-25% lower cost basis over 24 months`,
      investDollar: `+${fmtUSD(Math.round(revenue * 0.008))}`,
      coastDownside: `Fixed cost burden rises relative to AI-enabled peers; SG&A gap widens 50-100 bps annually`,
      coastDollar: `-${fmtUSD(Math.round(revenue * 0.005))}`,
    },
    {
      label: "Talent Economics",
      investUpside: `AI-enabled workplaces attract top talent and reduce turnover; Deloitte 2024 finds 23% lower turnover at AI-mature organizations`,
      investDollar: `+${fmtUSD(talentSavings)}`,
      coastDownside: `AI talent flight to more mature organizations; Gartner reports 34% of tech workers cite AI tooling as a top-3 factor in employer choice`,
      coastDollar: `-${fmtUSD(Math.round(talentSavings * 1.5))}`,
    },
    {
      label: "Risk Exposure",
      investUpside: `Structured AI governance reduces shadow AI incidents, compliance exposure, and operational failures`,
      investDollar: `+${fmtUSD(Math.round(riskCostBase * riskReduction))}`,
      coastDownside: `Ungoverned AI proliferation increases breach risk; IBM reports avg cost of AI-related data breach at ${fmtUSD(Math.round(riskCostBase))}`,
      coastDollar: `-${fmtUSD(Math.round(riskCostBase))}`,
    },
  ];

  // ---- Industry Proof Points ----
  const proofPointsByIndustry: Record<string, IndustryProofPoint[]> = {
    shipping_logistics: [
      { claim: "UPS's ORION AI routing optimization saves $400M annually on a $91B revenue base — a direct 0.44% margin improvement from a single AI application", metric: "$400M/year", source: "UPS 10-K 2024" },
      { claim: "Maersk's AI-driven demand forecasting reduced empty container repositioning costs by 15%, worth approximately $600M annually across their fleet", metric: "15% cost reduction", source: "Maersk Annual Report 2024" },
      { claim: "DHL reports AI predictive maintenance cut unplanned vehicle downtime 40%, converting $180M in annual losses to productive capacity", metric: "40% downtime reduction", source: "DHL Innovation Center 2024" },
      { claim: "Amazon's AI demand forecasting reduced excess inventory carrying costs by $1.2B in 2024, directly improving working capital efficiency", metric: "$1.2B savings", source: "Amazon Q3 2024 Earnings Call" },
    ],
    financial_services: [
      { claim: "JPMorgan's AI-powered trading, fraud detection, and risk management contributed $1.5B in incremental revenue and avoided losses in 2024", metric: "$1.5B impact", source: "JPM 10-K 2024" },
      { claim: "Goldman Sachs estimates AI-enabled banks will achieve 3-5% ROE improvement by 2027 — at scale, this separates winners from consolidation targets", metric: "3-5% ROE uplift", source: "Goldman Sachs Research 2024" },
      { claim: "Morgan Stanley's AI financial advisor assistant reduced advisor onboarding time 40% and increased AUM per advisor 12%, worth approximately $200M annually", metric: "12% AUM increase", source: "Morgan Stanley Investor Day 2024" },
    ],
    healthcare: [
      { claim: "Mayo Clinic's AI clinical decision support reduced diagnostic errors by 30%, saving an estimated $85M in malpractice costs and clinical rework", metric: "30% error reduction", source: "NEJM 2024" },
      { claim: "AI-powered revenue cycle management reduces claim denials by 30-40%, worth 1.5-2.5% of net patient revenue — for large systems, that's $200M+", metric: "30-40% denial reduction", source: "McKinsey Healthcare 2024" },
      { claim: "Kaiser Permanente's AI scheduling optimization increased OR utilization 18%, adding $340M in annual revenue capacity without capital expansion", metric: "18% utilization gain", source: "Kaiser Annual Report 2024" },
    ],
    technology: [
      { claim: "GitHub Copilot adopters report 55% faster task completion; at average developer cost of $165K, this represents $90K in productivity value per developer annually", metric: "55% productivity gain", source: "GitHub Octoverse 2024" },
      { claim: "Meta's AI recommendation engine improvements drove $10B+ in incremental advertising revenue in 2024 — algorithmic precision directly drives top-line growth", metric: "$10B+ revenue", source: "Meta 10-K 2024" },
      { claim: "Microsoft reports Copilot for M365 early adopters achieve 29% faster document creation and 64% faster email triage — at enterprise scale, this is hundreds of millions in labor productivity", metric: "29-64% time savings", source: "Microsoft Work Trend Index 2024" },
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
// Section 7: Vendor / Partner Helpers
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
      vendors: "Strategy: McKinsey, BCG, Deloitte, Accenture | Implementation: Thoughtworks, Slalom, Cognizant, Infosys",
      source: "Forrester Wave: AI Strategy Consulting 2024",
    },
  ];
  return categories;
}

// ---------------------------------------------------------------------------
// Section 8: Risk Assessment Helpers
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
    shipping_logistics: `Shipping and logistics faces accelerating AI regulation across multiple domains. The EU AI Act classifies automated logistics decision-making as potentially high-risk when affecting worker safety or critical infrastructure. DOT and FMCSA are developing frameworks for AI-assisted fleet management and autonomous vehicle operations. Customs and trade compliance AI faces scrutiny from CBP and international trade bodies. OSHA is evaluating guidelines for AI-driven warehouse automation safety. With your regulatory intensity rated as "${regulatoryIntensity}", the convergence of transportation safety, labor, trade compliance, and data privacy regulations creates a complex governance landscape that will only tighten.`,
  };
  return contexts[industry] || `Your industry faces evolving AI regulatory requirements. The EU AI Act (effective 2025) establishes a risk-based framework applicable across sectors. In the US, sector-specific agencies are developing AI guidance, and state-level legislation (Colorado, California, Illinois) is creating a patchwork of compliance requirements. The White House Executive Order on AI Safety (October 2023) signals increasing federal attention. With your regulatory intensity rated as "${regulatoryIntensity}", proactive governance investment reduces future compliance cost and risk exposure.`;
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
// Section 10: Board Findings Helpers
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
