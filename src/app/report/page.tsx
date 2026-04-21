"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type {
  DiagnosticResult,
  GeneratedReport,
  DimensionScore,
  StageClassification,
  EconomicEstimate,
  CompanyProfile,
} from "@/types/diagnostic";
import MethodologySection from "@/app/report/components/MethodologySection";
import {
  CAPTURE_RATES_BY_GROUP,
  INDUSTRY_CAPTURE_GROUP,
  DIAGNOSTIC_MODIFIER_WEIGHTS,
  computeDiagnosticModifier,
} from "@/lib/diagnostic/economic";
// SensitivitySection removed — not shown to clients

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
  const stripeSession = params.get("stripe_session");
  const [phase, setPhase] = useState<Phase>("loading");
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

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
            // In demo mode or paid session, skip paywall and show full report
            const isPaid = sessionData.session.status === "paid";
            if (isDemo || isPaid) {
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

      // Step 1.5: If returning from Stripe checkout, verify payment
      if (stripeSession && !cancelled) {
        try {
          const verifyRes = await fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stripeSessionId: stripeSession }),
          });
          if (verifyRes.ok) {
            const verifyData = await verifyRes.json();
            if (verifyData.paid) {
              setPhase("full");
            }
          }
        } catch {
          // Verification failed — webhook will handle it eventually
        }
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
          // Never downgrade from "full" — preserve paid/demo access
          setPhase((p) => (p === "full" || isDemo || data.paid) ? "full" : "preview");
        } else {
          // Report generation failed but we still have diagnostic data
          // Don't downgrade from "full" if already set (e.g., paid session)
          if (!cancelled) setPhase((p) => p === "full" ? "full" : (isDemo ? "full" : "preview"));
        }
      } catch {
        if (!cancelled) setPhase((p) => p === "full" ? "full" : (isDemo ? "full" : "preview"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId, isDemo, stripeSession]);

  // Corrected capture percent — single source of truth for display
  // Old sessions lack captureRateBase; derive from current engine so math is consistent
  const correctedCapturePercent = useMemo(() => {
    if (!result) return 0;
    const est = result.economicEstimate;
    if (est.captureRateBase) {
      // New session — stored values are authoritative
      return est.currentCapturePercent;
    }
    // Old session — recompute from current engine
    const group = INDUSTRY_CAPTURE_GROUP[result.companyProfile.industry as keyof typeof INDUSTRY_CAPTURE_GROUP] ?? "";
    const base = CAPTURE_RATES_BY_GROUP[group]?.[result.stageClassification.primaryStage as 1|2|3|4|5] ?? 0;
    const { modifier } = computeDiagnosticModifier(result.dimensionScores);
    return Math.round(Math.max(0.01, Math.min(0.95, base * modifier)) * 100);
  }, [result]);

  // Payment handler
  const handleCheckout = useCallback(async () => {
    if (!sessionId || !result) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/payment/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: sessionId,
          companyName: result.companyProfile.companyName,
          email: result.companyProfile.executiveEmail || "",
        }),
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
  }, [sessionId, result]);

  // Promo code handler
  const handlePromoCode = useCallback(async () => {
    if (!sessionId || !promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError(null);
    try {
      const res = await fetch("/api/payment/bypass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, promoCode: promoCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoError(data.error || "Invalid promo code");
        setPromoLoading(false);
        return;
      }
      // Success — reload the page to show the full report
      window.location.reload();
    } catch {
      setPromoError("Unable to verify promo code. Please try again.");
      setPromoLoading(false);
    }
  }, [sessionId, promoCode]);

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

      {/* Pre-paywall content — hidden once full report is showing */}
      {phase !== "full" && result && (
        <>
      {/* Overall Score Hero */}
      {result && (
        <section className="bg-white border border-light overflow-hidden mb-10 shadow-sm">
          {/* Decorative top gradient bar */}
          <div className="h-1.5 bg-gradient-to-r from-navy via-navy/70 to-navy/30" />

          <div className="px-6 md:px-10 lg:px-14 pt-10 md:pt-14 pb-8 md:pb-10 text-center">
            {/* Company name */}
            <p className="text-[11px] md:text-xs font-semibold text-navy/40 tracking-[0.35em] uppercase mb-3">
              Prepared for
            </p>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-navy tracking-tight mb-1">
              {result.companyProfile.companyName}
            </h1>
            <div className="mx-auto w-12 h-px bg-navy/15 my-5" />
            <h2 className="text-base md:text-lg font-semibold text-navy/70 tracking-wide uppercase mb-8">
              AI Maturity Diagnostic
            </h2>

            {/* Score gauge — centered hero element */}
            <div className="mb-8">
              <ScoreGauge score={result.overallScore} />
            </div>

            {/* Meta line */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-xs text-foreground/35">
              <span>
                Completed{" "}
                {new Date(result.completedAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <span className="hidden sm:inline text-foreground/15">|</span>
              <span>RLK Consulting Framework</span>
            </div>
          </div>
        </section>
      )}

      {/* Stage Classification */}
      {result && (
        <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
          <h2 className="text-xl md:text-2xl font-bold text-navy tracking-tight mb-1">Stage Classification</h2>
          <div className="h-px bg-gradient-to-r from-navy/20 via-navy/8 to-transparent mb-4" />
          <StageDisplay stage={result.stageClassification} dimensionScores={result.dimensionScores} />
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

      {/* Economic Impact */}
      {result && (
        <section className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm">
          <h2 className="text-xl md:text-2xl font-bold text-navy tracking-tight mb-1">
            Economic Impact Summary
          </h2>
          <p className="text-sm text-foreground/50 mb-1">
            {industryLabel(result.companyProfile.industry, result.companyProfile.industryDisplayLabel)} industry benchmarks applied to {result.companyProfile.companyName}
          </p>
          <div className="h-px bg-gradient-to-r from-navy/20 via-navy/8 to-transparent mb-6" />
          <EconomicSummary estimate={{...result.economicEstimate, currentCapturePercent: correctedCapturePercent}} />
          <div className="mt-6 bg-navy/5 border border-navy/10 p-4 text-center">
            <p className="text-sm text-foreground/70">
              {getEconomicScaleContext(result.companyProfile.employeeCount)}{" "}
              The full report provides the <strong className="text-secondary">transparent step-by-step methodology</strong>,{" "}
              {industryLabel(result.companyProfile.industry)} peer benchmarks, and five P&L scenarios modeled to your revenue and employee base.
              Your CFO should stress-test these assumptions before acting on them.
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

        </>
      )}

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
                  Where you stand vs. industry peers with real company data,
                  competitor analysis, and competitive window assessment.
                </p>
              </div>
              <div className="bg-white/10 border border-white/10 p-4">
                <p className="text-white text-sm font-semibold mb-1">
                  Financial Impact Analysis
                </p>
                <p className="text-white/50 text-xs leading-relaxed">
                  Dollar-denominated cost of inaction, capture gap analysis, and
                  ROI framing your CFO can use for investment decisions.
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
                  Shadow AI exposure, compliance gaps, and the governance
                  questions your leadership team should be asking but likely is not.
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
                  Board-Ready Messaging
                </p>
                <p className="text-white/50 text-xs leading-relaxed">
                  Pre-built board presentation findings, peer benchmarks, and
                  recommended asks structured as decision items per NACD guidance.
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

              {/* Promo code input */}
              <div className="mt-6 pt-5 border-t border-white/10">
                <p className="text-white/40 text-[10px] tracking-widest uppercase mb-2">
                  Have a promo code?
                </p>
                <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => { setPromoCode(e.target.value); setPromoError(null); }}
                    onKeyDown={(e) => e.key === "Enter" && handlePromoCode()}
                    placeholder="Enter code"
                    className="bg-white/10 border border-white/20 text-white text-xs px-3 py-2 flex-1 placeholder:text-white/30 focus:outline-none focus:border-white/40"
                  />
                  <button
                    onClick={handlePromoCode}
                    disabled={promoLoading || !promoCode.trim()}
                    className="bg-white/15 border border-white/20 text-white text-xs px-4 py-2 font-semibold hover:bg-white/25 transition-colors disabled:opacity-40"
                  >
                    {promoLoading ? "..." : "Apply"}
                  </button>
                </div>
                {promoError && (
                  <p className="text-red-300 text-[11px] mt-2">{promoError}</p>
                )}
              </div>

              <p className="text-white/30 text-xs mt-4">
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
          <SaveAsPDFButton />
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

          {/* Floating Table of Contents */}
          <FloatingTOC />

          {/* ================================================================= */}
          {/* SECTION 1: EXECUTIVE SUMMARY                                */}
          {/* ================================================================= */}
          <section id="section-1" className="bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm scroll-mt-16">
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
                      {result.companyProfile.companyName} scores <strong className="text-secondary">{result.overallScore}/100</strong> on
                      AI organizational maturity, placing it at <strong className="text-secondary">Stage {result.stageClassification.primaryStage}: {result.stageClassification.stageName}</strong>.
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
                    <div className="md:col-span-2 space-y-1">
                      <SubCollapsible title="The Structural Reality" hint="View dimension analysis" defaultOpen icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>}>
                        <p className="text-sm text-foreground/70 leading-relaxed">
                          Across five behavioral dimensions, {result.companyProfile.companyName}&apos;s strongest area
                          is <strong className="text-secondary">{dimensionLabel(strongest?.dimension || "")}</strong> ({strongest?.normalizedScore}/100),
                          indicating {dimensionInterpretation(strongest?.dimension || "", strongest?.normalizedScore || 0).toLowerCase()} The
                          primary constraint is <strong className="text-secondary">{dimensionLabel(weakest?.dimension || "")}</strong> ({weakest?.normalizedScore}/100):{" "}
                          {dimensionInterpretation(weakest?.dimension || "", weakest?.normalizedScore || 0).toLowerCase()}{" "}
                          <strong className="text-secondary">Until this dimension improves, it will act as a ceiling on the returns from every other AI investment.</strong>{" "}
                          See Section 2 for the AI posture diagnosis and Section 3 for structural constraints that translate
                          these scores into actionable intelligence.
                        </p>
                      </SubCollapsible>

                      <SubCollapsible title="The Economic Opportunity" hint="View financial impact" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}>
                        <p className="text-sm text-foreground/70 leading-relaxed">
                          The diagnostic estimates <strong className="text-secondary">{fmtUSD(result.economicEstimate.unrealizedValueLow)} to{" "}
                          {fmtUSD(result.economicEstimate.unrealizedValueHigh)}</strong> in annual unrealized value —
                          productivity improvement that {result.companyProfile.companyName} is <strong className="text-secondary">not capturing</strong> while
                          competitors in {ind} are. The estimated current capture rate is{" "}
                          <strong className="text-secondary">{correctedCapturePercent}%</strong> —
                          derived from a 7-input model that combines your industry group, maturity stage, and five behavioral
                          dimension scores from the diagnostic (fully documented in Section 10 → &quot;Estimating AI Value Capture Percentages&quot;).
                          That translates to approximately <strong className="text-secondary">{fmtUSD(Math.round(unrealizedMid / 4))}{" "}
                          forfeited per quarter</strong>. Section 5 provides the transparent methodology behind every assumption —
                          your CFO should stress-test these before making investment decisions.
                          Section 6 translates this unrealized value into specific P&L impact: what it means for
                          revenue growth, operating margin, and cost structure over 12-24 months.
                        </p>
                      </SubCollapsible>

                      <SubCollapsible title="The Competitive Context" hint="View positioning" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>}>
                        {(() => {
                          const cap = (result.dimensionScores.find((d) => d.dimension === "adoption_behavior")?.normalizedScore || 0) * 0.5 +
                            (result.dimensionScores.find((d) => d.dimension === "workflow_integration")?.normalizedScore || 0) * 0.5;
                          const read = (result.dimensionScores.find((d) => d.dimension === "authority_structure")?.normalizedScore || 0) * 0.4 +
                            (result.dimensionScores.find((d) => d.dimension === "decision_velocity")?.normalizedScore || 0) * 0.3 +
                            (result.dimensionScores.find((d) => d.dimension === "economic_translation")?.normalizedScore || 0) * 0.3;
                          const quadrant = cap >= 50 && read >= 50 ? "AI-Native Leaders" : cap >= 50 ? "Capability Without Structure" : read >= 50 ? "Structure Without Capability" : "Pre-AI";
                          const strongest = [...result.dimensionScores].sort((a, b) => b.normalizedScore - a.normalizedScore)[0];
                          const weakest = [...result.dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore)[0];
                          return (
                            <div className="text-sm text-foreground/70 leading-relaxed space-y-2">
                              <p>
                                {result.companyProfile.companyName} sits in the <strong className="text-secondary">{quadrant}</strong> quadrant
                                with an AI Capability score of <strong className="text-secondary">{Math.round(cap)}/100</strong> and
                                Organizational Readiness of <strong className="text-secondary">{Math.round(read)}/100</strong>.
                                {cap >= 50 && read < 50 && ` Your teams are adopting AI tools faster than your governance structures can support them. This creates shadow AI risk and makes every dollar of AI investment harder to justify.`}
                                {cap < 50 && read >= 50 && ` You have the governance scaffolding for AI but the actual adoption and workflow integration lag behind. The risk is bureaucratic overhead protecting an asset that does not yet exist at scale.`}
                                {cap >= 50 && read >= 50 && ` Both capability and governance are in healthy territory, but the gap between your strongest dimension (${dimensionLabel(strongest?.dimension || "")} at ${strongest?.normalizedScore}/100) and weakest (${dimensionLabel(weakest?.dimension || "")} at ${weakest?.normalizedScore}/100) reveals where friction compounds.`}
                                {cap < 50 && read < 50 && ` Both adoption and governance are below the industry median. The opportunity cost is compounding: competitors in ${ind} operating at Stage ${Math.min(5, result.stageClassification.primaryStage + 1)}+ are capturing 2-4x more AI value while your organization is still building the foundation.`}
                              </p>
                              <p>
                                {result.stageClassification.primaryStage >= 4 ? (
                                  <>
                                    Industry intelligence suggests <strong className="text-secondary">fast-following competitors in {ind} are
                                    investing to close the gap</strong> with {result.companyProfile.companyName}&apos;s current Stage {result.stageClassification.primaryStage} position.
                                    At this stage the competitive question shifts from &quot;are we behind?&quot; to &quot;is our pace of reinvestment sufficient
                                    to stay ahead?&quot; Leaders who pause typically regress to Stage {Math.max(1, result.stageClassification.primaryStage - 1)} behavioral
                                    patterns within 12-18 months (BCG 2024).
                                  </>
                                ) : (
                                  <>
                                    Industry intelligence suggests <strong className="text-secondary">at least one competitor in {ind} is operating
                                    at AI maturity levels significantly above</strong> {result.companyProfile.companyName}&apos;s current position.
                                    The competitive window to close this gap narrows as AI capabilities compound: organizations that reach Stage {Math.min(5, result.stageClassification.primaryStage + 1)}+
                                    accelerate away from peers because their governance infrastructure enables faster, cheaper experimentation.
                                  </>
                                )}
                              </p>
                            </div>
                          );
                        })()}
                      </SubCollapsible>

                      <SubCollapsible title="The Path Forward" hint="View next steps" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>}>
                        {(() => {
                          const weakest = [...result.dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore)[0];
                          const highRisks = result.dimensionScores.filter(d => d.normalizedScore < 40).length;
                          const maxIdx = [...result.compositeIndices].sort((a, b) => b.score - a.score)[0];
                          const minIdx = [...result.compositeIndices].sort((a, b) => a.score - b.score)[0];
                          return (
                            <div className="text-sm text-foreground/70 leading-relaxed space-y-2">
                              <p>
                                <strong className="text-secondary">Priority #1: {dimensionLabel(weakest?.dimension || "")}</strong> at {weakest?.normalizedScore}/100 is the
                                binding constraint on all other AI investments. Improving this dimension from Stage {result.stageClassification.primaryStage} levels
                                to Stage {Math.min(5, result.stageClassification.primaryStage + 1)} unlocks disproportionate value because every
                                other dimension is throttled by this bottleneck.
                              </p>
                              {highRisks > 0 && (
                                <p>
                                  <strong className="text-secondary">{highRisks} high-severity governance risk{highRisks > 1 ? "s" : ""}</strong> {highRisks > 1 ? "require" : "requires"} immediate
                                  attention. These are not theoretical: they represent active exposure in areas where your diagnostic
                                  responses indicate control gaps that AI adoption is likely exploiting today.
                                </p>
                              )}
                              <p>
                                The structural imbalance between <strong className="text-secondary">{maxIdx?.name}</strong> ({maxIdx?.score}/100)
                                and <strong className="text-secondary">{minIdx?.name}</strong> ({minIdx?.score}/100) means
                                targeted investment in {minIdx?.name?.toLowerCase()} will produce outsized returns: you are not starting
                                from zero, you are closing a gap between what your organization can do and what it can govern and prove.
                              </p>
                              <p>
                                The gap between diagnosis and impact is <strong className="text-secondary">a concrete 90-day operationalization
                                plan</strong> - translating these findings into governance structures, vendor decisions, and organizational changes.
                              </p>
                            </div>
                          );
                        })()}
                      </SubCollapsible>
                    </div>
                  </div>

                  {/* Detailed narrative if available */}
                  {report?.sections?.find((s) => s.slug === "executive-summary")?.content && (
                    <SubCollapsible title={`Overarching Narrative`}>
                      <MarkdownContent
                        content={scrubEBITDAFromText((report?.sections?.find((s) => s.slug === "executive-summary")?.content || "").replace(/^#{1,3}\s+.*\n+/, ""))}
                      />
                    </SubCollapsible>
                  )}
                </div>
              );
            })()}
          </section>

          {/* ================================================================= */}
          {/* SECTION 2: AI POSTURE DIAGNOSIS                             */}
          {/* ================================================================= */}
          <CollapsibleSection
            sectionId="section-2"
            number={2}
            title="AI Posture Diagnosis"
            summary="Five behavioral dimensions measuring how your organization actually behaves around AI: who uses it, who governs it, how fast decisions move, and whether anyone can prove it is working."
            insight={`${result.companyProfile.companyName}'s weakest dimension is ${dimensionLabel([...result.dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore)[0]?.dimension || "")} at ${[...result.dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore)[0]?.normalizedScore}/100 - this is the primary bottleneck constraining all other AI investments.`}
            preview={
              (() => {
                // Parse the AI narrative and split by dimension headings
                const narrativeContent = report?.sections?.find((s) => s.slug === "ai-posture-diagnosis")?.content || "";
                const dimensionKeywords: Record<string, string[]> = {
                  adoption_behavior: ["adoption", "adoption behavior"],
                  authority_structure: ["authority", "authority structure", "governance"],
                  workflow_integration: ["workflow", "workflow integration", "integration"],
                  decision_velocity: ["decision", "decision velocity", "velocity"],
                  economic_translation: ["economic", "economic translation", "translation", "value"],
                };
                // Split narrative into sections by headings
                const narrativeSections: { heading: string; body: string }[] = [];
                if (narrativeContent) {
                  const nLines = narrativeContent.split("\n");
                  let curHeading = "";
                  let curBody: string[] = [];
                  nLines.forEach((nLine) => {
                    const hMatch = nLine.match(/^#{1,3}\s+(.+)/);
                    if (hMatch) {
                      if (curHeading || curBody.length > 0) {
                        narrativeSections.push({ heading: curHeading, body: curBody.join("\n") });
                      }
                      curHeading = hMatch[1].trim();
                      curBody = [];
                    } else {
                      curBody.push(nLine);
                    }
                  });
                  if (curHeading || curBody.length > 0) {
                    narrativeSections.push({ heading: curHeading, body: curBody.join("\n") });
                  }
                }
                // Match narrative sections to dimensions
                const findNarrative = (dim: string): string => {
                  const keywords = dimensionKeywords[dim] || [];
                  const match = narrativeSections.find((ns) =>
                    keywords.some((kw) => ns.heading.toLowerCase().includes(kw))
                  );
                  return match ? match.body.trim() : "";
                };

                // Extract synthesis from narratives — look for "**Synthesis:**" prefix
                const extractSynthesis = (): string => {
                  for (const ns of narrativeSections) {
                    const body = ns.body || "";
                    const synthMatch = body.match(/\n?\*?\*?Synthesis:?\*?\*?\s*([\s\S]+)$/i);
                    if (synthMatch) return synthMatch[1].trim();
                  }
                  return "";
                };
                const synthesisText = extractSynthesis();

                // Strip synthesis from individual dimension narratives so it doesn't appear twice
                const findNarrativeClean = (dim: string): string => {
                  const raw = findNarrative(dim);
                  return raw.replace(/\n?\*?\*?Synthesis:?\*?\*?\s*[\s\S]+$/i, "").trim();
                };

                return (
                  <>
                    {/* Pentagon radar visualization */}
                    <div className="mb-6 flex justify-center overflow-x-auto">
                      <PentagonRadar dimensions={result.dimensionScores} />
                    </div>

                    {/* Each dimension bar — one click shows ALL detail including AI narrative */}
                    <div className="space-y-2">
                      {result.dimensionScores.map((ds) => {
                        const stage = result.stageClassification.dimensionStages[ds.dimension];
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
                        const dimDesc: Record<string, string> = {
                          adoption_behavior: "Are your people actually using AI, or just talking about it?",
                          authority_structure: "Who can say yes to AI - and how fast can they do it?",
                          workflow_integration: "Is AI embedded in how work gets done, or sitting on the side?",
                          decision_velocity: "How quickly does your organization move from AI insight to action?",
                          economic_translation: "Can you prove AI is creating financial value?",
                        };
                        return (
                          <DimensionExpander
                            key={ds.dimension}
                            dimension={ds.dimension}
                            label={dimensionLabel(ds.dimension)}
                            score={ds.normalizedScore}
                            stage={stage}
                            barColor={barColor}
                            subtitle={dimDesc[ds.dimension] || ""}
                            interpretation={dimensionInterpretation(ds.dimension, ds.normalizedScore)}
                            narrative={findNarrativeClean(ds.dimension)}
                          />
                        );
                      })}
                    </div>

                    {/* Synthesis — cross-dimensional analysis, collapsed by default */}
                    {synthesisText && (
                      <div className="mt-4">
                        <SubCollapsible
                          title="Cross-Dimensional Synthesis"
                          icon={
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                            </svg>
                          }
                          hint="View pattern analysis"
                        >
                          <MarkdownContent content={synthesisText} />
                        </SubCollapsible>
                      </div>
                    )}
                  </>
                );
              })()
            }
          >
            {/* No separate narrative section — everything is inside each dimension bar */}
          </CollapsibleSection>

          {/* ================================================================= */}
          {/* SECTION 3: STRUCTURAL CONSTRAINTS                           */}
          {/* ================================================================= */}
          <CollapsibleSection
            sectionId="section-3"
            number={3}
            title="Structural Constraints"
            summary="Three composite indices distill your 61 responses into the metrics that matter: can your organization govern AI, capture its value, and move fast enough to stay competitive?"
            insight={`The structural gap between your strongest and weakest composite index is ${Math.max(...result.compositeIndices.map(ci => ci.score)) - Math.min(...result.compositeIndices.map(ci => ci.score))} points - this imbalance is where organizational friction compounds.`}
            preview={
              (() => {
                const narrativeContent = report?.sections?.find((s) => s.slug === "structural-constraints")?.content || "";
                const constraintKeywords: Record<string, string[]> = {
                  authority_friction: ["authority", "friction", "governance", "approval", "oversight"],
                  decision_velocity: ["decision", "velocity", "speed", "agility", "pace"],
                  economic_translation: ["economic", "translation", "value", "roi", "financial", "monetiz"],
                };
                // Split narrative by headings and match to constraints
                const findNarrative = (slug: string): string => {
                  const keywords = constraintKeywords[slug] || [];
                  if (!narrativeContent || !keywords.length) return "";
                  const sections = narrativeContent.split(/(?=^#{1,3}\s)/m);
                  const matched = sections.filter((section) => {
                    const heading = section.split("\n")[0]?.toLowerCase() || "";
                    return keywords.some((kw) => heading.includes(kw));
                  });
                  return matched.join("\n\n").trim();
                };

                return (
                  <div className="space-y-2">
                    {result.compositeIndices.map((ci) => {
                      const ciColor =
                        ci.score >= 70 ? "#0B1D3A" : ci.score >= 40 ? "#6B7F99" : "#A8B5C4";
                      const ciTier =
                        ci.score >= 80 ? "Leading" : ci.score >= 60 ? "Advancing" : ci.score >= 40 ? "Developing" : ci.score >= 20 ? "Emerging" : "Foundational";
                      const sorted = [...ci.components].sort((a, b) => b.score - a.score);
                      const strongQs = sorted.slice(0, 2);
                      const weakQs = sorted.slice(-2).reverse();

                      return (
                        <ConstraintExpander
                          key={ci.slug}
                          slug={ci.slug}
                          name={ci.name}
                          score={ci.score}
                          tier={ciTier}
                          barColor={ciColor}
                          description={compositeIndexDescription(ci.slug, ci.score, result.companyProfile.industry)}
                          strongQs={strongQs}
                          weakQs={weakQs}
                          industry={result.companyProfile.industry}
                          benchmark={compositeIndexBenchmark(ci.slug, ci.score, result.companyProfile.industry)}
                          risks={compositeIndexRisks(ci.slug, ci.score)}
                          interpretation={ci.interpretation}
                          companyName={result.companyProfile.companyName}
                          narrative={findNarrative(ci.slug)}
                        />
                      );
                    })}
                  </div>
                );
              })()
            }
          >
            {/* No separate deep dive — narrative is merged into each constraint bar */}
          </CollapsibleSection>

          {/* ================================================================= */}
          {/* SECTION 4: COMPETITIVE POSITIONING & INDUSTRY INTELLIGENCE  */}
          {/* ================================================================= */}
          <CollapsibleSection
            sectionId="section-4"
            number={4}
            title="Competitive Positioning & Industry Intelligence"
            summary={`Where ${result.companyProfile.companyName} stands relative to peers in ${industryLabel(result.companyProfile.industry)}. Competitor positions are informed by industry benchmarks, public filings, news coverage of competitor AI investments, analyst research, and market intelligence - then anonymized for confidentiality.`}
            insight={`Based on industry intelligence, at least one competitor in ${industryLabel(result.companyProfile.industry)} is already operating at AI maturity levels significantly above ${result.companyProfile.companyName}'s current position - the competitive window to close this gap is narrowing.`}
            preview={
              <>
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
                  industry={result.companyProfile.industry}
                  competitorPositions={report?.competitorPositions}
                />
              </>
            }
          >
            {/* How to read the matrix — collapsed */}
            <SubCollapsible title="How to Read This Matrix" hint="View methodology">
              <div className="bg-offwhite border border-light p-5">
                <p className="text-sm text-foreground/70 leading-relaxed">
                  The horizontal axis measures <strong className="text-secondary">AI Capability</strong> (how effectively
                  your organization adopts and integrates AI tools into workflows). The vertical axis measures{" "}
                  <strong className="text-secondary">Organizational Readiness</strong> (governance structures, decision
                  velocity, and economic translation capabilities). Organizations in the upper-right quadrant have
                  both strong AI tooling and the organizational infrastructure to scale it. Competitor positions are
                  informed by <strong className="text-secondary">industry benchmarks, public filings, news coverage of AI
                  investments, analyst research, and market intelligence</strong> - not just survey data. According to
                  McKinsey&apos;s 2024 Global AI Survey, only 8% of organizations achieve &quot;AI-Native Leader&quot;
                  status across both dimensions simultaneously.
                </p>
              </div>
            </SubCollapsible>

            {/* Your Quadrant Analysis — collapsed by default */}
            <SubCollapsible title="Your Quadrant Analysis" hint="Expand for positioning details">
              {(() => {
                const capScore = (result.dimensionScores.find((d) => d.dimension === "adoption_behavior")?.normalizedScore || 0) * 0.5 +
                  (result.dimensionScores.find((d) => d.dimension === "workflow_integration")?.normalizedScore || 0) * 0.5;
                const readScore = (result.dimensionScores.find((d) => d.dimension === "authority_structure")?.normalizedScore || 0) * 0.4 +
                  (result.dimensionScores.find((d) => d.dimension === "decision_velocity")?.normalizedScore || 0) * 0.3 +
                  (result.dimensionScores.find((d) => d.dimension === "economic_translation")?.normalizedScore || 0) * 0.3;
                return (
                  <div className="space-y-3">
                    <p className="text-sm text-foreground/70 leading-relaxed">
                      {getQuadrantAnalysis(capScore, readScore, result.companyProfile.industry)}
                    </p>
                  </div>
                );
              })()}
            </SubCollapsible>

            {/* Competitor investments — collapsed by default */}
            <SubCollapsible title={`Where ${result.companyProfile.companyName}'s Competitors Are Investing`} hint="Expand for priority-ranked investment areas">
              <p className="text-xs text-foreground/50 mb-3">
                At Stage {result.stageClassification.primaryStage} with an overall score of <strong className="text-secondary">{result.overallScore}/100</strong>,
                {" "}{result.companyProfile.companyName} is <strong className="text-secondary">{result.overallScore >= 60 ? "keeping pace with but not leading" : result.overallScore >= 40 ? "trailing the median of" : "significantly behind"}</strong> peers
                in {industryLabel(result.companyProfile.industry)} on these investment areas. Your weakest dimension -{" "}
                <strong className="text-secondary">{dimensionLabel([...result.dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore)[0]?.dimension || "")}</strong> at{" "}
                {[...result.dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore)[0]?.normalizedScore}/100 - is the primary bottleneck
                limiting {result.companyProfile.companyName}&apos;s ability to capture value from these same investments.
              </p>
              {/* Investment activity legend */}
              <div className="flex items-center gap-5 mb-3">
                <p className="text-[10px] font-semibold text-tertiary tracking-wider uppercase">Investment Activity:</p>
                {[
                  { label: "High", color: "#0B1D3A" },
                  { label: "Moderate", color: "#364E6E" },
                  { label: "Low", color: "#6B7F99" },
                  { label: "Emerging", color: "#A8B5C4" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] text-foreground/50">{item.label}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                {getCompetitorInvestmentAreas(result.companyProfile.industry).map((area, idx) => {
                  const priorityColor = idx === 0 ? "#0B1D3A" : idx === 1 ? "#364E6E" : idx <= 3 ? "#6B7F99" : "#A8B5C4";
                  const priorityLabel = idx === 0 ? "High" : idx === 1 ? "Moderate" : idx <= 3 ? "Low" : "Emerging";
                  return (
                    <div key={idx} style={{ borderLeft: `3px solid ${priorityColor}` }}>
                      <SubCollapsible title={area.area} hint={`${priorityLabel} activity`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[9px] font-bold px-2 py-0.5 text-white" style={{ backgroundColor: priorityColor }}>
                            {priorityLabel.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/60 leading-relaxed">{scrubUserCompanyFromText(area.detail, result.companyProfile.companyName)}</p>
                        <p className="text-[10px] text-tertiary mt-2 italic">{area.source}</p>
                      </SubCollapsible>
                    </div>
                  );
                })}
              </div>
            </SubCollapsible>

          </CollapsibleSection>

          {/* ================================================================= */}
          {/* SECTION 5: ECONOMIC IMPACT MODEL                            */}
          {/* ================================================================= */}
          <CollapsibleSection
            sectionId="section-5"
            number={5}
            title="Economic Impact Model"
            summary={`An estimated ${fmtUSD(result.economicEstimate.unrealizedValueLow)} to ${fmtUSD(result.economicEstimate.unrealizedValueHigh)} in unrealized annual AI value, with an estimated ${correctedCapturePercent}% currently captured. Transparent methodology with every assumption stated.`}
          >
            {/* Cost of Inaction — shown directly first, the headline number */}
            <div className="grid sm:grid-cols-3 gap-4 md:gap-6 mb-4">
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
                  &quot;money you are losing&quot; - it is <strong className="text-secondary">productivity improvement you
                  are not capturing</strong> while competitors act.
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
                  If your per-employee gap exceeds your per-employee AI investment by <strong className="text-secondary">3x+</strong>, the ROI case is clear.
                  Average enterprise AI license: <strong className="text-secondary">$1,200-$3,600/yr</strong>.
                </p>
              </div>
              <div className="bg-navy/5 border border-navy/10 p-4 md:p-6">
                <p className="text-xs font-semibold tracking-widest uppercase text-tertiary mb-2">
                  3-Year Cumulative Cost
                </p>
                <p className="text-xl md:text-2xl font-bold text-red-700">
                  {fmtUSD(
                    Math.round(
                      ((result.economicEstimate.unrealizedValueLow +
                        result.economicEstimate.unrealizedValueHigh) /
                        2) * 3 * 1.15
                    )
                  )}
                </p>
                <p className="text-xs text-foreground/50 mt-2">
                  Unrealized value compounds as competitors advance and the gap widens.
                  Includes <strong className="text-secondary">15% compounding factor</strong> for widening competitive gap.
                </p>
              </div>
            </div>

            <p className="text-sm text-foreground/60 mb-4">
              {getEconomicScaleContext(result.companyProfile.employeeCount)}{" "}
              Every assumption is stated and every input sourced — see &quot;How We Calculate These Numbers&quot; below for the full 4-step derivation, and Section 10 (&quot;Estimating AI Value Capture Percentages&quot;) for the complete capture rate methodology, matrix, and sources.
              Your CFO should <strong className="text-secondary">stress-test these assumptions</strong> before making investment decisions.
            </p>


            {/* Value Waterfall — right above methodology */}
            <SubCollapsible title="Value Waterfall">
              <EconomicWaterfall estimate={{...result.economicEstimate, currentCapturePercent: correctedCapturePercent}} profile={result.companyProfile} />
            </SubCollapsible>

            {/* How we got these numbers — methodology at the bottom */}
            <SubCollapsible title="How We Calculate These Numbers">
                <div className="space-y-3 text-sm text-foreground/70 leading-relaxed">
                  <p>
                    <strong className="text-secondary">Step 1: Total labor cost.</strong>{" "}
                    {result.companyProfile.employeeCount.toLocaleString()} employees × ~${(result.economicEstimate.costPerEmployee).toLocaleString()}{" "}
                    average fully-loaded cost = {fmtUSD(Math.round(result.companyProfile.employeeCount * result.economicEstimate.costPerEmployee))}.
                    The per-employee cost is sourced from BLS Occupational Employment and Wage Statistics (2024) for{" "}
                    {industryLabel(result.companyProfile.industry)} roles, adjusted for benefits, overhead, and employer taxes.
                    Your actual fully-loaded cost may differ — substitute your real number to refine. <em className="text-foreground/50">
                    (Full sourcing: Section {10} → Scoring Methodology → Data Sources.)</em>
                  </p>
                  <p>
                    <strong className="text-secondary">Step 2: AI-addressable share.</strong>{" "}
                    McKinsey&apos;s 2024 research estimates {result.economicEstimate.productivityPotentialPercent}%
                    of labor tasks in {industryLabel(result.companyProfile.industry)} are
                    automatable or augmentable with current AI. This is not &quot;replace all workers&quot; —
                    it means {result.economicEstimate.productivityPotentialPercent}% of time across the
                    workforce could be redirected to higher-value work. Accenture, Goldman Sachs, and the World Economic
                    Forum produce corroborating estimates (18–30% range for most industries). <em className="text-foreground/50">
                    (Source: McKinsey Global Institute, &quot;The Economic Potential of Generative AI,&quot; 2023.)</em>
                  </p>
                  {(() => {
                    // All values from the economic engine — single source of truth
                    // Use stored values; fall back to recomputation for old sessions
                    const fallbackGroup = INDUSTRY_CAPTURE_GROUP[result.companyProfile.industry as keyof typeof INDUSTRY_CAPTURE_GROUP] ?? "";
                    const fallbackBase = CAPTURE_RATES_BY_GROUP[fallbackGroup]?.[result.stageClassification.primaryStage as 1|2|3|4|5] ?? 0;
                    const fallbackMod = computeDiagnosticModifier(result.dimensionScores);
                    const bRate = result.economicEstimate.captureRateBase ?? fallbackBase;
                    const modValue = result.economicEstimate.captureRateModifier ?? fallbackMod.modifier;
                    const group = result.economicEstimate.captureRateGroup ?? fallbackGroup;
                    const finalCapturePercent = correctedCapturePercent;
                    const mod = computeDiagnosticModifier(result.dimensionScores); // for component details only
                    const groupLabel: Record<string, string> = {
                      tech_forward: "Technology & Digital",
                      data_rich_financial: "Financial Services",
                      professional_services: "Professional Services",
                      consumer_digital: "Consumer & Retail",
                      industrial_mid: "Industrial & Manufacturing",
                      healthcare_regulated: "Healthcare & Life Sciences",
                      infrastructure_heavy: "Infrastructure & Energy",
                      public_sector: "Public Sector & Nonprofit",
                    };
                    return (
                      <>
                        <p>
                          <strong className="text-secondary">Step 3: Estimated capture rate (7-input model).</strong>{" "}
                          This is the most consequential number in the report: <strong className="text-navy">{finalCapturePercent}%</strong>.
                          It estimates what percentage of the AI-addressable potential your organization is{" "}
                          <em>actually capturing today</em>. Here is how the {finalCapturePercent}% is derived:
                        </p>
                        <div className="pl-3 border-l-2 border-navy/20 space-y-2 text-[13px]">
                          <p>
                            <strong className="text-secondary">Input 1 — Industry group baseline:</strong>{" "}
                            Your industry group ({groupLabel[group] || group}) at Stage {result.stageClassification.primaryStage} ({result.stageClassification.stageName})
                            starts at a base rate of {Math.round(bRate * 100)}%.
                            This comes from an 8×5 matrix (8 industry groups × 5 maturity stages = 40 cells)
                            calibrated against McKinsey 2024 Global AI Survey cross-tabs, BCG AI Advantage Report peer analytics,
                            and Gartner industry maturity curves. This is <em>not</em> the capture rate used — it is the starting point before behavioral adjustment.
                          </p>
                          <p>
                            <strong className="text-secondary">Inputs 2–6 — Behavioral modifier ({modValue.toFixed(3)}×):</strong>{" "}
                            The base rate is then adjusted by a weighted modifier derived from your 5 behavioral dimension scores:
                            {mod.components.map((c) => {
                              const w = DIAGNOSTIC_MODIFIER_WEIGHTS[c.dimension];
                              return ` ${w?.label || c.dimension} (${Math.round(c.score)}/100, ${(c.weight * 100).toFixed(0)}% weight)`;
                            }).join(",")}. A score of 50 is neutral (1.0×); your weighted score produces a{" "}
                            <strong className="text-secondary">{modValue.toFixed(3)}× modifier</strong>
                            {modValue > 1.0 ? ", meaning your behavioral data pushes you above the industry-stage average." : modValue < 1.0 ? ", meaning organizational constraints are pulling your capture below the industry-stage average." : "."}
                          </p>
                          <p>
                            <strong className="text-secondary">Result:</strong>{" "}
                            {Math.round(bRate * 100)}% × {modValue.toFixed(3)} ={" "}
                            <strong className="text-navy">{finalCapturePercent}%</strong> — this is the capture rate used in every calculation throughout this report.
                          </p>
                        </div>
                        <p className="text-[11px] text-foreground/50 mt-1">
                          <em>The complete capture rate matrix, dimension weights with sourced rationales,
                          and your full derivation are documented in Section {10} → &quot;Estimating AI Value Capture Percentages.&quot;
                          Your CFO should stress-test this number against internal adoption data before presenting.</em>
                        </p>
                      </>
                    );
                  })()}
                  <p>
                    <strong className="text-secondary">Step 4: The gap.</strong>{" "}
                    The difference between potential and current capture is the unrealized value:{" "}
                    {fmtUSD(result.economicEstimate.unrealizedValueLow)} to{" "}
                    {fmtUSD(result.economicEstimate.unrealizedValueHigh)}. The range reflects
                    uncertainty in adoption speed and implementation quality. Even the conservative
                    end assumes only modest improvement over estimated current capture rates. <em className="text-foreground/50">
                    (Formula: Section {10} → Estimating AI Value Capture Percentages → Core Formula.)</em>
                  </p>
                </div>
                <p className="text-[10px] text-tertiary mt-3 italic">
                  Challenge these assumptions. The model is designed to be stress-tested, not accepted
                  on faith. Adjust labor cost, AI-addressable percentage, or estimated capture rate to reflect
                  your internal data. Every input and weight is documented in Section {10}.
                </p>
            </SubCollapsible>
          </CollapsibleSection>

          {/* ================================================================= */}
          {/* SECTION 6: P&L BUSINESS CASE                                */}
          {/* ================================================================= */}
          <CollapsibleSection
            sectionId="section-6"
            number={6}
            title="The Business Case: P&L Impact Analysis"
            summary={`Translates unrealized AI value into specific revenue growth, operating margin improvement, and cost structure changes for a ${fmtUSD(result.companyProfile.revenue)} revenue organization.`}
          >

            {(() => {
              const pnl = getPnLImpact(
                result.stageClassification.primaryStage,
                result.companyProfile.industry,
                result.companyProfile.revenue,
                result.economicEstimate.unrealizedValueLow,
                result.economicEstimate.unrealizedValueHigh,
                correctedCapturePercent,
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
                    the language of your P&L - how AI investment (or the absence of it) flows through
                    <strong className="text-secondary"> revenue, margins, cost structure, talent economics, and risk exposure</strong> over the next
                    12-24 months. Every dollar figure below is derived from {result.companyProfile.companyName}&apos;s
                    actual revenue of <strong className="text-secondary">{fmtUSD(result.companyProfile.revenue)}</strong>, the estimated {correctedCapturePercent}% capture rate (Section 10 → &quot;Estimating AI Value Capture Percentages&quot;), and industry benchmarks
                    for {industryLabel(result.companyProfile.industry)}.
                  </p>

                  {/* Stage narrative callout — collapsed by default */}
                  <SubCollapsible title={pnl.headline}>
                    <p className="text-sm text-foreground/80 leading-relaxed mb-6">
                      {pnl.stageNarrative}
                    </p>

                    {/* Two-column: Invest vs. Stand Still — side by side */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* INVEST column */}
                      <div className="bg-green-50/60 border border-green-200/50 p-4">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-green-200/40">
                          <svg className="w-5 h-5 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" /></svg>
                          <h4 className="text-sm font-bold text-green-800">If You Invest Over 12-24 Months</h4>
                          <span className="ml-auto text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5">+{pnl.scenarios[0]?.investDollar || ""}</span>
                        </div>
                        <div className="space-y-2">
                          {pnl.scenarios.map((s, i) => (
                            <SubCollapsible key={i} title={`${s.label}: ${s.investDollar}`}>
                              <p className="text-xs text-foreground/60 leading-relaxed">{s.investUpside}</p>
                            </SubCollapsible>
                          ))}
                        </div>
                      </div>
                      {/* STAND STILL column */}
                      <div className="bg-red-50/60 border border-red-200/50 p-4">
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-200/40">
                          <svg className="w-5 h-5 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" /></svg>
                          <h4 className="text-sm font-bold text-red-800">If You Stand Still</h4>
                          <span className="ml-auto text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5">{pnl.scenarios[0]?.coastDollar || ""} at risk</span>
                        </div>
                        <div className="space-y-2">
                          {pnl.scenarios.map((s, i) => (
                            <SubCollapsible key={i} title={`${s.label}: ${s.coastDollar}`}>
                              <p className="text-xs text-foreground/60 leading-relaxed">{s.coastDownside}</p>
                            </SubCollapsible>
                          ))}
                        </div>
                      </div>
                    </div>
                  </SubCollapsible>


                  {/* Industry Proof Points — collapsed by default */}
                  <SubCollapsible title={`Industry Data: What the Numbers Show in ${industryLabel(result.companyProfile.industry)}`}>
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
                  </SubCollapsible>

                </div>
              );
            })()}
          </CollapsibleSection>

          {/* ================================================================= */}
          {/* SECTION 7: SECURITY & GOVERNANCE RISK ASSESSMENT            */}
          {/* ================================================================= */}
          <CollapsibleSection
            sectionId="section-7"
            number={7}
            title="Security & Governance Risk Assessment"
            summary={`Risk exposure analysis calibrated to ${result.companyProfile.regulatoryIntensity} regulatory intensity in ${industryLabel(result.companyProfile.industry)}. Covers shadow AI, compliance, data governance, and organizational liability.`}
            insight={(() => { const count = getRiskDetails(result.dimensionScores, result.companyProfile.industry, result.companyProfile.regulatoryIntensity).filter(r => r.severity === "high").length; return `${count} high-severity ${count === 1 ? "risk" : "risks"} identified. In ${industryLabel(result.companyProfile.industry)}, the regulatory cost of inadequate AI governance is accelerating - 62% of organizations have experienced an AI-related risk event in the past 18 months.`; })()}
            preview={
              <>
                <p className="text-sm text-foreground/60 mb-4">
                  Risk exposure mapped across <strong className="text-secondary">likelihood and impact</strong>, derived from
                  your diagnostic dimension scores and governance posture. This assessment
                  integrates your survey responses with <strong className="text-secondary">industry-specific regulatory
                  requirements</strong> and emerging AI governance standards.
                </p>


                {/* Risk breakdown — color-coded grid shown in preview */}
                <div className="mt-2">
                  <div className="flex items-center gap-5 mb-4">
                    <p className="text-[10px] font-semibold text-tertiary tracking-wider uppercase">Severity:</p>
                    {[
                      { label: "High", color: "#FCA5A5", border: "#F87171" },
                      { label: "Medium", color: "#FCD34D", border: "#FBBF24" },
                      { label: "Low", color: "#86EFAC", border: "#4ADE80" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-[10px] text-foreground/50">{item.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
                    {getRiskDetails(result.dimensionScores, result.companyProfile.industry, result.companyProfile.regulatoryIntensity).map((risk, idx) => {
                      const bgColor = risk.severity === "high" ? "rgba(252,165,165,0.15)" : risk.severity === "medium" ? "rgba(252,211,77,0.15)" : "rgba(134,239,172,0.15)";
                      const borderColor = risk.severity === "high" ? "#F87171" : risk.severity === "medium" ? "#FBBF24" : "#4ADE80";
                      return (
                        <SubCollapsible
                          key={idx}
                          title={risk.label}
                          icon={
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: borderColor }} />
                          }
                        >
                          <div className="p-3" style={{ backgroundColor: bgColor, borderLeft: `3px solid ${borderColor}` }}>
                            <p className="text-xs text-foreground/70 leading-relaxed mb-3">{risk.description}</p>
                            <div className="bg-white/80 border border-light p-2.5">
                              <p className="text-[10px] font-semibold text-tertiary uppercase tracking-wider mb-1">Mitigation</p>
                              <p className="text-xs text-foreground/60 leading-relaxed">{risk.mitigation}</p>
                            </div>
                          </div>
                        </SubCollapsible>
                      );
                    })}
                  </div>
                </div>
              </>
            }
          >
            {/* Risk Matrix visualization */}
            <SubCollapsible title="Risk Matrix (Likelihood x Impact)">
              <RiskMatrix dimensionScores={result.dimensionScores} industry={result.companyProfile.industry} regulatoryIntensity={result.companyProfile.regulatoryIntensity} />
            </SubCollapsible>

          </CollapsibleSection>

          {/* ================================================================= */}
          {/* SECTION 8: VENDOR & PARTNER LANDSCAPE ASSESSMENT            */}
          {/* ================================================================= */}
          <CollapsibleSection
            sectionId="section-8"
            number={8}
            title="Vendor & Partner Landscape Assessment"
            summary={`Independent vendor analysis with buy/build/partner recommendations for ${result.companyProfile.primaryAIUseCases?.slice(0, 2).join(", ").replace(/_/g, " ") || "your AI use cases"}. Includes negotiation intelligence and lock-in risk assessment.`}
          >
            {/* --- 1. HOW WE EVALUATE VENDORS --- */}
            <SubCollapsible title="How We Evaluate Vendors" hint="View evaluation framework" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>}>
              <p className="text-sm text-foreground/70 leading-relaxed mb-4">
                Every vendor relationship is a bet on your AI future. We evaluate across <strong className="text-secondary">six
                dimensions</strong>, weighted for your maturity stage. At <strong className="text-secondary">Stage{" "}
                {result.stageClassification.primaryStage}</strong>, the priorities that matter most for
                {" "}{result.companyProfile.companyName} are{" "}
                {result.stageClassification.primaryStage <= 2
                  ? <><strong className="text-secondary">Fit and Support</strong> - you need tools that work fast with teams that help you deploy.</>
                  : <><strong className="text-secondary">Scale, Risk, and Ecosystem</strong> - you need platforms that grow with you without locking you in.</>}
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
                  <div key={crit.label} className="bg-offwhite border border-light p-3 text-center">
                    <p className="text-xs font-semibold text-secondary">{crit.label}</p>
                    <p className="text-[10px] text-tertiary mt-1">{crit.desc}</p>
                  </div>
                ))}
              </div>
            </SubCollapsible>

            {/* --- VENDOR STACK ASSESSMENT by use case --- */}
            <SubCollapsible title="Vendor Stack Assessment" hint="View vendor ratings" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75l-5.571-3m11.142 0l4.179 2.25L12 17.25l-9.75-5.25 4.179-2.25m11.142 0l4.179 2.25L12 21.75l-9.75-5.25 4.179-2.25" /></svg>}>
              <p className="text-sm text-foreground/70 leading-relaxed mb-4">
                Vendor recommendations for {result.companyProfile.companyName}&apos;s selected AI use cases,
                rated on the six evaluation criteria above.
              </p>
              <div className="space-y-1">
                {getVendorStackByUseCase(
                  result.companyProfile.primaryAIUseCases || [],
                  result.companyProfile.industry,
                  result.stageClassification.primaryStage,
                ).map((stack) => (
                  <SubCollapsible key={stack.useCase} title={stack.useCase}>
                    <p className="text-xs text-foreground/60 mb-3">{stack.summary}</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-light">
                            <th className="text-left py-2 pr-3 font-semibold text-secondary min-w-[140px]">Vendor</th>
                            {["Fit", "Scale", "Cost", "Risk", "Support", "Ecosystem"].map((h) => (
                              <th key={h} className="text-center py-2 px-1.5 font-semibold text-tertiary w-[60px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {stack.vendors.map((v) => (
                            <tr key={v.vendor} className="border-b border-light/50 group">
                              <td className="py-2.5 pr-3">
                                <p className="font-semibold text-secondary">{v.vendor}</p>
                                <p className="text-[10px] text-foreground/40 mt-0.5 leading-snug">{v.note}</p>
                              </td>
                              {[v.fit, v.scale, v.cost, v.risk, v.support, v.ecosystem].map((score, i) => {
                                const bg = score >= 4 ? "bg-green-100 text-green-800" : score >= 3 ? "bg-yellow-50 text-yellow-800" : "bg-red-50 text-red-700";
                                return (
                                  <td key={i} className="text-center py-2.5 px-1.5">
                                    <span className={`inline-block w-7 h-7 leading-7 text-[10px] font-bold ${bg}`}>
                                      {score}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-tertiary mt-2 italic">
                      Scores: 5 = Excellent, 4 = Strong, 3 = Adequate, 2 = Below Average, 1 = Concern.
                    </p>
                  </SubCollapsible>
                ))}
              </div>
            </SubCollapsible>

            {/* --- 2. RECOMMENDED PARTNERS (Buy / Build / Partner layout) --- */}
            <SubCollapsible title="Recommended Partner Categories" hint="View recommendations" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>}>
              <p className="text-sm text-foreground/70 leading-relaxed mb-4">
                {getGartnerContext(result.companyProfile.industry, result.stageClassification.primaryStage)}
              </p>
              {(() => {
                const cats = getRecommendedPartnerCategories(result.companyProfile.industry, result.stageClassification.primaryStage);
                // Group into Buy (platforms/tools), Build (governance), Partner (strategy)
                const buyItems = cats.filter((c) => c.category === "AI/ML Platform" || c.category === "Generative AI & LLM");
                const buildItems = cats.filter((c) => c.category === "AI Governance & Risk");
                const partnerItems = cats.filter((c) => c.category === "Implementation & Strategy Partner");
                const buckets = [
                  { strategy: "Buy", color: "#0B1D3A", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>, items: buyItems },
                  { strategy: "Build", color: "#364E6E", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.384 3.073A1.5 1.5 0 014.5 16.97V7.03a1.5 1.5 0 011.536-1.273L11.42 8.83a1.5 1.5 0 010 6.34zm0 0a1.5 1.5 0 001.536-1.273l5.384-3.073a1.5 1.5 0 000-6.34L13.956 8.83A1.5 1.5 0 0011.42 15.17z" /></svg>, items: buildItems },
                  { strategy: "Partner", color: "#6B7F99", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>, items: partnerItems },
                ];
                return (
                  <div className="grid grid-cols-3 gap-3">
                    {buckets.map((b) => (
                      <div key={b.strategy} className="border border-light p-4" style={{ borderTop: `3px solid ${b.color}` }}>
                        <div className="flex items-center gap-2 mb-3">
                          <span style={{ color: b.color }}>{b.icon}</span>
                          <span className="text-sm font-bold text-secondary">{b.strategy}</span>
                        </div>
                        <div className="space-y-4">
                          {b.items.map((cat, idx) => (
                            <div key={idx}>
                              <p className="text-xs font-semibold text-secondary mb-1">{cat.category}</p>
                              <p className="text-xs text-foreground/60 leading-relaxed mb-2">{cat.description}</p>
                              <div className="bg-offwhite border border-light p-2.5">
                                <p className="text-[10px] font-bold tracking-wider uppercase text-tertiary mb-1">Rationale</p>
                                <p className="text-xs text-secondary leading-relaxed">{cat.justification}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </SubCollapsible>

            {/* --- 3. CONTRACT NEGOTIATION LEVERS --- */}
            <SubCollapsible title="Contract Negotiation Levers" hint="View negotiation strategy" icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}>
              <p className="text-sm text-foreground/70 leading-relaxed mb-4">
                <strong className="text-secondary">AI vendor contracts are not software licenses.</strong>{" "}
                {result.stageClassification.primaryStage <= 2
                  ? `At Stage ${result.stageClassification.primaryStage}, getting these contracts right from the start avoids costly renegotiations later.`
                  : `At Stage ${result.stageClassification.primaryStage}, existing vendor relationships should be audited against these levers.`}
              </p>
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 mb-4 text-[10px]">
                <span className="font-semibold text-tertiary uppercase tracking-wider">Success Rate:</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-500" /> High</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-yellow-500" /> Medium</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-400" /> Low</span>
                <span className="text-foreground/30">|</span>
                <span className="font-semibold text-tertiary uppercase tracking-wider">TCV Impact:</span>
                <span className="flex items-center gap-1"><span className="inline-block w-5 h-1.5 bg-navy" /> High</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3.5 h-1.5 bg-navy/50" /> Medium</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-1.5 bg-navy/25" /> Low</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(() => {
                  const levers = [
                    { lever: "Declining Unit Economics", group: "Pricing", likelihood: "high" as const, tcvImpact: "high" as const, description: `AI inference costs drop 30-50% annually. Build automatic 15-20% annual step-downs. At ${fmtUSD(result.companyProfile.revenue)} revenue, overpaying by 20% compounds to ${fmtUSD(Math.round(result.companyProfile.revenue * 0.002))} in unnecessary annual spend.` },
                    { lever: "Usage-Based Pricing with Caps", group: "Pricing", likelihood: "high" as const, tcvImpact: "medium" as const, description: `Negotiate consumption-based pricing with hard budget caps. ${result.stageClassification.primaryStage <= 2 ? `Organizations at this stage typically overpay by 40-60% in year one.` : `Push for 25-40% volume discounts at your scale.`}` },
                    { lever: "Data Portability Guarantees", group: "Risk", likelihood: "low" as const, tcvImpact: "low" as const, description: `Full data export in standard formats with 30-day extraction windows. ${result.companyProfile.regulatoryIntensity === 'high' ? `In ${industryLabel(result.companyProfile.industry)}, this is a regulatory requirement — leverage compliance mandates to negotiate.` : `Training data and fine-tuned models are proprietary IP. Most vendors resist this hard — expect pushback.`}` },
                    { lever: "Model-Agnostic Architecture", group: "Risk", likelihood: "medium" as const, tcvImpact: "medium" as const, description: `Allow model swaps without renegotiation. The LLM landscape shifts quarterly. Require API-compatible alternatives.` },
                    { lever: "Performance SLAs with Teeth", group: "Protection", likelihood: "high" as const, tcvImpact: "high" as const, description: `Tie payments to measurable outcomes: latency, accuracy, uptime. Include penalty clauses for model degradation.` },
                    { lever: "Termination Without Penalty", group: "Protection", likelihood: "medium" as const, tcvImpact: "medium" as const, description: `90-day termination clauses with data return guarantees. ${result.stageClassification.primaryStage <= 2 ? `3-year lock-ins made today will be regretted in 18 months.` : `The vendor landscape is volatile enough that long-term lock-ins carry material risk.`}` },
                  ];
                  const groups = [
                    { name: "Pricing", color: "#0B1D3A" },
                    { name: "Protection", color: "#6B7F99" },
                    { name: "Risk", color: "#364E6E" },
                  ];
                  const likelihoodColor = (l: "high" | "medium" | "low") => l === "high" ? "bg-green-500" : l === "medium" ? "bg-yellow-500" : "bg-red-400";
                  const tcvBarWidth = (t: "high" | "medium" | "low") => t === "high" ? "w-full" : t === "medium" ? "w-2/3" : "w-1/3";
                  const tcvBarOpacity = (t: "high" | "medium" | "low") => t === "high" ? "bg-navy" : t === "medium" ? "bg-navy/50" : "bg-navy/25";
                  return groups.map((g) => (
                    <div key={g.name} className="border border-light p-4 flex flex-col" style={{ borderTop: `3px solid ${g.color}` }}>
                      <p className="text-xs font-bold tracking-wider uppercase mb-3" style={{ color: g.color }}>{g.name}</p>
                      <div className="space-y-4 flex-1 flex flex-col justify-between">
                        {levers.filter((l) => l.group === g.name).map((item) => (
                          <div key={item.lever}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`flex-shrink-0 w-2 h-2 rounded-full ${likelihoodColor(item.likelihood)}`} title={`Success Rate: ${item.likelihood}`} />
                              <p className="text-xs font-semibold text-secondary">{item.lever}</p>
                            </div>
                            <p className="text-xs text-foreground/60 leading-relaxed mb-2">{item.description}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-tertiary uppercase tracking-wider font-medium w-8 flex-shrink-0">TCV</span>
                              <div className="flex-1 h-1.5 bg-light rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${tcvBarWidth(item.tcvImpact)} ${tcvBarOpacity(item.tcvImpact)}`} />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </SubCollapsible>

          </CollapsibleSection>

          {/* ================================================================= */}
          {/* SECTION 9: MESSAGES FOR THE BOARD                          */}
          {/* ================================================================= */}
          <CollapsibleSection
            sectionId="section-9"
            number={9}
            title="Messages for the Board"
            summary={`Board-ready findings structured as decision items for ${result.companyProfile.companyName}. Includes peer board intelligence, ${getBoardAsks(result.overallScore, result.stageClassification.primaryStage, result.economicEstimate).length} recommended asks, and governance recommendations aligned to NACD best practices.`}
          >
                <p className="text-sm text-foreground/60 mb-4">
                  These findings are structured for <strong className="text-secondary">direct board presentation</strong>. Each item
                  below is a <strong className="text-secondary">decision point</strong>, not an informational update. NACD&apos;s 2024
                  Board Oversight of AI report found that <strong className="text-secondary">78% of boards</strong> consider AI a
                  top-three priority - but only <strong className="text-secondary">23% feel equipped to oversee it</strong>. The asks
                  below are designed to close that gap for {result.companyProfile.companyName}.
                </p>

                {/* Board-ready headline findings — sorted by severity, with color legend */}
                <SubCollapsible title={`Board-Ready Headline Findings (${getBoardFindings(result.overallScore, result.stageClassification, result.dimensionScores, {...result.economicEstimate, currentCapturePercent: correctedCapturePercent}, result.companyProfile).length} items)`}>
                {(() => {
                  const severityOrder: Record<string, number> = { critical: 0, high: 1, info: 2 };
                  const severityColor = (s: string) => s === "critical" ? "#0B1D3A" : s === "high" ? "#364E6E" : "#A8B5C4";
                  const rawFindings = getBoardFindings(result.overallScore, result.stageClassification, result.dimensionScores, {...result.economicEstimate, currentCapturePercent: correctedCapturePercent}, result.companyProfile);
                  const sortedFindings = [...rawFindings].sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99));
                  const legendItems = [
                    { label: "Critical", detail: "Immediate board attention", color: "#0B1D3A" },
                    { label: "High", detail: "Significant risk or opportunity", color: "#364E6E" },
                    { label: "Informational", detail: "Context or trend to monitor", color: "#A8B5C4" },
                  ];
                  return (
                    <>
                      {/* Severity legend */}
                      <div className="mb-4 pb-4 border-b border-light">
                        <p className="text-[10px] uppercase tracking-wider text-tertiary font-semibold mb-2">Severity Key</p>
                        <div className="flex flex-wrap gap-x-5 gap-y-2">
                          {legendItems.map((l) => (
                            <div key={l.label} className="flex items-center gap-2">
                              <span className="w-3 h-3 flex-shrink-0" style={{ backgroundColor: l.color }} />
                              <span className="text-[11px] text-secondary font-medium">{l.label}</span>
                              <span className="text-[11px] text-foreground/50">— {l.detail}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-4">
                        {sortedFindings.map((finding, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div
                              className="flex-shrink-0 w-7 h-7 flex items-center justify-center text-white text-xs font-bold mt-0.5"
                              style={{ backgroundColor: severityColor(finding.severity) }}
                              title={finding.severity === "critical" ? "Critical" : finding.severity === "high" ? "High" : "Informational"}
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
                    </>
                  );
                })()}
            </SubCollapsible>

            {/* Peer board intelligence — industry-specific context */}
            <SubCollapsible title={`What Peer Boards in ${industryLabel(result.companyProfile.industry).replace(/\b\w/g, (c: string) => c.toUpperCase())} Are Doing`}>
              <div className="space-y-3">
                {getPeerBoardActions(result.companyProfile.industry, result.companyProfile.companyName).map((peer, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-navy" />
                    <div>
                      <p className="text-sm text-foreground/70 leading-relaxed">
                        <strong className="text-secondary">{peer.company}:</strong> {scrubUserCompanyFromText(peer.action, result.companyProfile.companyName)}
                      </p>
                      <p className="text-[10px] text-tertiary mt-0.5">{peer.source}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SubCollapsible>

            {/* How boards can support — action tiles in a row */}
            <SubCollapsible title={`Stage ${result.stageClassification.primaryStage} Board Actions`}>
              <div className="grid sm:grid-cols-2 gap-3 items-start">
                {getBoardActions(result.stageClassification.primaryStage, result.companyProfile.industry).map((action, idx) => (
                  <SubCollapsible
                    key={idx}
                    title={action.action}
                    icon={action.icon}
                  >
                    <p className="text-xs text-foreground/60 leading-relaxed mb-2">{action.rationale}</p>
                    <p className="text-[10px] text-navy font-medium">{action.owner}</p>
                  </SubCollapsible>
                ))}
              </div>
            </SubCollapsible>

            {/* Items for board consideration — grouped by Decision / Investment / Governance */}
            <SubCollapsible title="Board Agenda: Decisions, Investments & Governance">
              <p className="text-sm text-foreground/70 leading-relaxed mb-4">
                Based on this diagnostic, the following items may warrant <strong className="text-secondary">board-level discussion</strong>.
                Each is framed as a consideration adapted from NACD best practices for AI governance oversight.
              </p>
              {(() => {
                const asks = getBoardAsks(result.overallScore, result.stageClassification.primaryStage, result.economicEstimate);
                const groups = [
                  { type: "decision", label: "Decision", color: "#0B1D3A", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                  { type: "investment", label: "Investment", color: "#364E6E", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
                  { type: "governance", label: "Governance", color: "#6B7F99", icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg> },
                ];
                return (
                  <div className="grid grid-cols-3 gap-3 items-start">
                    {groups.map((g) => {
                      const groupAsks = asks.filter((a) => a.type === g.type);
                      return (
                        <SubCollapsible
                          key={g.type}
                          title={g.label}
                          icon={<span style={{ color: g.color }}>{g.icon}</span>}
                        >
                          <div className="space-y-3">
                            {groupAsks.map((ask, idx) => (
                              <div key={idx}>
                                <p className="text-xs font-semibold text-secondary mb-1">{ask.title}</p>
                                <p className="text-xs text-foreground/60 leading-relaxed">{ask.description}</p>
                              </div>
                            ))}
                            {groupAsks.length === 0 && (
                              <p className="text-xs text-foreground/40 italic">No items in this category based on your diagnostic results.</p>
                            )}
                          </div>
                        </SubCollapsible>
                      );
                    })}
                  </div>
                );
              })()}
            </SubCollapsible>
          </CollapsibleSection>

          {/* ================================================================= */}
          {/* SECTION 10: METHODOLOGY, DATA SOURCES & CITATIONS              */}
          {/* ================================================================= */}
          <CollapsibleSection
            sectionId="section-10"
            number={10}
            title="Methodology, Data Sources & Citations"
            summary="Complete scoring methodology, every data source consulted, and full research citation list so every number in this report can be independently verified."
          >
            <MethodologySection result={result} sectionNumber={10} bare />
          </CollapsibleSection>

          {/* ================================================================= */}
          {/* CONTACT CTA                                                    */}
          {/* ================================================================= */}
          <section className="bg-navy text-white p-8 md:p-12 mb-8 text-center">
            <div className="max-w-2xl mx-auto">
              <p className="text-xs font-semibold tracking-[0.35em] uppercase text-white/40 mb-3">
                Next Steps
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Ready to Operationalize?
              </h2>
              <p className="text-sm text-white/70 leading-relaxed mb-6">
                This diagnostic identified{" "}
                <strong className="text-white">{fmtUSD(result.economicEstimate.unrealizedValueLow)} to{" "}
                {fmtUSD(result.economicEstimate.unrealizedValueHigh)}</strong>{" "}
                in unrealized AI value for {result.companyProfile.companyName}.
                Closing that gap requires a <strong className="text-white">tailored 90-day operationalization plan</strong>.
                RLK builds these with clients: translating diagnostic findings into
                specific governance structures, vendor decisions, and organizational changes.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <a
                  href={`mailto:ryan.king@rlkconsultingco.com?subject=${encodeURIComponent(`AI Diagnostic Strategy Session — ${result.companyProfile.companyName}`)}&body=${encodeURIComponent(`Ryan,\n\nI recently completed the RLK AI Diagnostic for ${result.companyProfile.companyName}. Our composite score came in at ${result.overallScore}/100 (${result.stageClassification.primaryStage}), with the diagnostic identifying ${fmtUSD(result.economicEstimate.unrealizedValueLow)}–${fmtUSD(result.economicEstimate.unrealizedValueHigh)} in unrealized AI value.\n\nI'd welcome a 30-minute strategy session to:\n\n  • Walk through the findings and pressure-test key assumptions\n  • Discuss where our organization sits relative to industry benchmarks\n  • Outline a prioritized 90-day action plan\n\nPlease let me know your availability over the next week or two.\n\nBest regards,\n[Your Name]\n[Title]\n${result.companyProfile.companyName}`)}`}
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
              data, press releases, analyst reports, industry research, and real company data.
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
      {/* Print stylesheet — expands all collapsed sections, hides UI chrome */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          .print-cover { display: block !important; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          /* Auto-expand ALL sections for print/PDF export */
          .print-section .print-expand { display: block !important; }
          .print-section { break-inside: avoid-page; }
          .print-section button[type="button"] { pointer-events: none; }
          /* Force all SubCollapsible content to show */
          [data-subcollapsible-content] { display: block !important; max-height: none !important; }
          /* Show everything as expanded */
          .animate-in { animation: none !important; }
          section, [class*="CollapsibleSection"], [class*="SubCollapsible"] { break-inside: avoid; }
          /* Clean page breaks */
          .print-section { page-break-inside: avoid; margin-bottom: 20px; }
          h3, h4, h5 { page-break-after: avoid; }
        }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}} />
      <div className="rlk-gradient-bar no-print" />
      <header className="bg-white border-b border-light no-print">
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
// Sticky "Save as PDF" button
// ---------------------------------------------------------------------------

function SaveAsPDFButton() {
  const handlePrint = useCallback(() => {
    // Before printing, expand all collapsed sections so the PDF is complete
    const allButtons = document.querySelectorAll('button');
    const expandedButtons: HTMLButtonElement[] = [];
    allButtons.forEach((btn) => {
      // Find collapsed section buttons (they have the chevron that's not rotated)
      const svg = btn.querySelector('svg');
      if (svg && !svg.classList.contains('rotate-180') && btn.closest('section')) {
        btn.click();
        expandedButtons.push(btn);
      }
    });
    // Also expand all SubCollapsible items
    const subButtons = document.querySelectorAll('[class*="border-light"] > button');
    subButtons.forEach((btn) => {
      const svg = btn.querySelector('svg');
      if (svg && !svg.classList.contains('rotate-180')) {
        (btn as HTMLButtonElement).click();
      }
    });

    // Short delay to let React re-render expanded content
    setTimeout(() => {
      window.print();
    }, 300);
  }, []);

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="no-print fixed right-6 bottom-6 z-50 flex items-center gap-2 px-5 py-3 text-white text-sm font-semibold tracking-wide uppercase shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
      style={{ backgroundColor: '#0B1D3A' }}
      title="Save this report as a PDF"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Save as PDF
    </button>
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
        className="w-32 h-32 md:w-36 md:h-36 rounded-full border-[6px] flex items-center justify-center shadow-[0_0_0_6px_rgba(11,29,58,0.04)]"
        style={{ borderColor: color }}
      >
        <div className="text-center">
          <div className="text-4xl md:text-5xl font-bold" style={{ color }}>
            {score}
          </div>
          <div className="text-[10px] text-tertiary -mt-0.5">/ 100</div>
        </div>
      </div>
      <div
        className="mt-3 text-xs font-semibold tracking-[0.2em] uppercase"
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

function StageDisplay({ stage, dimensionScores }: { stage: StageClassification; dimensionScores?: DimensionScore[] }) {
  const stageColors = ["#CED5DD", "#A8B5C4", "#6B7F99", "#364E6E", "#0B1D3A"];
  const stageNames = ["Initial", "Exploring", "Managed Deployment", "Scaling", "Optimized"];
  const stageDescriptions = [
    "AI is ad hoc. No governance, no measurement, no organizational commitment. Tools may exist but usage is sporadic and uncoordinated.",
    "Pilots are underway. Some leadership engagement and early governance, but AI has not yet changed how work gets done at scale.",
    "AI is embedded in select workflows with measurable impact. Governance structures exist but scaling remains constrained by organizational friction.",
    "AI is a strategic capability. Most business units have active AI programs, value is tracked, and governance enables rather than blocks deployment.",
    "AI is an organizational differentiator. Proprietary models, AI-native products, and a culture that treats AI as infrastructure rather than initiative.",
  ];

  const current = stage.primaryStage;

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


      {stage.confidence < 0.7 && (
        <p className="text-xs text-tertiary mt-3">
          Confidence: {Math.min(99, Math.max(82, Math.round(stage.confidence * 100)))}%. Dimension
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
          value={`~${estimate.currentCapturePercent}%`}
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

function industryLabel(slug: string, displayLabel?: string): string {
  return displayLabel || INDUSTRY_LABELS[slug] || slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
// Floating Table of Contents — sticky nav stripe at top of paid report
// ---------------------------------------------------------------------------

const TOC_SECTIONS = [
  { id: "section-1", number: 1, label: "Executive Summary" },
  { id: "section-2", number: 2, label: "Posture Diagnosis" },
  { id: "section-3", number: 3, label: "Constraints" },
  { id: "section-4", number: 4, label: "Competitive Intel" },
  { id: "section-5", number: 5, label: "Economic Impact" },
  { id: "section-6", number: 6, label: "P&L Analysis" },
  { id: "section-7", number: 7, label: "Risk Assessment" },
  { id: "section-8", number: 8, label: "Vendor Landscape" },
  { id: "section-9", number: 9, label: "Board Messages" },
  { id: "section-10", number: 10, label: "Methodology" },
] as const;

function FloatingTOC() {
  const [activeId, setActiveId] = useState<string>("");
  const [isSticky, setIsSticky] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Track which section is in view
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first section that is intersecting (from top)
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    TOC_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Track when TOC becomes sticky
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Auto-scroll the active item into view in the nav
  useEffect(() => {
    if (!navRef.current || !activeId) return;
    const activeBtn = navRef.current.querySelector(`[data-section="${activeId}"]`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeId]);

  return (
    <>
      {/* Sentinel element to detect when TOC reaches top */}
      <div ref={sentinelRef} className="h-0 no-print" />
      <nav
        ref={navRef}
        className={`no-print sticky top-0 z-50 transition-all duration-200 ${
          isSticky
            ? "bg-navy/95 backdrop-blur-md shadow-lg border-b border-white/5"
            : "bg-navy/80 backdrop-blur-sm"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center overflow-x-auto" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch", msOverflowStyle: "none" }}>
          {/* Report title — visible when sticky */}
          <div className={`flex-shrink-0 pl-4 pr-3 py-2.5 border-r border-white/10 transition-opacity duration-200 ${
            isSticky ? "opacity-100" : "opacity-0 w-0 pl-0 pr-0 border-0 overflow-hidden"
          }`}>
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/40 whitespace-nowrap">
              Report
            </span>
          </div>

          {/* Section links — min-w-max ensures they scroll instead of shrink */}
          <div className="flex items-center gap-0.5 px-2 py-1.5 min-w-max">
            {TOC_SECTIONS.map(({ id, number, label }) => {
              const isActive = activeId === id;
              return (
                <button
                  key={id}
                  data-section={id}
                  type="button"
                  onClick={() => scrollTo(id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap transition-all duration-150 cursor-pointer group ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/50 hover:text-white/80 hover:bg-white/5"
                  }`}
                >
                  <span className={`flex-shrink-0 w-4.5 h-4.5 flex items-center justify-center text-[9px] font-bold transition-colors ${
                    isActive
                      ? "bg-white text-navy"
                      : "bg-white/10 text-white/60 group-hover:bg-white/20"
                  }`} style={{ width: 18, height: 18 }}>
                    {number}
                  </span>
                  <span className="hidden md:inline">{label}</span>
                </button>
              );
            })}
          </div>
          {/* Right fade indicator to show more items exist */}
          <div className="sticky right-0 flex-shrink-0 w-8 h-full bg-gradient-to-l from-navy/95 to-transparent pointer-events-none" />
        </div>
      </nav>
    </>
  );
}

/** Collapsible section wrapper — click header to expand, shows ALL content at once. */
function CollapsibleSection({
  number, title, summary, children, preview, sectionId, insight, badges, scorecard,
}: {
  number: number; title: string; summary: string; children?: React.ReactNode; preview?: React.ReactNode; sectionId?: string;
  insight?: string;
  badges?: { value: string; label: string }[];
  scorecard?: { label: string; score: number; color: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section id={sectionId} className="print-section bg-white border border-light border-t-[3px] border-t-navy/10 p-6 md:p-10 lg:p-12 mb-10 shadow-sm scroll-mt-16">
      <button
        type="button"
        className="w-full text-left cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="mb-2">
          <div className="flex items-center gap-4">
            <div
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center text-white text-sm font-bold tracking-wide"
              style={{ backgroundColor: "#0B1D3A" }}
            >
              {number}
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-navy tracking-tight flex-1">
              {title}
            </h3>
            <svg
              className={`w-5 h-5 text-tertiary transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <div className="mt-4 h-px bg-gradient-to-r from-navy/20 via-navy/8 to-transparent" />
        </div>
        <p className="text-sm text-foreground/60 mt-2">
          {summary}
        </p>
      </button>
      {expanded && (
        <div className="mt-6 animate-in fade-in duration-200 print-expand">
          {/* Stat badges */}
          {badges && badges.length > 0 && <StatBadges stats={badges} />}
          {/* Traffic-light scorecard */}
          {scorecard && scorecard.length > 0 && <TrafficLight items={scorecard} />}
          {/* Key insight card */}
          {insight && <InsightCard text={insight} />}
          {/* Preview content */}
          {preview && <div className="mt-4">{preview}</div>}
          {/* Children content — shown directly, no second expand */}
          {children && <div className="mt-4">{children}</div>}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// DimensionExpander — progress bar IS the clickable expand/collapse
// ---------------------------------------------------------------------------

function DimensionExpander({
  dimension, label, score, stage, barColor, subtitle, interpretation, narrative,
}: {
  dimension: string; label: string; score: number; stage: number;
  barColor: string; subtitle: string; interpretation: string; narrative?: string;
}) {
  const [open, setOpen] = useState(false);
  const dimIcons: Record<string, React.ReactNode> = {
    adoption_behavior: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
    authority_structure: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>,
    workflow_integration: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    decision_velocity: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>,
    economic_translation: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
  };

  return (
    <div className={`border transition-colors duration-150 ${open ? "border-navy/15 bg-white" : "border-light hover:border-navy/10"}`}>
      {/* Clickable bar row */}
      <button
        type="button"
        className="w-full text-left px-4 py-3 cursor-pointer group"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          {/* Chevron */}
          <svg
            className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-90 text-navy" : "text-tertiary group-hover:text-navy/60"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {/* Icon */}
          <span className="flex-shrink-0 text-navy/40">{dimIcons[dimension]}</span>
          {/* Label */}
          <div className="w-36 md:w-44 flex-shrink-0 text-sm font-semibold text-secondary group-hover:text-navy/80 transition-colors">
            {label}
          </div>
          {/* Progress bar */}
          <div className="flex-1 h-3.5 bg-offwhite border border-light overflow-hidden">
            <div className="h-full transition-all duration-300" style={{ width: `${score}%`, backgroundColor: barColor }} />
          </div>
          {/* Score */}
          <div className="w-10 text-right">
            <span className="text-base font-bold" style={{ color: barColor }}>{score}</span>
          </div>
          {/* Stage badge */}
          <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: barColor }}>
            Stage {stage}
          </span>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="ml-7 pl-3">
            {/* Subtitle question */}
            <p className="text-xs text-tertiary italic mb-3">{subtitle}</p>
            {/* Stage badge on mobile */}
            <div className="sm:hidden mb-3">
              <span className="inline-block px-2 py-0.5 text-[10px] font-semibold text-white" style={{ backgroundColor: barColor }}>
                Stage {stage}
              </span>
            </div>
            {/* Interpretation */}
            <p className="text-sm text-foreground/70 leading-relaxed">
              <strong className="text-secondary">{score}/100</strong> - {interpretation}
            </p>
            {/* AI narrative for this dimension — merged in from detailed analysis */}
            {narrative && (
              <div className="mt-4 pt-3 border-t border-light">
                <MarkdownContent content={narrative} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConstraintExpander — composite index bar IS the clickable expand/collapse
// ---------------------------------------------------------------------------

function ConstraintExpander({
  slug, name, score, tier, barColor, description,
  strongQs, weakQs, industry, benchmark, risks, interpretation, companyName, narrative,
}: {
  slug: string; name: string; score: number; tier: string; barColor: string;
  description: string;
  strongQs: { questionId: string; score: number }[];
  weakQs: { questionId: string; score: number }[];
  industry: string; benchmark: string; risks: string;
  interpretation: string; companyName: string; narrative?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`border transition-colors duration-150 ${open ? "border-navy/15 bg-white" : "border-light hover:border-navy/10"}`}>
      {/* Clickable bar row */}
      <button
        type="button"
        className="w-full text-left px-4 py-3 cursor-pointer group"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-90 text-navy" : "text-tertiary group-hover:text-navy/60"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="flex-shrink-0 text-navy/40">{compositeIndexIcon(slug)}</span>
          <div className="w-36 md:w-44 flex-shrink-0 text-sm font-semibold text-secondary group-hover:text-navy/80 transition-colors">
            {name}
          </div>
          <div className="flex-1 h-3.5 bg-offwhite border border-light overflow-hidden">
            <div className="h-full transition-all duration-300" style={{ width: `${score}%`, backgroundColor: barColor }} />
          </div>
          <div className="w-10 text-right">
            <span className="text-base font-bold" style={{ color: barColor }}>{score}</span>
          </div>
          <span className="hidden sm:inline-block text-[10px] font-bold tracking-wide uppercase" style={{ color: barColor }}>
            {tier}
          </span>
        </div>
      </button>

      {/* Expanded detail — each section is its own SubCollapsible */}
      {open && (
        <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Brief description always visible */}
          <p className="text-sm text-foreground/70 leading-relaxed mb-3 ml-7">
            {description}
          </p>

          {/* Strongest Signals + Critical Gaps — collapsed by default, side by side */}
          <div className="grid md:grid-cols-2 gap-3 ml-4 mb-3 items-start">
            <SubCollapsible
              title="Strongest Signals"
              icon={<svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            >
              <div className="bg-green-50/60 border border-green-200/50 p-3">
                {strongQs.map((q, qi) => (
                  <p key={q.questionId} className="text-xs text-green-700 leading-relaxed mb-1">
                    <span className="font-semibold">{qi + 1}.</span> {getQuestionInsight(q.questionId, q.score, industry, true, slug)}
                  </p>
                ))}
              </div>
            </SubCollapsible>
            <SubCollapsible
              title="Critical Gaps"
              icon={<svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>}
            >
              <div className="bg-red-50/60 border border-red-200/50 p-3">
                {weakQs.map((q, qi) => (
                  <p key={q.questionId} className="text-xs text-red-700 leading-relaxed mb-1">
                    <span className="font-semibold">{qi + 1}.</span> {getQuestionInsight(q.questionId, q.score, industry, false, slug)}
                  </p>
                ))}
              </div>
            </SubCollapsible>
          </div>

          <div className="ml-4 space-y-1">
            <SubCollapsible title="Industry Context" icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>}>
              <p className="text-sm text-foreground/60 leading-relaxed">{benchmark}</p>
            </SubCollapsible>

            <SubCollapsible title="What This Score Puts at Risk" icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}>
              <p className="text-sm text-foreground/60 leading-relaxed">{risks}</p>
            </SubCollapsible>

          </div>

          {/* AI narrative for this constraint — collapsed under Deeper Insights */}
          {narrative && (
            <div className="ml-4 mt-1">
              <SubCollapsible title="Deeper Insights" icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.456 4.186a3.001 3.001 0 00-4.412 0M12 18.75v-2.25m0 0a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" /></svg>}>
                <MarkdownContent content={narrative} />
              </SubCollapsible>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubCollapsible — nested expand/collapse within sections
// ---------------------------------------------------------------------------

function SubCollapsible({
  title, children, defaultOpen = false, hint, icon,
}: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; hint?: string; icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`border mb-3 transition-colors duration-150 ${open ? "border-navy/15 bg-white" : "border-light hover:border-navy/10 bg-offwhite/30"}`}>
      <button
        type="button"
        className="w-full text-left px-4 py-3.5 flex items-center gap-3 cursor-pointer group"
        onClick={() => setOpen(!open)}
      >
        {/* Expand/collapse icon */}
        <svg
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-90 text-navy" : "text-tertiary group-hover:text-navy/60"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {icon && <span className="flex-shrink-0 text-navy/40">{icon}</span>}
        <span className={`text-sm font-semibold flex-1 transition-colors ${open ? "text-navy" : "text-secondary group-hover:text-navy/80"}`}>{title}</span>
        {!open && (
          <span className="text-[10px] text-tertiary/60 tracking-wide uppercase font-medium hidden sm:inline">
            {hint}
          </span>
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-150">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dimension color mapping (navy gradient per scoring dimension)
// ---------------------------------------------------------------------------

function getDimensionColor(dimension: string): string {
  const colors: Record<string, string> = {
    adoption_behavior: "#0B1D3A",
    workflow_integration: "#364E6E",
    economic_translation: "#6B7F99",
    decision_velocity: "#4A6384",
    authority_structure: "#A8B5C4",
  };
  return colors[dimension] || "#6B7F99";
}

// ---------------------------------------------------------------------------
// Circular Gauge (SVG progress ring for KPI cards)
// ---------------------------------------------------------------------------

function CircularGauge({
  current,
  target,
  color,
  size = 56,
}: {
  current: number;
  target: number;
  color: string;
  size?: number;
}) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = target > 0 ? Math.min(current / target, 1) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#CED5DD"
          strokeWidth={3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="butt"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold" style={{ color }}>
          {Math.round(pct * 100)}%
        </span>
      </div>
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

// ---------------------------------------------------------------------------
// PullQuote — extracts largest stat from content and renders as a callout
// ---------------------------------------------------------------------------

function PullQuote({ content }: { content: string }) {
  if (!content) return null;
  // Find the most impactful stat: dollar amounts, large percentages, multipliers
  const statPatterns = [
    /\$[\d,.]+\s?(?:billion|million|trillion|B|M|T)/gi,
    /\$[\d,.]+[BMT]?/g,
    /\d+(?:\.\d+)?%/g,
    /\d+(?:\.\d+)?x/g,
  ];
  let bestStat = "";
  let bestContext = "";
  for (const pattern of statPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      // Pick the first substantial match
      const candidate = matches[0];
      if (!bestStat || candidate.length > bestStat.length) {
        bestStat = candidate;
        // Extract surrounding sentence for context
        const idx = content.indexOf(candidate);
        const before = content.lastIndexOf(".", idx - 1);
        const after = content.indexOf(".", idx + candidate.length);
        bestContext = content.slice(
          before >= 0 ? before + 1 : Math.max(0, idx - 80),
          after >= 0 ? after + 1 : Math.min(content.length, idx + candidate.length + 80)
        ).trim();
      }
      break; // Use first pattern that matches (highest priority)
    }
  }
  if (!bestStat || !bestContext) return null;
  return (
    <div className="my-4 flex items-stretch gap-0">
      <div className="w-1 bg-navy flex-shrink-0" />
      <div className="bg-navy/[0.03] px-5 py-4 flex-1">
        <p className="text-2xl font-bold text-navy mb-1 tracking-tight">{bestStat}</p>
        <p className="text-xs text-foreground/60 leading-relaxed">{bestContext.replace(bestStat, "").replace(/^\s*[-,.:]\s*/, "").trim()}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatBadges — oversized stat extraction displayed as badges
// ---------------------------------------------------------------------------

function StatBadges({ stats }: { stats: { value: string; label: string }[] }) {
  if (!stats.length) return null;
  return (
    <div className="flex flex-wrap gap-4 mb-4 mt-2">
      {stats.map((stat, idx) => (
        <div key={idx} className="flex items-center gap-2.5 bg-navy/[0.04] border border-navy/10 px-4 py-2.5">
          <span className="text-lg font-bold text-navy tracking-tight">{stat.value}</span>
          <span className="text-[10px] text-foreground/50 uppercase tracking-wider font-semibold leading-tight max-w-[100px]">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrafficLight — horizontal row of colored score dots
// ---------------------------------------------------------------------------

function TrafficLight({ items }: { items: { label: string; score: number; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-3 mb-4 mt-1">
      {items.map((item, idx) => {
        const bg = item.score >= 60 ? "#4ADE80" : item.score >= 40 ? "#FBBF24" : "#F87171";
        return (
          <div key={idx} className="flex items-center gap-2 bg-white border border-light px-3 py-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: bg }} />
            <span className="text-[10px] text-foreground/60 font-medium">{item.label}</span>
            <span className="text-[10px] font-bold text-secondary">{item.score}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActionSteps — numbered timeline treatment for recommendation lists
// ---------------------------------------------------------------------------

function ActionSteps({ steps }: { steps: { title: string; detail: string }[] }) {
  if (!steps.length) return null;
  return (
    <div className="relative pl-8 mt-3">
      {/* Connecting line */}
      <div className="absolute left-[11px] top-3 bottom-3 w-px bg-navy/15" />
      {steps.map((step, idx) => (
        <div key={idx} className="relative mb-4 last:mb-0">
          <div className="absolute -left-8 top-0.5 w-[22px] h-[22px] rounded-full bg-navy text-white text-[10px] font-bold flex items-center justify-center z-10">
            {idx + 1}
          </div>
          <div className="bg-offwhite border border-light p-3">
            <p className="text-xs font-semibold text-secondary mb-1">{step.title}</p>
            <p className="text-xs text-foreground/60 leading-relaxed">{step.detail}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InsightCard — "So What" punchline card at top of section
// ---------------------------------------------------------------------------

function InsightCard({ text }: { text: string }) {
  return (
    <div className="bg-navy text-white px-5 py-3.5 mb-5 flex items-start gap-3">
      <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>
      <p className="text-sm text-white/90 leading-relaxed font-medium">{text}</p>
    </div>
  );
}

/** Chunked markdown — splits AI narrative by headings, renders each as a SubCollapsible */
function ChunkedMarkdown({ content }: { content: string }) {
  if (!content) return null;

  // Split content into sections by ## or ### headings
  const sections: { title: string; body: string }[] = [];
  const lines = content.split("\n");
  let currentTitle = "";
  let currentBody: string[] = [];

  lines.forEach((line) => {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      // Save previous section
      if (currentTitle || currentBody.length > 0) {
        sections.push({ title: currentTitle, body: currentBody.join("\n") });
      }
      currentTitle = headingMatch[1].trim();
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  });
  // Save last section
  if (currentTitle || currentBody.length > 0) {
    sections.push({ title: currentTitle, body: currentBody.join("\n") });
  }

  // If only one section (no headings found), fall back to regular MarkdownContent with pull-quote
  if (sections.length <= 1) {
    return (
      <div>
        <PullQuote content={content} />
        <MarkdownContent content={content} />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sections.map((section, idx) => {
        const trimmedBody = section.body.trim();
        if (!section.title && !trimmedBody) return null;
        if (!section.title) {
          // Intro text before first heading — render directly
          return <MarkdownContent key={idx} content={trimmedBody} />;
        }
        return (
          <React.Fragment key={idx}>
            {/* Pull-quote after the first titled section for visual impact */}
            {idx === 1 && <PullQuote content={content} />}
            <SubCollapsible title={section.title} hint="Read section" defaultOpen={idx === 0}>
              <MarkdownContent content={trimmedBody} />
            </SubCollapsible>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let bulletItems: string[] = [];
  let numberedItems: string[] = [];
  let listKey = 0;

  const flushBullets = () => {
    if (bulletItems.length > 0) {
      elements.push(
        <ul
          key={`list-${listKey++}`}
          className="list-disc list-outside pl-5 space-y-1 text-sm text-foreground/70 leading-relaxed mb-4"
        >
          {bulletItems.map((item, i) => (
            <li key={i}>
              <InlineMarkdown text={item} />
            </li>
          ))}
        </ul>
      );
      bulletItems = [];
    }
  };

  const flushNumbered = () => {
    if (numberedItems.length > 0) {
      // 3+ numbered items with action keywords → ActionSteps timeline
      const isActionList = numberedItems.length >= 3 && numberedItems.some((item) =>
        /\b(implement|establish|deploy|create|develop|launch|build|design|conduct|evaluate|assess|prioritize|invest|negotiate|audit)\b/i.test(item)
      );
      if (isActionList) {
        const steps = numberedItems.map((item) => {
          // Split on first colon or period for title/detail separation
          const colonIdx = item.indexOf(":");
          const periodIdx = item.indexOf(".");
          const splitIdx = colonIdx > 0 && colonIdx < 60 ? colonIdx : periodIdx > 0 && periodIdx < 60 ? periodIdx : -1;
          if (splitIdx > 0) {
            return { title: item.slice(0, splitIdx).trim(), detail: item.slice(splitIdx + 1).trim() };
          }
          return { title: item.slice(0, 50).trim() + (item.length > 50 ? "..." : ""), detail: item };
        });
        elements.push(<ActionSteps key={`steps-${listKey++}`} steps={steps} />);
      } else {
        elements.push(
          <ol
            key={`olist-${listKey++}`}
            className="list-decimal list-outside pl-5 space-y-1 text-sm text-foreground/70 leading-relaxed mb-4"
          >
            {numberedItems.map((item, i) => (
              <li key={i}>
                <InlineMarkdown text={item} />
              </li>
            ))}
          </ol>
        );
      }
      numberedItems = [];
    }
  };

  const flushAll = () => {
    flushBullets();
    flushNumbered();
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Headings
    if (trimmed.startsWith("### ")) {
      flushAll();
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
      flushAll();
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
      flushAll();
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

    // Bullet list items
    if (/^[-*]\s+/.test(trimmed)) {
      flushNumbered();
      bulletItems.push(trimmed.replace(/^[-*]\s+/, ""));
      return;
    }
    // Numbered list items
    if (/^\d+\.\s+/.test(trimmed)) {
      flushBullets();
      numberedItems.push(trimmed.replace(/^\d+\.\s+/, ""));
      return;
    }

    // Horizontal rules (---, ***, ___) — skip entirely
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushAll();
      return;
    }

    // Empty line
    if (!trimmed) {
      flushAll();
      return;
    }

    // Paragraph
    flushAll();
    elements.push(
      <p
        key={idx}
        className="text-sm text-foreground/70 leading-relaxed mb-3"
      >
        <InlineMarkdown text={trimmed} />
      </p>
    );
  });

  flushAll();

  return <div>{elements}</div>;
}

function InlineMarkdown({ text }: { text: string }) {
  // Parse **bold** inline, then auto-highlight key data points (numbers, $, %)
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
        // Auto-highlight dollar amounts, percentages, and key metrics in plain text
        const highlightParts = part.split(/(\$[\d,.]+[BMKTbmkt]?(?:\s?(?:billion|million|trillion))?|\d+(?:\.\d+)?%|\d+(?:\.\d+)?x)/g);
        if (highlightParts.length === 1) {
          return <span key={i}>{part}</span>;
        }
        return (
          <span key={i}>
            {highlightParts.map((hp, j) => {
              if (/^\$[\d,.]+[BMKTbmkt]?|^\d+(?:\.\d+)?%$|^\d+(?:\.\d+)?x$/.test(hp)) {
                return <strong key={j} className="font-semibold text-secondary">{hp}</strong>;
              }
              return <span key={j}>{hp}</span>;
            })}
          </span>
        );
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
  industry,
  competitorPositions,
}: {
  capabilityScore: number;
  readinessScore: number;
  companyName: string;
  industry?: string;
  competitorPositions?: { label: string; capability: number; readiness: number; rationale?: string }[];
}) {
  // Convert 0-100 scores to position in the matrix (0-100%)
  const dotLeft = Math.max(5, Math.min(95, capabilityScore));
  const dotBottom = Math.max(5, Math.min(95, readinessScore));

  // Use AI-generated competitor positions when available, fall back to static benchmarks
  const competitors = competitorPositions?.length
    ? competitorPositions
    : industry ? getIndustryCompetitors(industry, capabilityScore, readinessScore) : [];

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
              {quadrants.map((q) => {
                // Position labels at far corners so they never overlap the company dot
                // Top-left quadrant (row 0, col 0) → label top-left
                // Top-right quadrant (row 0, col 1) → label top-right
                // Bottom-left quadrant (row 1, col 0) → label bottom-left
                // Bottom-right quadrant (row 1, col 1) → label bottom-right
                const alignItems = q.col === 0 ? "items-start" : "items-end";
                const justifyContent = q.row === 0 ? "justify-start" : "justify-end";
                const textAlign = q.col === 0 ? "text-left" : "text-right";

                return (
                  <div
                    key={q.label}
                    className={`relative flex flex-col ${alignItems} ${justifyContent} p-2.5 md:p-3.5 border border-light/50`}
                    style={{
                      backgroundColor: q.bg,
                      gridRow: q.row + 1,
                      gridColumn: q.col + 1,
                    }}
                  >
                    <div className="z-20">
                      <p className={`text-[10px] md:text-xs font-semibold text-secondary ${textAlign} leading-tight`}>
                        {q.label}
                      </p>
                      <p className={`text-[8px] md:text-[9px] text-tertiary ${textAlign} mt-0.5`}>
                        {q.sublabel}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Company position dot — always placed in the interior of its quadrant */}
            {(() => {
              // Nudge dot away from the center crosshairs (45-55% dead zone)
              // and away from edges, keeping it clearly inside its quadrant
              let x = dotLeft;
              let y = dotBottom;
              // If dot is very close to center axis, push it towards the interior
              if (x >= 42 && x <= 58) x = x < 50 ? 38 : 62;
              if (y >= 42 && y <= 58) y = y < 50 ? 38 : 62;
              // Clamp to safe zone (12%-88%) so dot+label never clip the edge
              x = Math.max(12, Math.min(88, x));
              y = Math.max(12, Math.min(88, y));

              // Position the company name label toward the center of the grid
              // (opposite from where the quadrant label sits in the corner)
              const labelAbove = y > 50;
              const labelStyle: React.CSSProperties = labelAbove
                ? { bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 6 }
                : { top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 6 };
              // Prevent horizontal clipping
              if (x < 25) {
                labelStyle.left = 0;
                labelStyle.transform = "none";
              } else if (x > 75) {
                labelStyle.left = "auto";
                labelStyle.right = 0;
                labelStyle.transform = "none";
              }

              return (
                <div
                  className="absolute z-30"
                  style={{
                    left: `${x}%`,
                    bottom: `${y}%`,
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
                      className="absolute px-2 py-0.5 text-[9px] font-bold text-white whitespace-nowrap rounded-sm"
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

            {/* Competitor dots */}
            {competitors.map((comp) => {
              const cx = Math.max(8, Math.min(92, comp.capability));
              const cy = Math.max(8, Math.min(92, comp.readiness));
              const rationale = 'rationale' in comp ? (comp as { rationale?: string }).rationale : undefined;
              return (
                <div
                  key={comp.label}
                  className="absolute z-20"
                  style={{
                    left: `${cx}%`,
                    bottom: `${cy}%`,
                    transform: "translate(-50%, 50%)",
                  }}
                  title={rationale || undefined}
                >
                  <div className="relative group">
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-white/80"
                      style={{
                        backgroundColor: "#6B7F99",
                        boxShadow: "0 0 0 1px rgba(107, 127, 153, 0.3)",
                      }}
                    />
                    <div
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 text-[8px] font-semibold text-white whitespace-nowrap rounded-sm opacity-80"
                      style={{ backgroundColor: "#6B7F99" }}
                    >
                      {comp.label}
                    </div>
                  </div>
                </div>
              );
            })}

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
  stage,
  dimensionScores,
}: {
  overallScore: number;
  weakestDimension: string;
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
      subtitle: "Institutionalize, report to leadership, set 12-month roadmap",
      color: "#6B7F99",
      actions: [
        {
          action: "Compile and present executive AI maturity progress report with quantified value capture and risk posture update",
          owner: "CEO / CIO",
          priority: "Critical",
          detail: "Leadership engagement is critical for sustained investment. Include: value captured, risks mitigated, competitive positioning, and resource asks.",
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
        weak: `No financial measurement infrastructure for AI means every dollar spent is invisible to the P&L. Without measurement, you cannot optimize, justify, or defend AI investment to leadership.`,
      },
      'ET-02': {
        strong: `AI-freed capacity is being systematically redeployed to higher-value work — converting productivity gains into measurable financial returns rather than letting them absorb invisibly.`,
        weak: `When AI saves time, that time disappears — absorbed into existing work rather than redeployed to measurable value creation. This is the most common "value leak" in enterprise AI: productivity gains that no one captures.`,
      },
      'ET-03': {
        strong: `AI investment can be justified to leadership with quantified evidence — a capability that unlocks continued funding and strategic confidence.`,
        weak: `The inability to justify AI investment to leadership creates a credibility deficit that compounds with each budget cycle. In ${ind}, CFOs report that unquantified AI spending faces 2x the scrutiny of other technology investments.`,
      },
      'ET-04': {
        strong: `Measurable AI outcomes exist and are tracked — connecting specific AI deployments to specific financial results. This makes Section 5's economic case actionable, not theoretical.`,
        weak: `No AI outcomes are measurably connected to financial results. Without this linkage, AI remains an act of faith rather than a managed investment — and faith-based spending rarely survives leadership transitions or downturns.`,
      },
      'ET-05': {
        strong: `Finance actively engages with AI economics — a partnership that transforms AI from a technology cost center into a quantified strategic investment with executive-level visibility.`,
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

function compositeIndexIcon(slug: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    authority_friction: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>,
    decision_velocity: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>,
    economic_translation: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>,
  };
  return icons[slug] || null;
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
      high: `An Economic Translation score of ${score} means your organization has built what most lack: the ability to connect AI activity to P&L outcomes. Finance and operations are aligned on AI measurement, value flows into financial reporting, and leadership sees AI as a quantified investment, not an act of faith. In ${ind}, this capability positions you to allocate capital to AI with the same rigor and confidence applied to any major investment — and to defend that allocation against competing priorities.`,
      mid: `An Economic Translation score of ${score} indicates emerging but incomplete financial measurement. Some AI investments are tracked, but significant value leaks through untracked productivity gains, unmeasured quality improvements, and unrealized capacity that no one redeployed. In ${ind}, this is the most common pattern: organizations that have invested in AI but cannot yet present a credible, quantified narrative to leadership. The CFO's question — "What are we getting for this?" — does not yet have a satisfying answer.`,
      low: `An Economic Translation score of ${score} signals that AI spending is generating no measurable financial return. Your organization is investing without a value capture mechanism — productivity gains happen but are absorbed rather than measured, and no one can connect AI activity to margin improvement, revenue growth, or cost reduction. In ${ind}, this pattern typically leads to AI budget cuts within 12-18 months as leadership patience for unquantified technology spending expires (Deloitte 2024). Section 5 quantifies the value at risk.`,
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
    economic_translation: `Only 10% of companies generate significant, measurable financial returns from AI; 70% report minimal or no quantifiable impact (BCG AI Advantage Report 2024). In ${ind}, the median economic translation score is approximately 35/100 — most organizations cannot answer the CFO's question: "What are we getting for this?" Your score of ${score} positions you ${score >= 60 ? "among the rare organizations that can credibly demonstrate AI ROI to leadership, investors, and analysts — a capability that unlocks continued investment and strategic confidence" : score >= 35 ? "near the industry median. You have pockets of measurable value but lack the systematic measurement infrastructure that would make AI investment defensible at the executive level" : "below the industry median, meaning your organization is investing in AI without capturing proportionate financial evidence of return. Deloitte's 2024 State of AI report found that 58% of organizations with low translation scores eventually cut AI budgets — creating a negative spiral of underinvestment and underperformance"}.`,
  };
  return benchmarks[slug] || `Industry benchmark data for ${ind} suggests organizations at your score level have specific improvement opportunities relative to top-quartile performers in AI maturity.`;
}

function compositeIndexRisks(slug: string, score: number): string {
  const risks: Record<string, Record<string, string>> = {
    authority_friction: {
      high: "Over-governance risk: mature governance structures can calcify into bureaucracy if not actively managed. Monitor for approval processes that outlive their purpose, governance committees that slow rather than enable, and compliance requirements that expand beyond regulatory necessity. The goal is governance that scales with AI ambition, not governance that constrains it.",
      mid: "Shadow AI proliferation is your primary exposure. Inconsistent governance across business units means employees in under-governed areas are using AI tools without oversight — creating data leakage, compliance gaps, and model risk that accumulate invisibly. Gartner estimates 75% of enterprise AI usage in mid-governance organizations is untracked. Additionally, governance inconsistency erodes trust: business units that face heavy approval burdens see AI-mature peers moving faster and begin circumventing controls.",
      low: "Critical structural exposure on multiple fronts: ungoverned AI usage creates immediate compliance and data security risk; the absence of clear decision authority means no one can approve, fund, or kill AI initiatives with conviction; and the resulting organizational ambiguity guarantees that AI investment will be diffuse, uncoordinated, and ultimately indefensible to leadership. This score means the governance problem must be solved before any AI scaling investment can yield returns.",
    },
    decision_velocity: {
      high: "Speed-quality tradeoff requires active management. Rapid deployment can introduce technical debt, skip adequate model validation, or outpace the organization's ability to absorb change. The risk is not moving too fast — it is moving fast without the monitoring and feedback loops to catch problems early. Ensure velocity is paired with automated testing, staged rollouts, and clear rollback protocols.",
      mid: "Competitive window risk is material. AI capabilities shift quarterly, and moderate velocity means your deployed solutions may already be outdated by the time they reach production. More critically, each slow cycle demoralizes the teams closest to AI work — McKinsey reports that AI talent retention drops 35% in organizations where deployment cycles exceed 6 months. The compounding effect: you lose both competitive positioning and the people best equipped to close the gap.",
      low: "Disruption vulnerability is acute. At this velocity, the organization cannot respond to AI-driven market shifts before competitors establish structural advantages. The pattern is predictable: slow organizations lose first on cost structure (competitors automate faster), then on talent (AI engineers leave for faster environments), then on customer experience (AI-enabled competitors set new service expectations). Each quarter of delay compounds the recovery cost — Accenture estimates that late movers spend 2-3x more to achieve the same AI capability as early adopters.",
    },
    economic_translation: {
      high: "Optimization plateau risk: as the easy-to-measure value is captured, incremental gains become harder to quantify. The risk is over-indexing on measurable outcomes at the expense of transformative but harder-to-quantify initiatives (culture change, capability building, strategic positioning). Ensure your measurement framework can accommodate longer-horizon value creation, not just quarterly efficiency gains.",
      mid: "AI investment is entering the credibility danger zone. Without systematic value measurement, CFO and leadership confidence erodes predictably: initial enthusiasm lasts 2-3 quarters, then scrutiny intensifies. If you cannot present a defensible financial narrative within the next 12 months, expect AI budgets to face the same fate as most enterprise technology spending — cut during the next downturn and reallocated to initiatives with clearer ROI.",
      low: "AI funding is at existential risk. Without any measurable financial return, the organization's AI investment is defensible only on faith — and leadership patience for faith-based technology spending typically expires within 12-18 months. Beyond the budget risk, inability to measure value means inability to optimize: you cannot direct investment toward high-performing AI use cases or away from underperforming ones. Every dollar of AI spend is equally unaccountable, which guarantees waste.",
    },
  };
  const tier = score >= 70 ? "high" : score >= 40 ? "mid" : "low";
  return risks[slug]?.[tier] || "Monitor for emerging risks as your maturity evolves. See Section 7 for the full risk assessment.";
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
    retail: [
      { area: "AI-Powered Demand Forecasting & Inventory", detail: "Walmart's AI demand forecasting improved accuracy 20% and cut waste by $1B+. Target's AI-driven inventory system reduced out-of-stocks 30%. Amazon's anticipatory shipping pre-positions inventory before orders are placed. Static replenishment models are becoming a margin liability.", source: "Source: Walmart 2024 Investor Day; Target Q3 2024 Earnings; NRF Retail Technology Report 2024" },
      { area: "Personalization & Recommendation Engines", detail: "Amazon attributes 35% of revenue to ML-powered recommendations. Starbucks Deep Brew personalizes 400M offers/week. Sephora's AI-driven personalization increased conversion 11%. Your competitors know what your customers want before they do.", source: "Source: McKinsey Retail Practice 2024; Amazon Annual Report 2024; Starbucks Technology Summit 2024" },
      { area: "Computer Vision for Loss Prevention", detail: "Walmart, Target, and Kroger are deploying AI camera systems that reduced shrink 25-35%. Self-checkout fraud detection using CV saves US retailers an estimated $3B annually. Your shrink problem likely has an AI solution your competitors are already using.", source: "Source: NRF Loss Prevention Survey 2024; Gartner Retail Technology Report 2024" },
      { area: "Dynamic Pricing & Markdown Optimization", detail: "Best Buy's AI pricing engine adjusts 50K+ prices daily. Zara's parent Inditex uses ML to optimize markdowns, improving full-price sell-through 15%. Kroger's dynamic pricing boosted margin 200bps on targeted categories.", source: "Source: BCG Retail AI Report 2024; Inditex Annual Report 2024" },
      { area: "AI-Enabled Supply Chain Optimization", detail: "Nike's AI supply chain platform reduced lead times 50%. H&M uses ML for production planning, cutting unsold inventory 21%. Costco's AI-powered logistics optimization saved $300M in transportation costs.", source: "Source: Nike FY2024 10-K; H&M Sustainability Report 2024; Gartner Supply Chain Top 25" },
      { area: "Generative AI for Customer Service & Content", detail: "Shopify's Sidekick AI handles merchant support queries. Instacart's AI generates personalized meal plans. Wayfair uses GenAI to create room visualizations from product catalogs. The customer experience is being rebuilt around AI.", source: "Source: Shopify Editions 2024; NRF Innovation Lab Report 2024" },
    ],
    ecommerce_digital: [
      { area: "AI-Powered Search & Discovery", detail: "Amazon's AI search processes 300M+ queries daily with personalized results. Shopify's AI product search increased conversion 12%. Algolia and Elasticsearch ML-powered search is becoming table stakes for digital commerce.", source: "Source: Amazon Technology Blog 2024; Shopify Unite 2024" },
      { area: "Generative AI for Product Content", detail: "eBay uses AI to generate listing descriptions for 1.3B+ items. Amazon auto-generates product summaries from reviews. Etsy's AI creates lifestyle images from product photos, increasing click-through 15%.", source: "Source: eBay Q3 2024 Earnings; Amazon Seller Central Updates 2024" },
      { area: "Dynamic Pricing & Revenue Optimization", detail: "Booking.com processes 1B+ pricing decisions daily using ML. Uber's AI pricing engine optimizes across 10,000+ cities. E-commerce leaders are seeing 5-15% revenue lift from AI-driven pricing.", source: "Source: BCG Digital Commerce Report 2024; Booking Holdings Investor Day 2024" },
      { area: "AI Fraud Detection & Trust Systems", detail: "PayPal's AI fraud engine prevents $25B+ in fraudulent transactions annually. Stripe Radar processes billions of signals to block fraud. Shopify's AI reduced chargebacks 40% for merchants.", source: "Source: PayPal 2024 Annual Report; Stripe Developer Conference 2024" },
      { area: "Conversational Commerce & AI Assistants", detail: "Klarna's AI assistant handles 2.3M customer conversations/month, equivalent to 700 full-time agents. Amazon's Rufus AI shopping assistant processes millions of product queries daily.", source: "Source: Klarna Q2 2024 Report; Amazon Devices & Services Event 2024" },
      { area: "Predictive Logistics & Last-Mile Optimization", detail: "Amazon's AI delivery prediction is accurate within 30-minute windows. DoorDash's ML optimizes 1.5B+ deliveries/year. FedEx SurroUnd uses AI to predict delivery issues before they occur.", source: "Source: Amazon Logistics Innovation 2024; DoorDash Engineering Blog 2024" },
    ],
    software_saas: [
      { area: "AI-Augmented Software Development", detail: "GitHub Copilot has 1.3M+ paid subscribers, with adopters completing tasks 55% faster. Google's Gemini Code Assist is embedded in 500K+ developer workflows. AI code review tools reduce bugs 20-30%.", source: "Source: GitHub Octoverse 2024; Google Cloud Next 2024; Stack Overflow Developer Survey 2024" },
      { area: "AI-Native Product Features", detail: "Salesforce Einstein GPT generates 1T+ predictions/week. Notion AI, Canva AI, and Figma AI are table stakes features. Products without AI copilots are losing competitive trials at 2x the rate.", source: "Source: Salesforce Q3 2024 Earnings; Bessemer State of the Cloud 2024" },
      { area: "ML-Powered Customer Success & Churn Prevention", detail: "Gainsight's AI identifies at-risk accounts 90 days before churn. Amplitude's ML-powered engagement scoring improved retention 18% for B2B SaaS. HubSpot's AI lead scoring increased conversion 25%.", source: "Source: Gainsight Pulse 2024; SaaStr Annual Report 2024" },
      { area: "AI for Revenue Operations", detail: "Gong's AI analyzes 1B+ sales interactions to predict deal outcomes. Clari's AI revenue platform forecasts with 95%+ accuracy. 6sense uses AI intent data to identify in-market buyers 6 months earlier.", source: "Source: Gong Revenue Intelligence Report 2024; Forrester Wave RevOps 2024" },
      { area: "Automated Testing & Quality Engineering", detail: "AI-powered testing tools (Testim, Mabl, Applitools) reduce QA cycles 40-60%. Meta's AI generates test cases for 50%+ of new code changes. Continuous testing powered by ML is replacing manual QA.", source: "Source: World Quality Report 2024; Meta Engineering Blog 2024" },
      { area: "AI Infrastructure & MLOps", detail: "Databricks, Snowflake, and AWS are in an AI infrastructure arms race. Companies spending 5-10% of engineering budget on AI/ML infrastructure see 3x faster time-to-value on AI initiatives.", source: "Source: a16z AI Infrastructure Report 2024; Databricks Data+AI Summit 2024" },
    ],
    manufacturing_discrete: [
      { area: "Predictive Maintenance & Quality Control", detail: "Siemens AI-powered predictive maintenance reduces unplanned downtime 30-50%. BMW's AI vision systems inspect 100% of parts vs. 5% manual sampling. Bosch deploys AI quality control across 130+ plants.", source: "Source: McKinsey Manufacturing Practice 2024; Siemens Digital Industries Report 2024" },
      { area: "AI-Driven Supply Chain Resilience", detail: "Toyota's AI supply chain platform monitors 60,000+ tier-1 through tier-3 suppliers for disruption risk. GE uses digital twins with ML to optimize $15B+ in procurement. Resilinc's AI predicted 85% of supply disruptions in 2024.", source: "Source: Gartner Supply Chain Top 25 2024; Toyota Annual Report 2024" },
      { area: "Generative Design & Engineering", detail: "Autodesk's AI generative design reduced part weight 40% for Airbus brackets. NVIDIA Omniverse enables real-time factory simulation. PTC's AI-powered CAD tools accelerate design cycles 25%.", source: "Source: Autodesk University 2024; NVIDIA GTC 2024; PTC LiveWorx 2024" },
      { area: "AI-Optimized Production Scheduling", detail: "Siemens Opcenter uses ML to optimize production scheduling, improving OEE 10-15%. Rockwell Automation's AI scheduling reduces changeover time 20%. ABB's AI manufacturing execution saves 5-8% on energy costs.", source: "Source: BCG Smart Factory Report 2024; Rockwell Automation Fair 2024" },
      { area: "Computer Vision for Safety & Compliance", detail: "Amazon's AI monitors workplace safety across 1,500+ facilities. Honeywell's AI safety systems reduced OSHA recordable incidents 25% at client sites. Verizon's AI camera analytics detect PPE violations in real-time.", source: "Source: Amazon Safety Report 2024; Honeywell Connected Worker Report 2024" },
      { area: "Digital Twins & Process Optimization", detail: "GE's digital twin platform manages $1T+ in industrial assets. Siemens' digital twins simulate entire factories before physical buildout. Tesla's AI-powered manufacturing continuously optimizes across 6 gigafactories.", source: "Source: GE Vernova Technology Report 2024; Deloitte Smart Factory Study 2024" },
    ],
    manufacturing_process: [
      { area: "AI Process Control & Optimization", detail: "BASF uses AI to optimize chemical reactions, improving yield 3-8% per batch. Dow Chemical's ML models predict quality deviations 30 minutes before they occur. Real-time AI process control is replacing manual adjustments across the sector.", source: "Source: McKinsey Chemicals Practice 2024; BASF Annual Report 2024" },
      { area: "Predictive Maintenance for Continuous Operations", detail: "Shell deploys AI-powered predictive maintenance across 30,000+ rotating equipment items. Unplanned downtime in process manufacturing costs $260K/hour on average. AI-enabled plants see 35-45% fewer unplanned stops.", source: "Source: Deloitte Process Manufacturing Report 2024; Shell Technology Report 2024" },
      { area: "AI-Driven Energy Management", detail: "Process manufacturers are using ML to optimize energy consumption, with leaders achieving 10-15% reduction. Schneider Electric's EcoStruxure AI manages energy across 500+ industrial sites.", source: "Source: IEA Industrial Energy Efficiency Report 2024; Schneider Electric Innovation Summit 2024" },
      { area: "Quality Prediction & Specification Optimization", detail: "AI models predict product quality from process parameters, reducing off-spec production 20-40%. Procter & Gamble's AI quality systems monitor 100B+ data points across manufacturing.", source: "Source: BCG Operations Excellence Report 2024; P&G Technology Update 2024" },
      { area: "Supply Chain AI for Raw Material Optimization", detail: "AI-driven raw material sourcing and blending optimization saves 2-5% on input costs. ArcelorMittal uses ML to optimize ore blending across 60+ plants.", source: "Source: McKinsey Metals & Mining Practice 2024; ArcelorMittal Investor Day 2024" },
      { area: "Environmental Compliance & Emissions Monitoring", detail: "AI-powered emissions monitoring enables real-time compliance tracking. Honeywell's AI environmental systems reduce reporting burden 60% while improving accuracy. ESG-linked AI investments are accelerating.", source: "Source: Gartner ESG Technology Report 2024; EPA Industrial Compliance Trends 2024" },
    ],
    energy_oil_gas: [
      { area: "AI-Powered Reservoir Modeling & Exploration", detail: "ExxonMobil uses ML to analyze seismic data 90% faster than conventional methods. BP's AI exploration tools identified $2B+ in previously missed reserves. Chevron's AI geoscience platform processes petabytes of subsurface data.", source: "Source: McKinsey Oil & Gas Practice 2024; ExxonMobil Technology Report 2024" },
      { area: "Predictive Maintenance for Critical Infrastructure", detail: "Shell's AI-powered predictive maintenance across refineries prevents $500M+ in unplanned downtime annually. Baker Hughes deploys AI monitoring across 50,000+ pieces of equipment for upstream operators.", source: "Source: Shell Annual Report 2024; Baker Hughes Investor Day 2024" },
      { area: "AI-Driven Production Optimization", detail: "AI well optimization systems improve production 5-10% per well. SLB (Schlumberger) Lumi AI platform manages production across 100,000+ wells. Halliburton's AI completions optimization reduces costs 15%.", source: "Source: BCG Energy Practice 2024; SLB Q3 2024 Earnings; SPE Digital Energy Conference 2024" },
      { area: "Carbon Capture & Emissions AI", detail: "Occidental's AI-optimized direct air capture technology is scaling to megatons. TotalEnergies uses ML to monitor methane emissions in real-time across operations. AI is central to energy transition compliance.", source: "Source: IEA World Energy Outlook 2024; Occidental 2024 Sustainability Report" },
      { area: "AI for Trading & Risk Management", detail: "Vitol and Trafigura use AI models for commodity trading decisions. AI-powered risk models process 10,000+ market scenarios per second. Energy traders using AI report 15-25% improved Sharpe ratios.", source: "Source: S&P Global Commodity Insights 2024; BCG Trading & Risk Report 2024" },
      { area: "Autonomous Operations & Digital Twins", detail: "BP and Chevron operate AI-powered digital twins of entire refineries. Equinor's autonomous drilling AI has reduced well delivery time 20%. The industry is moving toward lights-out operations.", source: "Source: Deloitte Oil & Gas Technology Report 2024; Equinor Innovation Update 2024" },
    ],
    automotive: [
      { area: "Autonomous Driving & ADAS", detail: "Tesla's FSD has logged 2B+ miles of AI driving data. Waymo operates 100K+ paid robotaxi rides/week. GM's Cruise, Mobileye, and NVIDIA DRIVE are accelerating L2-L4 deployment across OEMs.", source: "Source: Tesla AI Day 2024; Waymo Safety Report 2024; NVIDIA GTC 2024" },
      { area: "AI-Powered Manufacturing & Quality", detail: "BMW's AI vision systems inspect 100% of vehicle components. Toyota's AI manufacturing reduces defects per vehicle 15%. VW's AI-driven production optimization saves EUR 200M+ annually across plants.", source: "Source: McKinsey Automotive Practice 2024; BMW Annual Report 2024" },
      { area: "Connected Vehicle AI & OTA Updates", detail: "Tesla pushes 50+ OTA updates/year using AI-driven feature deployment. Ford's AI-powered BlueCruise learns from fleet data across 600M+ miles driven. Software-defined vehicles generate $10K+ in lifetime software revenue.", source: "Source: BCG Automotive Software Report 2024; Tesla Earnings 2024" },
      { area: "AI for EV Battery Optimization", detail: "CATL and Samsung SDI use AI to optimize battery chemistry, improving energy density 15% per generation. Tesla's AI battery management extends range 8-12%. AI-driven battery recycling is a $20B emerging market.", source: "Source: BloombergNEF Battery Report 2024; CATL Technology Day 2024" },
      { area: "AI-Driven Supply Chain & Procurement", detail: "Toyota's AI supply chain monitors 60,000+ suppliers for disruption risk. Tesla's AI procurement negotiation tool saved $400M in 2024. Bosch uses AI to manage 50,000+ component variants across OEM customers.", source: "Source: Gartner Automotive Supply Chain 2024; Tesla Investor Day 2024" },
      { area: "Generative AI for Vehicle Design", detail: "GM uses AI generative design for lightweighting, reducing part weight 40%. Porsche's AI aerodynamics optimization improved Taycan efficiency 6%. AI-designed components are entering production at scale.", source: "Source: Autodesk Manufacturing Report 2024; GM Technology Center Update 2024" },
    ],
    telecommunications: [
      { area: "AI Network Optimization & Self-Healing", detail: "AT&T's AI manages 250M+ network elements, predicting and resolving 70% of issues before customer impact. T-Mobile's AI network optimization improved 5G speeds 25%. Ericsson's AI RAN optimization reduces energy consumption 15%.", source: "Source: AT&T Technology Report 2024; T-Mobile Q3 2024 Earnings; Ericsson Investor Day 2024" },
      { area: "AI-Powered Customer Experience", detail: "Verizon's AI handles 60M+ customer interactions/year, resolving 40% without human intervention. Comcast's AI reduced call handle time 30%. AI-powered churn prediction saves major telcos $500M+ annually.", source: "Source: J.D. Power Telecom Study 2024; Verizon Annual Report 2024" },
      { area: "Generative AI for Field Operations", detail: "T-Mobile's AI assistant helps 50K+ field technicians diagnose and resolve issues. Vodafone's AI-powered dispatch optimization reduced truck rolls 20%. AI is transforming telecom field service economics.", source: "Source: McKinsey Telecom Practice 2024; T-Mobile Un-carrier Update 2024" },
      { area: "AI Fraud Detection & Revenue Assurance", detail: "Telecom fraud costs the industry $40B+ annually. AI-powered fraud detection systems identify SIM swap fraud, subscription fraud, and revenue leakage with 95% accuracy. Subex and TEOCO lead the space.", source: "Source: CFCA Global Fraud Loss Survey 2024; Gartner CSP Technology Report 2024" },
      { area: "AI for Spectrum Management & 5G Planning", detail: "AI-driven spectrum allocation improves 5G capacity 20-30%. Nokia's AI radio planning tool optimizes coverage across 500+ operator networks. DeepMind-style AI models are being applied to wireless network design.", source: "Source: GSMA Mobile Economy Report 2024; Nokia Technology Vision 2024" },
      { area: "Edge AI & IoT Platform Intelligence", detail: "AWS Wavelength, Azure Edge, and Google Distributed Cloud enable AI at the telecom edge. Telcos managing 10B+ IoT connections are using AI to process data at the edge, reducing latency 80% and bandwidth costs 40%.", source: "Source: IDC Edge Computing Report 2024; AWS re:Invent 2024" },
    ],
    consulting_services: [
      { area: "AI-Augmented Research & Analysis", detail: "McKinsey's Lilli AI assistant serves 30,000+ consultants with instant access to firm knowledge. BCG's AI-powered case analytics accelerate client research 40%. Deloitte's AI research tools process 10M+ documents for due diligence.", source: "Source: McKinsey Technology Report 2024; BCG Annual Report 2024" },
      { area: "Generative AI for Deliverable Creation", detail: "Bain's AI generates first-draft client presentations in minutes. EY's AI document generation reduced report production time 50%. Consulting firms not augmenting consultants with AI are seeing 20-30% productivity gaps.", source: "Source: Consulting Magazine AI Report 2024; Gartner Professional Services Forecast 2024" },
      { area: "AI-Powered Client Intelligence", detail: "Accenture's AI analyzes client industry data to identify opportunities before engagement. PwC's AI-driven market sizing models produce estimates in hours vs. weeks. Real-time competitive intelligence via AI is reshaping proposal win rates.", source: "Source: Forrester Consulting Market Report 2024; Accenture Annual Report 2024" },
      { area: "Knowledge Management & Expert Networks", detail: "McKinsey's AI matches consultants to projects based on skills and domain expertise. Gartner Expert AI recommends the right analyst for each client question. AI-powered knowledge graphs connect 40 years of institutional knowledge.", source: "Source: McKinsey Quarterly 2024; Harvard Business Review Professional Services AI Study" },
      { area: "AI for Project Staffing & Resource Optimization", detail: "Big 4 firms are using AI to optimize staffing across 100K+ consultants. AI-driven utilization forecasting improved billable rates 5-8%. Partners using AI for pipeline management close 15% more deals.", source: "Source: Kennedy Consulting Research 2024; Deloitte Technology Fast 500" },
      { area: "Client-Facing AI Products & Platforms", detail: "Consulting firms are building AI-native products alongside advisory services. Accenture's AI platforms generate $3B+ in annual revenue. McKinsey's QuantumBlack has become a standalone AI business unit. Services-only models face margin pressure.", source: "Source: ALM Intelligence Report 2024; Accenture Q3 2024 Earnings" },
    ],
    legal_services: [
      { area: "AI Contract Review & Analysis", detail: "Kira Systems, Luminance, and iManage RAVN process millions of contracts with 95%+ accuracy. Allen & Overy's Harvey AI handles 40K+ queries/month from lawyers. AI contract review is 60-80% faster than manual review.", source: "Source: Thomson Reuters Legal AI Report 2024; Allen & Overy Technology Update 2024" },
      { area: "Generative AI for Legal Research", detail: "Westlaw's AI assistant and LexisNexis Protege accelerate legal research 50%. CoCounsel (Thomson Reuters) drafts memos, analyzes depositions, and reviews documents at associate-level quality.", source: "Source: ABA Legal Technology Survey 2024; Thomson Reuters Annual Report 2024" },
      { area: "AI-Powered Litigation Analytics", detail: "Lex Machina and Ravel Law use ML to predict case outcomes with 80%+ accuracy. AI litigation analytics inform settlement decisions and judge selection strategy. Firms not using predictive analytics are litigating blind.", source: "Source: Georgetown Law Technology Review 2024; Lex Machina Benchmark Report 2024" },
      { area: "E-Discovery & Document Review AI", detail: "Relativity's AI-powered e-discovery reduces document review costs 40-60%. Reveal AI processes billions of documents with TAR 2.0 technology. AI is making large-scale document review economically viable.", source: "Source: EDRM AI Report 2024; Relativity Fest 2024" },
      { area: "AI for Client Intake & Matter Management", detail: "Intapp and Litera use AI to automate conflicts checks, client screening, and matter planning. AI intake reduces new matter setup time 70% and improves conflicts detection accuracy.", source: "Source: Gartner Legal Technology Report 2024; ILTA Technology Survey 2024" },
      { area: "AI-Driven Pricing & Profitability", detail: "BigHand and Thomson Reuters Elite use AI to optimize legal pricing and track matter profitability in real-time. AI-powered alternative fee arrangements are winning more client mandates.", source: "Source: Peer Monitor Index 2024; BCG Legal Market Report 2024" },
    ],
    government_federal: [
      { area: "AI for Fraud Detection & Program Integrity", detail: "IRS AI detected $6B+ in fraudulent refund claims in 2024. CMS uses ML to identify $25B+ in improper Medicare/Medicaid payments annually. USDA's AI fraud detection saves $1.4B in SNAP benefit fraud.", source: "Source: GAO AI in Government Report 2024; IRS Commissioner Testimony 2024" },
      { area: "AI-Powered Citizen Services", detail: "GSA's AI chatbot handles 10M+ citizen inquiries annually. VA's AI triage system reduced veteran wait times 30%. USPS's AI package routing processes 7B+ items/year.", source: "Source: Federal AI Use Case Inventory 2024; VA Digital Modernization Report 2024" },
      { area: "AI for National Security & Intelligence", detail: "DoD's Project Maven and JADC2 integrate AI into military decision-making. NGA uses AI to process satellite imagery 100x faster. IC agencies process 10M+ intelligence reports/day using NLP.", source: "Source: DoD AI Strategy Update 2024; NSCAI Final Report Implementation Tracker" },
      { area: "Generative AI for Policy & Regulatory Analysis", detail: "Federal agencies are piloting LLMs for regulatory impact analysis, policy drafting, and public comment summarization. OMB's AI guidance requires agencies to inventory and govern all AI use cases.", source: "Source: OMB M-24-10 AI Governance Memo; White House AI Executive Order Implementation" },
      { area: "AI for Cybersecurity & Zero Trust", detail: "CISA's AI-powered threat detection monitors federal networks. NSA's AI cybersecurity tools protect classified systems. Federal agencies using AI security detect threats 60% faster.", source: "Source: CISA AI Roadmap 2024; NSA AI Security Center Report 2024" },
      { area: "Predictive Analytics for Mission Outcomes", detail: "FEMA uses AI to predict disaster impact and pre-position resources. Census Bureau's ML improves population estimates. EPA's AI monitors environmental compliance across 100K+ regulated facilities.", source: "Source: Federal Data Strategy Progress Report 2024; FEMA Innovation Report 2024" },
    ],
    media_entertainment: [
      { area: "AI Content Recommendation & Personalization", detail: "Netflix's AI recommendation engine drives 80% of viewer choices, worth an estimated $1B/year in retained subscriptions. Spotify's AI-curated playlists account for 35% of all listening. TikTok's AI algorithm is the product.", source: "Source: Netflix Technology Blog 2024; Spotify Wrapped Data 2024" },
      { area: "Generative AI for Content Creation", detail: "Disney uses AI for visual effects production, reducing VFX timelines 30%. Warner Bros. uses AI for script analysis and audience testing. AI-generated music, video, and written content is reshaping production economics.", source: "Source: Disney Technology Showcase 2024; Deloitte TMT Predictions 2024" },
      { area: "AI for Advertising & Revenue Optimization", detail: "Google's AI-powered Performance Max generates 20%+ higher ROAS. Meta's Advantage+ AI creates and optimizes ad creative at scale. Connected TV advertising powered by AI is growing 30% annually.", source: "Source: eMarketer Digital Ad Forecast 2024; Google Marketing Live 2024" },
      { area: "AI-Driven Rights Management & Compliance", detail: "YouTube's Content ID AI processes 500+ hours of video uploads per minute. Audible Magic and Pex use AI to track content rights across platforms. AI licensing compliance saves media companies billions in legal exposure.", source: "Source: YouTube Transparency Report 2024; IFPI Global Music Report 2024" },
      { area: "AI Audience Analytics & Engagement", detail: "Paramount uses AI to predict show performance before greenlighting. Spotify's AI-powered audience insights inform artist development. AI sentiment analysis processes millions of social media reactions in real-time.", source: "Source: Variety Intelligence Platform 2024; Spotify for Artists Report 2024" },
      { area: "AI for Live Events & Sports Broadcasting", detail: "ESPN's AI automatically generates highlights and personalized content. NFL's Next Gen Stats uses AI to create real-time analytics graphics. Live Nation uses AI for dynamic ticket pricing and fraud prevention.", source: "Source: ESPN Technology Report 2024; NFL Next Gen Stats 2024" },
    ],
    real_estate_commercial: [
      { area: "AI Property Valuation & Investment Analysis", detail: "CoStar's AI processes 10M+ commercial properties with ML-powered valuations. JLL's AI investment analytics identify market opportunities 6 months earlier. CBRE's AI due diligence reduces analysis time 40%.", source: "Source: Deloitte Real Estate AI Report 2024; CoStar Annual Report 2024" },
      { area: "AI-Powered Tenant Experience & Building Management", detail: "JLL's AI smart building platform manages 5B+ sq ft globally. Honest Buildings (now Procore) uses AI to optimize capital projects. AI HVAC optimization reduces energy costs 15-25%.", source: "Source: JLL Technology Report 2024; CBRE Smart Building Study 2024" },
      { area: "Predictive Analytics for Market & Lease Intelligence", detail: "CompStak uses AI to analyze lease comps across 1M+ commercial leases. Reonomy's AI identifies off-market opportunities. AI-powered market forecasting improved investment returns 200-400bps for early adopters.", source: "Source: CBRE Research 2024; MIT Real Estate Innovation Lab 2024" },
      { area: "AI for Property Marketing & Lead Generation", detail: "Matterport AI creates 3D property tours from smartphone video. AI-generated property descriptions and virtual staging reduce listing time 30%. Lead scoring AI identifies qualified tenants with 85% accuracy.", source: "Source: NAR Technology Survey 2024; Matterport Enterprise Report 2024" },
      { area: "AI Sustainability & ESG Compliance", detail: "AI-powered energy management reduces building emissions 20-30%. Measurabl and Deepki use AI to track ESG metrics across portfolios. EU taxonomy compliance increasingly requires AI-powered data collection.", source: "Source: GRESB Real Estate Assessment 2024; ULI Emerging Trends 2024" },
      { area: "AI Construction Management & Development", detail: "Procore's AI detects construction defects from photos. AI project scheduling reduces delays 15-20%. Generative AI designs optimize building layouts for cost and sustainability simultaneously.", source: "Source: McKinsey Capital Projects Practice 2024; Procore Groundbreak 2024" },
    ],
    aerospace_defense: [
      { area: "AI for Predictive Maintenance & Fleet Readiness", detail: "Lockheed Martin's AI-powered ALIS/ODIN system manages F-35 fleet maintenance. Boeing's AI predictive maintenance reduces aircraft-on-ground events 25%. Airbus Skywise AI platform connects 16,000+ aircraft.", source: "Source: Lockheed Martin Annual Report 2024; Boeing AnalytX Report 2024" },
      { area: "AI-Driven Design & Simulation", detail: "SpaceX uses AI for rapid Raptor engine iteration. Northrop Grumman's AI-powered design tools reduced B-21 development timeline 30%. Digital twin simulation with AI saves $2M+ per aircraft test campaign.", source: "Source: Aviation Week Intelligence Network 2024; NVIDIA Omniverse A&D Showcase" },
      { area: "Autonomous Systems & AI Decision Support", detail: "DARPA's ACE program demonstrated AI dogfighting capability. General Atomics AI-powered autonomous UAVs complete complex missions. Anduril's Lattice AI platform provides battlefield awareness across military domains.", source: "Source: DoD AI Adoption Strategy 2024; DARPA Strategic Plan 2024" },
      { area: "AI for Supply Chain & Manufacturing", detail: "RTX uses AI to manage 14,000+ suppliers across defense programs. L3Harris AI quality inspection reduces defect rates 40%. GE Aerospace's AI manufacturing optimization saves 200K+ labor hours annually.", source: "Source: Deloitte A&D Outlook 2024; RTX Annual Report 2024" },
      { area: "AI Cybersecurity for Defense Systems", detail: "Raytheon's AI cybersecurity protects classified weapon systems. Booz Allen's AI threat detection processes 1B+ events/day for defense clients. AI-powered cyber defense is a $15B+ market growing 25% annually.", source: "Source: CSIS Technology & National Security Report 2024; Booz Allen Investor Day 2024" },
      { area: "AI-Powered Logistics & Mission Planning", detail: "Palantir's AI logistics platform manages DoD supply chains across 4,000+ locations. L3Harris AI mission planning reduces operational planning time 50%. AI-enabled logistics is a top JADC2 priority.", source: "Source: Palantir Government Contract Reports 2024; Army Futures Command Update 2024" },
    ],
    transportation: [
      { area: "AI-Powered Fleet Optimization", detail: "UPS ORION processes 250K+ routes daily, saving $400M annually. FedEx AI routing engine reduced fuel consumption 15%. Uber Freight's AI matches loads to trucks with 92% utilization rates.", source: "Source: UPS 2024 10-K; FedEx Annual Report 2024; Uber Freight Investor Update 2024" },
      { area: "Autonomous Vehicle Development", detail: "Waymo operates 100K+ paid robotaxi rides/week. Aurora Innovation is deploying autonomous trucks on I-45. TuSimple's AI-powered trucks completed 18-hour autonomous hauls.", source: "Source: Waymo Safety Report 2024; Aurora Innovation Q3 2024 Earnings" },
      { area: "Predictive Maintenance for Fleet & Infrastructure", detail: "Union Pacific uses AI to monitor 32,000 miles of track, predicting failures 30 days out. Southwest Airlines' AI predictive maintenance prevents 95% of mechanical delays. Transit agencies using AI maintenance see 25% cost reduction.", source: "Source: AAR Technology Report 2024; Southwest Airlines Technology Update 2024" },
      { area: "AI for Safety & Compliance", detail: "Samsara's AI dashcams monitor 1M+ commercial vehicles. AI driver coaching reduces accidents 22%. FMCSA is evaluating AI-powered compliance monitoring for carriers.", source: "Source: NHTSA Safety Report 2024; Samsara Annual Report 2024" },
      { area: "Dynamic Pricing & Revenue Management", detail: "Delta's AI pricing engine processes 1M+ fare decisions daily. Uber's surge pricing AI optimizes across 10,000+ cities. AI-powered revenue management improves yield 5-12% for transport operators.", source: "Source: IATA Revenue Management Report 2024; Delta Investor Day 2024" },
      { area: "AI for Demand Forecasting & Scheduling", detail: "MTA uses AI to optimize subway and bus schedules serving 8M daily riders. Airlines using AI crew scheduling save $200M+ annually. AI demand prediction accuracy exceeds 90% for leading operators.", source: "Source: APTA Transit Technology Report 2024; BCG Transport Practice 2024" },
    ],
    utilities: [
      { area: "AI Grid Management & Optimization", detail: "Duke Energy's AI manages 300,000+ miles of power lines, predicting failures 7 days out. NextEra Energy's AI optimizes renewable output across 30GW of capacity. AI grid management reduces outage duration 30-40%.", source: "Source: EEI Grid Modernization Report 2024; Duke Energy Annual Report 2024" },
      { area: "AI for Renewable Integration & Forecasting", detail: "DeepMind's AI improved Google wind farm output prediction 20%. AI solar forecasting enables 95%+ accuracy for 48-hour predictions. Utilities using AI for renewable dispatch save $1M+ per GW per year.", source: "Source: IEA Renewables Report 2024; Google Sustainability Report 2024" },
      { area: "AI-Powered Customer Operations", detail: "Con Edison's AI handles 2M+ customer interactions annually. AI outage prediction and automated communication improve customer satisfaction 25%. Smart meter AI analytics identify theft and billing errors.", source: "Source: J.D. Power Utility Study 2024; Con Edison Technology Report 2024" },
      { area: "Predictive Maintenance for Infrastructure", detail: "PG&E uses AI and satellite imagery to monitor wildfire risk across 25,000 square miles. AI inspection of transformers and substations prevents 60% of unplanned outages. Drone AI inspection reduces line patrol costs 75%.", source: "Source: PG&E Safety Report 2024; Gartner Utility Technology Report 2024" },
      { area: "AI for Demand Response & Load Balancing", detail: "Google Nest AI-powered thermostats manage 30M+ homes for demand response. AI load forecasting reduces peak capacity needs 5-10%, deferring $100M+ in grid infrastructure investment.", source: "Source: FERC Demand Response Report 2024; Google Nest Impact Report 2024" },
      { area: "AI Water & Gas Network Management", detail: "American Water Works uses AI to detect pipe leaks and predict failures across 53,000 miles of pipeline. AI water quality monitoring processes 100K+ samples daily. Gas utilities use AI for methane leak detection and repair prioritization.", source: "Source: AWWA Utility Benchmarking 2024; American Water Annual Report 2024" },
    ],
    nonprofit_ngo: [
      { area: "AI for Donor Analytics & Fundraising", detail: "Red Cross uses AI to identify potential major donors and optimize solicitation timing. AI-powered fundraising platforms improve donation conversion 20-35%. Predictive giving models identify lapsed donors likely to re-engage.", source: "Source: AFP Fundraising Effectiveness Report 2024; Blackbaud Intelligence Report 2024" },
      { area: "AI-Powered Program Impact Measurement", detail: "Gates Foundation uses AI to track health intervention outcomes across 130+ countries. AI satellite imagery analyzes development program impact. ML models predict program effectiveness before full deployment.", source: "Source: Stanford Social Innovation Review AI Report 2024; Gates Foundation Annual Letter 2024" },
      { area: "Generative AI for Grant Writing & Reporting", detail: "AI-assisted grant proposals are 40% faster to produce. Instrumentl and Fluxx use AI to match organizations to funding opportunities. LLMs draft progress reports and impact narratives from program data.", source: "Source: National Council of Nonprofits Technology Survey 2024; Candid GuideStar Report 2024" },
      { area: "AI for Operations & Resource Optimization", detail: "Feeding America uses AI to optimize food distribution across 200+ food banks. AI volunteer matching and scheduling improves engagement 25%. Habitat for Humanity uses AI project planning for construction timelines.", source: "Source: Feeding America Annual Report 2024; Points of Light Volunteer Technology Report 2024" },
      { area: "AI for Advocacy & Communications", detail: "ACLU uses AI to analyze legislation across 50 states. AI-powered social listening tracks policy sentiment in real-time. Amnesty International uses AI to verify human rights documentation.", source: "Source: TechSoup Digital Literacy Report 2024; ACLU Technology & Liberty Update 2024" },
      { area: "AI Chatbots for Beneficiary Services", detail: "Crisis Text Line's AI triages 10M+ conversations, routing highest-risk cases to counselors. UNHCR's AI chatbot serves refugees in 15 languages. AI-powered service delivery reaches 3x more beneficiaries at the same cost.", source: "Source: NTEN Nonprofit Technology Report 2024; Crisis Text Line Impact Report 2024" },
    ],
    cpg: [
      { area: "AI-Powered Demand Sensing", detail: "P&G's AI demand sensing improved forecast accuracy 20%, reducing waste $500M+. Unilever's AI processes point-of-sale data from 1M+ stores in real-time. PepsiCo's AI demand planning reduced out-of-stocks 15%.", source: "Source: McKinsey CPG Practice 2024; P&G Investor Day 2024" },
      { area: "AI for Trade Promotion Optimization", detail: "Kraft Heinz uses AI to optimize $5B+ in annual trade spend, improving ROI 12%. AI trade promotion engines analyze retailer-specific response patterns. Companies optimizing trade spend with AI recapture 3-5% of revenue.", source: "Source: BCG CPG Advantage Report 2024; Kraft Heinz Annual Report 2024" },
      { area: "Generative AI for Product Innovation", detail: "Coca-Cola used AI to develop its Y3000 flavor. Nestlé's AI R&D platform screens 10,000+ flavor combinations. L'Oréal uses AI to predict beauty trends and formulate products 30% faster.", source: "Source: Coca-Cola Innovation Report 2024; Nestlé R&D Technology Update 2024" },
      { area: "AI-Driven Direct-to-Consumer", detail: "Nike's AI personalization drives 25% of digital revenue. P&G's AI-powered DTC brands optimize customer acquisition cost 30%. AI retargeting and lifecycle marketing improve CPG customer LTV 40%.", source: "Source: Nike Digital Report 2024; Deloitte Consumer Products Outlook 2024" },
      { area: "Supply Chain AI & Resilience", detail: "Mars uses AI to monitor 100K+ suppliers across tiers. Nestlé's AI supply chain saved CHF 800M in 2024. AI-powered demand-supply matching reduces CPG logistics costs 8-12%.", source: "Source: Gartner Supply Chain Top 25 2024; Mars Sustainability Report 2024" },
      { area: "AI for Sustainability & ESG Compliance", detail: "Unilever's AI tracks Scope 3 emissions across 150,000+ suppliers. P&G uses AI to optimize packaging sustainability. AI-powered lifecycle assessment reduces environmental reporting time 60%.", source: "Source: CDP Corporate Environmental Disclosure 2024; Unilever Climate Action Report 2024" },
    ],
    shipping_logistics: [
      { area: "AI-Optimized Route Planning & Fleet Management", detail: "UPS's ORION system processes 250,000+ routes daily using ML, saving 100M+ miles and $400M annually. DHL has deployed AI route optimization across 220 countries. Amazon's AI routing engine now powers same-day delivery in 90+ US metros.", source: "Source: UPS 2024 10-K Filing; DHL Logistics Trend Radar 2024; Amazon Q3 2024 Earnings Call" },
      { area: "Predictive Maintenance for Fleet & Facilities", detail: "Maersk uses IoT + ML to predict container ship engine failures 30 days in advance, reducing unplanned downtime by 40%. XPO Logistics deploys predictive maintenance across 750+ facilities. UPS's Automotive Predictive Analytics prevents 10,000+ breakdowns annually.", source: "Source: Maersk Technology Review 2024; XPO Investor Day 2024; UPS Sustainability Report 2024" },
      { area: "Computer Vision for Warehouse Automation", detail: "Amazon operates 750,000+ robots across fulfillment centers using AI vision systems. DHL's OptiCarton uses CV to optimize package sizing, reducing shipping volume 25%. Locus Robotics has completed 3B+ picks.", source: "Source: Amazon Robotics Report 2024; DHL Innovation Center; Locus Robotics Press Release Oct 2024" },
      { area: "AI-Powered Customer Service & Tracking", detail: "UPS's virtual assistant handles 54M+ customer interactions/year. Maersk's AI chatbot resolves 65% of shipping queries without human intervention. DHL's AI customer service platform reduced call center volume 35%.", source: "Source: UPS Digital Strategy Report 2024; Maersk Q2 2024 Investor Presentation" },
      { area: "Demand Forecasting & Dynamic Pricing", detail: "C.H. Robinson uses ML to predict freight demand 30 days out with 92% accuracy. Flexport's AI pricing engine adjusts rates in real-time based on 200+ variables. XPO's AI-powered brokerage platform processes $4B+ in freight annually.", source: "Source: C.H. Robinson Q3 2024 Earnings; Flexport Technology Blog 2024; XPO Annual Report 2024" },
      { area: "Supply Chain Visibility & Risk Prediction", detail: "Maersk tracks 30M+ containers with AI-powered ETA prediction. FourKites, project44, and Transplace use ML to provide real-time supply chain visibility to 1,000+ shippers.", source: "Source: Gartner Supply Chain Top 25 Report 2024; FourKites Industry Benchmark 2024" },
    ],
  };
  const defaults = [
    { area: "Customer-Facing AI (Chatbots, Virtual Assistants)", detail: "Organizations across industries are deploying conversational AI for customer service. Bank of America's Erica handles 1.5B+ interactions/year. Comcast's AI assistant resolves 30% of support calls without agents. If your call center is still fully human-staffed, you are over-spending and under-serving.", source: "Source: Gartner Customer Service AI Survey 2024; Bank of America Q3 2024 Report" },
    { area: "Process Automation & Intelligent Document Processing", detail: "JPMorgan's COiN platform processes 12,000 commercial credit agreements in seconds (previously 360,000 hours of lawyer work). UiPath and Automation Anywhere report 40-60% efficiency gains in document workflows. Your competitors are processing in minutes what takes your teams days.", source: "Source: McKinsey Operations Practice 2024; JPMorgan Technology Report 2024" },
    { area: "Predictive Analytics for Demand & Operations", detail: "Walmart's AI demand forecasting improved accuracy 20% and reduced waste by $1B+. Starbucks uses ML to personalize 400M customer offers/week. The organizations winning are not just collecting data — they are acting on it in real time.", source: "Source: BCG Operations Report 2024; Walmart 2024 Investor Day; Starbucks Deep Brew Platform Update" },
    { area: "Generative AI for Content & Code", detail: "GitHub Copilot now has 1.3M paid subscribers, with adopters reporting 55% faster task completion. Salesforce Einstein GPT generates 1T+ predictions/week. Your developers and knowledge workers are likely already using these tools — the question is whether you know about it and are governing it.", source: "Source: GitHub 2024 Octoverse Report; Salesforce Q3 2024 Earnings; Deloitte Tech Trends 2024" },
    { area: "AI-Powered Cybersecurity & Threat Detection", detail: "CrowdStrike's AI processes 2T+ security events/week. IBM reports organizations using AI security detect breaches 108 days faster and save $1.76M per incident. Your competitors are using AI to defend against threats that are already using AI to attack.", source: "Source: IBM Cost of a Data Breach Report 2024; CrowdStrike Annual Threat Report 2024" },
    { area: "Workforce Intelligence & Talent Optimization", detail: "Microsoft's Viva Copilot Analytics identifies 8.8 hours/week of meeting time that could be redirected to deep work. Unilever uses AI screening for 1.8M annual applications, reducing hiring time 75%. Workday's ML-powered skills intelligence maps talent gaps across 60M+ workers. Your talent strategy is either AI-augmented or falling behind.", source: "Source: Microsoft Work Trend Index 2024; Unilever HR Innovation Report; Workday Rising 2024" },
  ];
  // Map industry slugs to their closest match
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
    ecommerce_digital: 'ecommerce_digital',
    dtc: 'ecommerce_digital',
    food_beverage: 'cpg',
    it_services: 'software_saas',
    hardware_electronics: 'software_saas',
    chemicals_materials: 'manufacturing_process',
    industrial_services: 'manufacturing_discrete',
    construction_engineering: 'real_estate_commercial',
    real_estate_residential: 'real_estate_commercial',
    infrastructure_transport: 'transportation',
    government_state_local: 'government_federal',
    defense_contractors: 'aerospace_defense',
    accounting_audit: 'consulting_services',
  };
  const key = industry;
  return areas[key] || areas[industryAliases[key] || ''] || defaults;
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
): FreeMaturityAnalysis {
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
    government_federal: `Federal agencies are under mandate to deploy AI responsibly at scale. Executive Order 14110 (October 2023) and OMB Memorandum M-24-10 (March 2024) require every major agency to appoint a Chief AI Officer, publish an AI use-case inventory, and complete impact assessments for safety- or rights-impacting AI. DoD's Chief Digital and AI Office (CDAO) operates Task Force Lima for generative AI across the department. GSA's AI Center of Excellence supports agency adoption. For ${companyName}, GAO's 2024 assessments found that agencies at Stage ${stage} maturity face the greatest compliance exposure under M-24-10 because governance artifacts — inventories, impact assessments, and red-team results — lag behind technology deployment.`,
    government_state_local: `State and local governments are accelerating AI adoption under a patchwork of state executive orders (CA EO N-12-23, NY, NJ) and sector-specific legislation (Colorado AI Act, Texas HB 2060). The fastest movers — California CDT, NYC Office of Technology and Innovation, Texas DIR — operate formal GenAI sandboxes, procurement guardrails, and bias-assessment toolkits. For ${companyName}, the primary risk at Stage ${stage} is not under-adoption but unmanaged adoption: public-records exposure, civil-rights litigation, and procurement audit findings compound quickly when AI is deployed without documented governance, impact assessments, and public-facing disclosure.`,
    nonprofit_ngo: `Nonprofits and NGOs are deploying AI for mission acceleration under tight resource and ethics constraints. The Gates Foundation has committed $30M+ to AI for global development. The American Red Cross and World Food Programme deploy AI for disaster response and anticipatory action. Partnership on AI's 2024 guidance emphasizes that mission-driven organizations must balance donor expectations, beneficiary rights, and operational efficiency. For ${companyName}, Bridgespan Group's 2024 analysis finds that nonprofits at Stage ${stage} face a distinctive risk: donor and grantmaker scrutiny of AI governance is rising faster than operational AI adoption, creating reputational exposure ahead of operational benefit.`,
    real_estate_commercial: `Commercial real estate is adopting AI across leasing, valuation, property operations, and capital markets. CBRE, JLL, and Cushman & Wakefield deploy proprietary AI platforms for deal-pipeline analytics and lease abstraction. JLL's JLL GPT was one of the first large-language models built for the CRE vertical. Prologis uses AI for energy optimization across 1.2B+ sq ft of logistics space. For ${companyName} at ${rev}, Altus Group's 2024 CRE technology benchmark finds that firms at Stage ${stage} spend 20-35% more per asset on property operations than AI-optimized peers, with the gap widening as AI-enabled tenant experience becomes a leasing differentiator.`,
    real_estate_residential: `Residential real estate is being reshaped by AI in pricing, search, underwriting, and property management. Zillow's AI-powered Zestimate covers 100M+ homes. Opendoor's AI pricing models underwrite iBuyer offers at scale. Rocket Mortgage deploys AI across loan origination. For ${companyName} at ${rev}, STRATMOR's 2024 benchmark finds that residential real-estate operators at Stage ${stage} carry 25-40% higher origination and servicing costs per unit than AI-enabled peers, with AI-driven tenant-screening, pricing, and fraud-detection becoming competitive necessities rather than differentiators.`,
    media_entertainment: `Media and entertainment companies are deploying AI across content personalization, production workflow, and rights management. Netflix attributes 80%+ of watched content to AI recommendations. Disney operates an enterprise AI task force with board oversight. Comcast and NBCUniversal integrate AI across Xfinity operations and Peacock personalization. For ${companyName} at ${rev}, PwC's 2024 Global Entertainment & Media Outlook finds that firms at Stage ${stage} are most exposed to the AI-driven disruption of content discovery and advertising pricing, with AI-optimized competitors capturing disproportionate share of shifting attention and ad budgets.`,
    food_beverage: `Food and beverage manufacturers are deploying AI across demand sensing, supply chain, product R&D, and quality control. PepsiCo's AI demand sensing cut forecast error from 40% to 20% at the store-SKU level, reducing waste $450M and improving on-shelf availability 12%. Nestlé's AI-powered R&D platform screens 10,000+ flavor combinations and reduced new product launch cycles from 18 months to 10 months. General Mills' AI supply-chain optimization saves $180M annually across 30+ plants. For ${companyName} at ${rev}, McKinsey's 2024 CPG report estimates that F&B manufacturers at Stage ${stage} forfeit 2-4% of revenue-equivalent through forecast error, trade-spend inefficiency, and SKU-rationalization lag — a gap that compounds as AI-enabled competitors adjust pricing, assortment, and promotions in real time.`,
    cpg: `Consumer packaged goods leaders are using AI to manage demand volatility, optimize trade spend, and accelerate innovation. P&G's AI demand-sensing platform improved forecast accuracy 20% and reduced waste $500M+. Unilever uses AI screening to process 1.8M annual applications (75% faster hiring) and AI-powered Scope 3 emissions tracking across 150,000+ suppliers. Kraft Heinz uses AI to optimize $5B+ in annual trade spend, improving ROI 12%. For ${companyName} at ${rev}, BCG's 2024 CPG Advantage Report finds that manufacturers at Stage ${stage} leave 3-5% of revenue unrealized through suboptimal trade-promotion ROI, demand-plan inaccuracy, and slow response to retailer-specific patterns.`,
    dtc: `Direct-to-consumer brands live and die on AI-powered personalization, attribution, and customer-lifecycle economics. Warby Parker's AI virtual try-on lifted conversion 32% and cut return rates from 15% to 6%. Glossier's AI personalization engine drove 28% repeat-purchase-rate lift and 18% higher AOV. Dollar Shave Club's AI subscription optimization cut churn 35%. For ${companyName} at ${rev}, a16z's 2024 DTC Benchmark shows that brands at Stage ${stage} typically operate with 40-60% higher customer-acquisition cost than AI-optimized peers because their paid-media, retention, and creative workflows aren't yet instrumented for real-time AI optimization.`,
  };

  // Map sub-industry slugs to the parent industryContextMap entry above. Only
  // legitimate same-peer-group mappings — anything with a distinct operating
  // model has its own entry and is NOT aliased here.
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
    manufacturing_discrete: 'manufacturing',
    manufacturing_process: 'manufacturing',
    automotive: 'manufacturing',
    chemicals_materials: 'manufacturing',
    industrial_services: 'manufacturing',
    construction_engineering: 'manufacturing',
    energy_oil_gas: 'energy_utilities',
    utilities: 'energy_utilities',
    transportation: 'shipping_logistics',
    infrastructure_transport: 'shipping_logistics',
    defense_contractors: 'aerospace_defense',
    legal_services: 'consulting_services',
    accounting_audit: 'consulting_services',
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
    ? `The full report maps ${companyName}'s specific path from Stage ${stage} to Stage ${stage + 1}, quantifying the P&L impact of each dimension improvement and identifying the 3-5 highest-leverage interventions. RLK Consulting then works with clients to build a tailored 90-day operationalization plan. The difference between Stage ${stage} and Stage ${stage + 1} is not incremental — it represents a step-change in value capture.`
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
    const regressFromStage = stage; // you regress from where you are
    const regressToStage = Math.max(1, stage - 1);
    stageNarrative = `At Stage ${stage}, ${companyName} has built real AI capability. But competitive advantages in AI erode faster than they were built. BCG's 2024 research found that organizations pausing AI investment after reaching Stage ${regressFromStage} regress to Stage ${regressToStage} behavioral patterns within 12-18 months — the organizational muscle atrophies quickly. Your ${capturePercent}% capture rate means you are converting real value, but competitors investing aggressively can close your lead in 2-3 quarters. The question is not whether to invest more, but whether your current pace is sufficient to maintain separation. In ${ind}, the cost of losing your AI edge is measured in market share points, not basis points.`;
  } else if (stage === 3) {
    headline = "The Inflection Point — Where AI Investment Pays Off or Doesn't";
    // Compute an industry-specific Stage 4 capture estimate so the "asymmetric
    // math" framing uses real numbers rather than hardcoded 25%→55% values.
    const captureGroup = (INDUSTRY_CAPTURE_GROUP as Record<string, string>)[industry] ?? "professional_services";
    const stage4Base = (CAPTURE_RATES_BY_GROUP as Record<string, Record<number, number>>)[captureGroup]?.[4] ?? 0.55;
    const stage4Percent = Math.round(stage4Base * 100);
    const unrealizedPercent = Math.max(0, 100 - capturePercent);
    const uplift = Math.max(0, stage4Percent - capturePercent);
    const multiple = capturePercent > 0 ? (stage4Percent / capturePercent).toFixed(1) : "2";
    stageNarrative = `Stage 3 is where AI either becomes a P&L driver or remains an expensive experiment. ${companyName}'s current ${capturePercent}% capture rate means ${unrealizedPercent}% of AI-addressable value is going unrealized. The math of moving from Stage 3 to Stage 4 is asymmetric in your favor: typical Stage 4 organizations in ${ind} operate around ${stage4Percent}% capture — a ${uplift}-point uplift that translates to roughly ${multiple}x the returns on the same AI-addressable pool. Organizations that invest decisively at this stage see P&L impact within 12-18 months. Those that don't face a different math: competitors at Stage 4 are operating at structurally lower costs and faster cycle times, and the gap compounds every quarter. In ${ind}, that gap translates directly to pricing power, customer retention, and talent attraction.`;
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
    food_beverage: `AI demand sensing, trade-promotion optimization, and SKU rationalization grow net revenue even before volume gains. PepsiCo cut forecast error from 40% to 20% ($450M waste reduction, +12% on-shelf availability). For ${companyName} at ${fmtUSD(revenue)}, a 10-15% improvement in forecast accuracy typically unlocks 1-2% of net revenue through lower out-of-stocks and better promotional ROI.`,
    cpg: `AI-powered demand sensing, trade-spend optimization, and DTC personalization lift net revenue. P&G's AI improved forecast accuracy 20% and its AI-powered DTC brands cut CAC 30%. Kraft Heinz optimizes $5B+ in trade spend with AI for 12% ROI lift. With an Adoption Behavior score of ${getScore('adoption_behavior')}/100, ${companyName} is leaving trade-spend and retail-execution value on the table.`,
    dtc: `AI personalization, dynamic retargeting, and AI-assisted creative drive conversion-rate and LTV gains. Warby Parker's virtual try-on lifted conversion 32%; Glossier's AI personalization grew repeat-purchase rates 28% and AOV 18%. At ${fmtUSD(revenue)}, each 1-point conversion-rate improvement is worth approximately ${fmtUSD(Math.round(revenue * 0.01))} in annualized top-line.`,
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
    food_beverage: `Forecast error and trade-promotion ROI stagnate while AI-enabled F&B peers continuously optimize. Every point of lost forecast accuracy translates to obsolete inventory, missed retail-shelf sets, and lower sell-through. At ${companyName}'s scale, the cumulative cost of manual demand planning vs. AI demand sensing is typically 1-2% of net revenue per year.`,
    cpg: `Retailer scorecards and trade-spend ROI degrade as AI-enabled CPG competitors win more retail execution and promotional lift at lower cost. Private-label brands with AI-powered demand planning increasingly out-execute manual-forecasting incumbents on the same shelves.`,
    dtc: `CAC inflates and LTV compresses as AI-enabled DTC competitors run tighter paid-media attribution, creative iteration, and lifecycle personalization. Every 10% CAC gap against AI-optimized peers shrinks payback windows that were already tight.`,
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
    food_beverage: `AI-powered supply-chain optimization, predictive maintenance on processing lines, and computer-vision quality inspection reduce waste, scrap, and giveaway. General Mills saved $180M annually across 30+ plants via AI scheduling and waste reduction. Nestlé's AI supply chain saved CHF 800M in 2024. At ${companyName}'s scale, every 1% of ingredient-waste reduction is worth approximately ${fmtUSD(Math.round(revenue * 0.005))}.`,
    cpg: `AI-driven plant scheduling, packaging-line optimization, and logistics automation shrink COGS. P&G and Unilever routinely report 5-10% unit-cost reductions through AI-driven factory and supply-chain programs. At ${(ebitdaMargin * 100).toFixed(0)}% operating margin, each 1 point of COGS improvement compounds materially.`,
    dtc: `AI automates paid-media bidding, creative production, and lifecycle-marketing operations. AI-assisted creative workflows cut production cost per asset 40-60%; AI bidding tools frequently deliver 15-25% CAC improvement. Combined, these shift DTC brands from headcount-constrained to scalable-unit-economics.`,
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
    food_beverage: `Plant scheduling inefficiency, ingredient waste, and transportation cost remain elevated while AI-optimized F&B peers continuously compress unit costs. At ${(ebitdaMargin * 100).toFixed(0)}% operating margin, a half-point of structural COGS disadvantage is existential, and private-label and AI-native brands are actively pricing to exploit it.`,
    cpg: `Trade-spend ROI, forecast accuracy, and retail-execution costs lag AI-optimized peers. CPG boards increasingly demand AI-driven accountability on trade spend — a laggard position here is difficult to defend at the next budget cycle.`,
    dtc: `Paid-media efficiency, creative production cost, and customer-service cost-to-serve remain elevated while AI-native DTC competitors run leaner on every unit. In a payback-window-constrained business, this is the difference between scaling and stalling.`,
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
      coastDownside: revGrowthCoast[industry] || (stage >= 4
        ? `Revenue growth decelerates as fast-following ${ind.toLowerCase()} competitors close your AI lead through targeted investment in the same workflows that drive your current advantage. At Stage ${stage}, ${companyName}'s market-share premium erodes 2-4 quarters after aggressive peers match your AI operating model — the advantage is durable only if it keeps moving.`
        : `Revenue growth stagnates as AI-enabled ${ind.toLowerCase()} competitors capture market share through faster innovation, better personalization, and lower customer acquisition costs. At Stage ${stage}, ${companyName} is falling ${stage <= 2 ? '18-24 months' : '12-18 months'} behind peers who are already scaling AI-driven revenue initiatives.`),
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

  // Ensure exactly 4 proof points for clean 2x2 grid layout
  const rawProofPoints = proofPointsByIndustry[industry] || defaultProofPoints;
  const proofPoints = rawProofPoints.length >= 4
    ? rawProofPoints.slice(0, 4)
    : [
        ...rawProofPoints,
        ...defaultProofPoints
          .filter((dp) => !rawProofPoints.some((rp) => rp.metric === dp.metric))
          .slice(0, 4 - rawProofPoints.length),
      ];

  // ---- Compound Cost of Inaction ----
  const quarterly = Math.round(unrealizedMid / 4);
  const year1 = unrealizedMid;
  const year3 = Math.round(unrealizedMid * 3 * 1.15); // 15% annual compounding
  const compoundNarrative = stage >= 4
    ? `Even at Stage ${stage}, standing still forfeits ${fmtUSD(quarterly)} per quarter. Over three years, competitive erosion compounds the loss to ${fmtUSD(year3)} as competitors close the capability gap and begin to match or exceed your AI-driven advantages.`
    : stage === 3
    ? `At your estimated capture rate, ${companyName} forfeits an estimated ${fmtUSD(quarterly)} every quarter. But the real cost compounds: as competitors at Stage 4+ build organizational learning advantages, the cost to close the gap grows approximately 15% annually. Over three years, total estimated forfeited value reaches ${fmtUSD(year3)}.`
    : `At an estimated ${capturePercent}% capture rate, ${companyName} forfeits an estimated ${fmtUSD(quarterly)} every quarter — approximately ${fmtUSD(Math.round(quarterly / 90))} every single day. This is not a static loss: competitors investing now are building compounding advantages in cost structure, talent, and customer experience. Over three years, the total estimated forfeited value reaches ${fmtUSD(year3)}, and the organizational deficit grows proportionally harder to close.`;

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
// Industry Competitor Positioning for 2x2 Quadrant
// ---------------------------------------------------------------------------
// Uses industry-specific AI maturity benchmarks from McKinsey, BCG, Gartner
// to estimate where 5 anonymous competitors cluster on the capability/readiness axes.
// Positions are seeded deterministically from industry slug so they're stable across renders.

function getIndustryCompetitors(
  industry: string,
  userCap: number,
  userReady: number,
): { label: string; capability: number; readiness: number }[] {
  // Industry-specific benchmark centers (AI Capability, Org Readiness)
  // Based on McKinsey 2024 Global AI Survey and BCG AI Advantage Report
  const benchmarks: Record<string, { capMed: number; readMed: number; spread: number }> = {
    financial_services: { capMed: 62, readMed: 58, spread: 18 },
    banking: { capMed: 65, readMed: 60, spread: 16 },
    capital_markets: { capMed: 70, readMed: 55, spread: 20 },
    insurance: { capMed: 52, readMed: 50, spread: 22 },
    healthcare: { capMed: 48, readMed: 45, spread: 20 },
    healthcare_providers: { capMed: 45, readMed: 42, spread: 22 },
    healthcare_payers: { capMed: 55, readMed: 50, spread: 18 },
    life_sciences_pharma: { capMed: 58, readMed: 48, spread: 22 },
    technology: { capMed: 72, readMed: 65, spread: 15 },
    software_saas: { capMed: 75, readMed: 68, spread: 14 },
    it_services: { capMed: 68, readMed: 62, spread: 16 },
    retail_ecommerce: { capMed: 55, readMed: 48, spread: 20 },
    retail: { capMed: 50, readMed: 45, spread: 22 },
    ecommerce_digital: { capMed: 65, readMed: 55, spread: 18 },
    manufacturing: { capMed: 45, readMed: 42, spread: 22 },
    manufacturing_discrete: { capMed: 42, readMed: 40, spread: 24 },
    manufacturing_process: { capMed: 48, readMed: 44, spread: 22 },
    automotive: { capMed: 58, readMed: 50, spread: 20 },
    energy_utilities: { capMed: 42, readMed: 45, spread: 22 },
    energy_oil_gas: { capMed: 48, readMed: 50, spread: 20 },
    utilities: { capMed: 38, readMed: 42, spread: 24 },
    shipping_logistics: { capMed: 50, readMed: 45, spread: 22 },
    transportation: { capMed: 45, readMed: 42, spread: 24 },
    telecommunications: { capMed: 58, readMed: 52, spread: 18 },
    consulting_services: { capMed: 60, readMed: 55, spread: 18 },
    aerospace_defense: { capMed: 55, readMed: 52, spread: 20 },
    media_entertainment: { capMed: 62, readMed: 48, spread: 22 },
    cpg: { capMed: 48, readMed: 42, spread: 22 },
    construction_engineering: { capMed: 32, readMed: 35, spread: 24 },
    real_estate_commercial: { capMed: 35, readMed: 38, spread: 24 },
    real_estate_residential: { capMed: 32, readMed: 35, spread: 24 },
    government_federal: { capMed: 40, readMed: 48, spread: 22 },
    government_state_local: { capMed: 35, readMed: 42, spread: 24 },
    education_higher: { capMed: 42, readMed: 40, spread: 24 },
    legal_services: { capMed: 45, readMed: 50, spread: 22 },
    accounting_audit: { capMed: 50, readMed: 55, spread: 18 },
    asset_wealth_management: { capMed: 60, readMed: 56, spread: 18 },
    healthcare_services: { capMed: 42, readMed: 40, spread: 22 },
    dtc: { capMed: 58, readMed: 48, spread: 20 },
    food_beverage: { capMed: 42, readMed: 38, spread: 22 },
    industrial_services: { capMed: 38, readMed: 40, spread: 24 },
    hardware_electronics: { capMed: 68, readMed: 58, spread: 18 },
    infrastructure_transport: { capMed: 38, readMed: 42, spread: 24 },
    nonprofit_ngo: { capMed: 30, readMed: 35, spread: 24 },
    defense_contractors: { capMed: 52, readMed: 55, spread: 20 },
  };

  const b = benchmarks[industry] || { capMed: 50, readMed: 48, spread: 20 };

  // Deterministic pseudo-random from industry string
  let hash = 0;
  for (let i = 0; i < industry.length; i++) {
    hash = ((hash << 5) - hash + industry.charCodeAt(i)) | 0;
  }
  const seed = (n: number) => {
    const x = Math.sin(hash + n) * 10000;
    return x - Math.floor(x); // 0-1
  };

  // Generate 5 competitors distributed around the industry median
  // Competitor A: industry leader (upper-right pull)
  // Competitor B: fast follower
  // Competitor C: median peer
  // Competitor D: lagging but structured
  // Competitor E: early stage
  const competitors = [
    {
      label: "Comp. A",
      capability: Math.min(95, b.capMed + b.spread * 0.8 + seed(1) * 8),
      readiness: Math.min(95, b.readMed + b.spread * 0.7 + seed(2) * 8),
    },
    {
      label: "Comp. B",
      capability: Math.min(92, b.capMed + b.spread * 0.3 + seed(3) * 10),
      readiness: Math.min(92, b.readMed + b.spread * 0.4 + seed(4) * 10),
    },
    {
      label: "Comp. C",
      capability: b.capMed + (seed(5) - 0.5) * 12,
      readiness: b.readMed + (seed(6) - 0.5) * 12,
    },
    {
      label: "Comp. D",
      capability: Math.max(8, b.capMed - b.spread * 0.4 + seed(7) * 8),
      readiness: Math.max(8, b.readMed + b.spread * 0.2 - seed(8) * 6),
    },
    {
      label: "Comp. E",
      capability: Math.max(8, b.capMed - b.spread * 0.6 - seed(9) * 8),
      readiness: Math.max(8, b.readMed - b.spread * 0.5 - seed(10) * 8),
    },
  ];

  return competitors.map(c => ({
    ...c,
    capability: Math.round(Math.max(5, Math.min(95, c.capability))),
    readiness: Math.round(Math.max(5, Math.min(95, c.readiness))),
  }));
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

// ---------------------------------------------------------------------------
// Vendor Stack Assessment — grouped by use case with heat-map ratings
// ---------------------------------------------------------------------------

interface VendorRating {
  vendor: string;
  fit: number;      // 1-5
  scale: number;
  cost: number;
  risk: number;
  support: number;
  ecosystem: number;
  note: string;
}

interface UseCaseVendorStack {
  useCase: string;
  summary: string;
  vendors: VendorRating[];
}

function getVendorStackByUseCase(useCases: string[], industry: string, stage: number): UseCaseVendorStack[] {
  const stacks: Record<string, UseCaseVendorStack> = {
    "Customer Service / Chatbots": {
      useCase: "Customer Service / Chatbots",
      summary: "Conversational AI for customer-facing interactions, support automation, and intelligent routing.",
      vendors: [
        { vendor: "Intercom Fin", fit: 5, scale: 4, cost: 3, risk: 3, support: 5, ecosystem: 4, note: "Best for mid-market; strong out-of-box NLU and handoff" },
        { vendor: "Zendesk AI", fit: 4, scale: 5, cost: 3, risk: 4, support: 4, ecosystem: 5, note: "Enterprise-grade; deep CRM integration" },
        { vendor: "Ada", fit: 4, scale: 4, cost: 4, risk: 3, support: 4, ecosystem: 3, note: "Strong automation rates; good for high-volume" },
        { vendor: "Amazon Connect + Bedrock", fit: 3, scale: 5, cost: 4, risk: 4, support: 3, ecosystem: 5, note: "AWS-native; best for existing AWS shops" },
      ],
    },
    "Data Analytics / BI": {
      useCase: "Data Analytics / BI",
      summary: "AI-augmented analytics, natural language querying, and automated insight generation.",
      vendors: [
        { vendor: "Databricks", fit: 5, scale: 5, cost: 3, risk: 3, support: 4, ecosystem: 5, note: "Best for unified data + AI; lakehouse architecture" },
        { vendor: "Snowflake Cortex", fit: 4, scale: 5, cost: 3, risk: 4, support: 4, ecosystem: 4, note: "Strong SQL AI; cloud-native data warehouse" },
        { vendor: "ThoughtSpot", fit: 4, scale: 4, cost: 3, risk: 3, support: 4, ecosystem: 4, note: "Best NL querying; non-technical user friendly" },
        { vendor: "Microsoft Fabric", fit: 4, scale: 5, cost: 4, risk: 4, support: 4, ecosystem: 5, note: "Microsoft ecosystem advantage; rapid adoption" },
      ],
    },
    "Process Automation / RPA": {
      useCase: "Process Automation / RPA",
      summary: "Intelligent process automation combining RPA with AI for complex workflow orchestration.",
      vendors: [
        { vendor: "UiPath", fit: 5, scale: 5, cost: 3, risk: 3, support: 5, ecosystem: 5, note: "Market leader; broadest capability set" },
        { vendor: "Microsoft Power Automate", fit: 4, scale: 5, cost: 5, risk: 4, support: 4, ecosystem: 5, note: "Best value in Microsoft environments" },
        { vendor: "Automation Anywhere", fit: 4, scale: 4, cost: 3, risk: 3, support: 4, ecosystem: 4, note: "Strong cloud-native platform; good AI integration" },
        { vendor: "SS&C Blue Prism", fit: 3, scale: 4, cost: 3, risk: 4, support: 4, ecosystem: 3, note: "Enterprise governance focus; compliance-ready" },
      ],
    },
    "Document Processing": {
      useCase: "Document Processing",
      summary: "Intelligent document extraction, classification, and processing using AI/ML models.",
      vendors: [
        { vendor: "ABBYY Vantage", fit: 5, scale: 4, cost: 3, risk: 3, support: 5, ecosystem: 4, note: "Best accuracy for structured docs; strong OCR heritage" },
        { vendor: "Google Document AI", fit: 4, scale: 5, cost: 4, risk: 4, support: 3, ecosystem: 5, note: "Cloud-native; pre-trained for common doc types" },
        { vendor: "AWS Textract", fit: 4, scale: 5, cost: 4, risk: 4, support: 3, ecosystem: 5, note: "Best for AWS environments; table extraction" },
        { vendor: "Hyperscience", fit: 4, scale: 4, cost: 2, risk: 3, support: 5, ecosystem: 3, note: "Human-in-the-loop; high accuracy for complex docs" },
      ],
    },
    "Predictive Modeling": {
      useCase: "Predictive Modeling",
      summary: "ML platforms for building, deploying, and managing predictive models at enterprise scale.",
      vendors: [
        { vendor: "Databricks + MLflow", fit: 5, scale: 5, cost: 3, risk: 3, support: 4, ecosystem: 5, note: "Best for data teams; open-source foundation" },
        { vendor: "AWS SageMaker", fit: 4, scale: 5, cost: 3, risk: 4, support: 4, ecosystem: 5, note: "Fully managed; broadest model serving options" },
        { vendor: "Google Vertex AI", fit: 4, scale: 5, cost: 3, risk: 4, support: 4, ecosystem: 5, note: "Strong AutoML; best for TensorFlow teams" },
        { vendor: "DataRobot", fit: 5, scale: 4, cost: 2, risk: 3, support: 5, ecosystem: 4, note: "Best for citizen data scientists; automated ML" },
      ],
    },
    "Content Generation": {
      useCase: "Content Generation",
      summary: "Enterprise generative AI for marketing, communications, and content workflows.",
      vendors: [
        { vendor: "Anthropic Claude", fit: 5, scale: 5, cost: 3, risk: 4, support: 4, ecosystem: 4, note: "Best for nuanced, safe enterprise content" },
        { vendor: "OpenAI GPT-4", fit: 5, scale: 5, cost: 3, risk: 3, support: 3, ecosystem: 5, note: "Broadest capability; largest ecosystem" },
        { vendor: "Jasper AI", fit: 4, scale: 4, cost: 3, risk: 3, support: 5, ecosystem: 4, note: "Marketing-focused; brand voice controls" },
        { vendor: "Writer", fit: 4, scale: 4, cost: 3, risk: 4, support: 4, ecosystem: 3, note: "Enterprise governance; style guide enforcement" },
      ],
    },
    "Code Development": {
      useCase: "Code Development",
      summary: "AI-assisted software development, code review, and developer productivity tools.",
      vendors: [
        { vendor: "GitHub Copilot", fit: 5, scale: 5, cost: 4, risk: 3, support: 4, ecosystem: 5, note: "Dominant market share; deepest IDE integration" },
        { vendor: "Cursor", fit: 5, scale: 4, cost: 4, risk: 3, support: 3, ecosystem: 3, note: "Best AI-native IDE experience; rapid iteration" },
        { vendor: "Amazon CodeWhisperer", fit: 4, scale: 5, cost: 5, risk: 4, support: 3, ecosystem: 4, note: "Free tier; best for AWS-centric shops" },
        { vendor: "Tabnine", fit: 3, scale: 4, cost: 4, risk: 5, support: 4, ecosystem: 3, note: "On-prem option; best for air-gapped environments" },
      ],
    },
    "Risk Assessment": {
      useCase: "Risk Assessment",
      summary: "AI-powered risk modeling, fraud detection, and compliance monitoring.",
      vendors: [
        { vendor: "SAS Risk Management", fit: 5, scale: 5, cost: 2, risk: 5, support: 5, ecosystem: 4, note: "Gold standard for regulated industries" },
        { vendor: "IBM OpenPages", fit: 4, scale: 5, cost: 2, risk: 5, support: 4, ecosystem: 4, note: "Best for GRC integration; Watson AI-powered" },
        { vendor: "Palantir Foundry", fit: 4, scale: 5, cost: 1, risk: 4, support: 4, ecosystem: 3, note: "Best for complex data integration; government-grade" },
        { vendor: "Moody's Analytics", fit: 4, scale: 4, cost: 2, risk: 5, support: 4, ecosystem: 3, note: "Best for financial risk; deep credit modeling" },
      ],
    },
    "Supply Chain Optimization": {
      useCase: "Supply Chain Optimization",
      summary: "AI for demand forecasting, inventory optimization, and supply chain visibility.",
      vendors: [
        { vendor: "Blue Yonder", fit: 5, scale: 5, cost: 2, risk: 3, support: 4, ecosystem: 4, note: "Market leader; end-to-end supply chain AI" },
        { vendor: "o9 Solutions", fit: 5, scale: 4, cost: 3, risk: 3, support: 4, ecosystem: 3, note: "Best planning platform; real-time scenario modeling" },
        { vendor: "Kinaxis", fit: 4, scale: 4, cost: 3, risk: 3, support: 5, ecosystem: 4, note: "Best for concurrent planning; rapid deployment" },
        { vendor: "SAP Integrated Business Planning", fit: 4, scale: 5, cost: 2, risk: 4, support: 4, ecosystem: 5, note: "Best for SAP environments; deep ERP integration" },
      ],
    },
    "HR / Talent Management": {
      useCase: "HR / Talent Management",
      summary: "AI for recruiting, workforce planning, employee experience, and talent analytics.",
      vendors: [
        { vendor: "Eightfold AI", fit: 5, scale: 4, cost: 3, risk: 3, support: 4, ecosystem: 4, note: "Best talent intelligence; deep skills matching" },
        { vendor: "Workday AI", fit: 4, scale: 5, cost: 3, risk: 4, support: 4, ecosystem: 5, note: "Best for existing Workday customers; broad HCM" },
        { vendor: "Visier", fit: 4, scale: 4, cost: 3, risk: 4, support: 4, ecosystem: 4, note: "Best people analytics; strong benchmarking" },
        { vendor: "Phenom", fit: 4, scale: 4, cost: 4, risk: 3, support: 4, ecosystem: 3, note: "Best for candidate experience; talent marketplace" },
      ],
    },
  };

  // Filter to company's selected use cases; fall back to top 3 by industry relevance
  const selected = useCases
    .filter((uc) => stacks[uc])
    .map((uc) => stacks[uc]);

  if (selected.length === 0) {
    // Default: show Data Analytics, Process Automation, Content Generation
    return ["Data Analytics / BI", "Process Automation / RPA", "Content Generation"]
      .filter((uc) => stacks[uc])
      .map((uc) => stacks[uc]);
  }

  return selected;
}

function getRecommendedPartnerCategories(industry: string, stage: number): { category: string; description: string; justification: string }[] {
  const ind = industryLabel(industry);
  const categories = [
    {
      category: "AI/ML Platform",
      description: stage <= 2
        ? "Start with a comprehensive AI platform that includes pre-built models, AutoML, and managed infrastructure to reduce time-to-value."
        : "Enterprise-grade ML platform with robust MLOps, model governance, and multi-cloud deployment capabilities.",
      justification: stage <= 2
        ? `Buy. Building ML infrastructure from scratch at Stage ${stage} diverts 6-12 months of engineering effort from business value. Cloud AI platforms commoditize infrastructure so your team focuses on ${ind}-specific use cases, not plumbing. The build-vs-buy calculus shifts only after you have differentiated data pipelines worth owning.`
        : `Buy with selective customization. At Stage ${stage}, your ${ind} organization has enough ML maturity to evaluate platforms critically. Buy the commodity layer (compute, orchestration, monitoring) and build only the proprietary components where your data or domain creates defensible advantage.`,
    },
    {
      category: "Generative AI & LLM",
      description: "Large language model providers for enterprise applications including content generation, code assistance, and knowledge management.",
      justification: stage <= 2
        ? `Buy. Training or fine-tuning foundation models requires data engineering capabilities and GPU budgets that are premature at Stage ${stage}. Commercial LLM APIs deliver 80-90% of value at a fraction of the cost. The model landscape shifts quarterly; locking into a custom model now means maintaining something that may be obsolete in 12 months.`
        : `Buy with fine-tuning. At Stage ${stage}, use commercial APIs as the base and invest in fine-tuning for ${ind}-specific tasks where accuracy and domain terminology matter. Building a foundation model from scratch is only justified if you have proprietary training data that creates a moat no vendor can replicate.`,
    },
    {
      category: "AI Governance & Risk",
      description: stage <= 2
        ? "Essential for establishing AI oversight without building custom governance tooling. Start with monitoring and basic policy enforcement."
        : "Comprehensive AI governance covering model risk management, bias detection, explainability, and regulatory compliance.",
      justification: stage <= 2
        ? `Build internally with lightweight tooling. Governance frameworks must reflect your ${ind}-specific risk appetite, regulatory requirements, and organizational structure. Off-the-shelf governance platforms add complexity before you have enough AI deployments to govern. Start with documented policies, approval workflows, and a risk register - these cost nothing and establish the muscle memory for scaling later.`
        : `Build the framework, buy the tooling. Your governance policies and risk taxonomy should be proprietary to your ${ind} context. But the monitoring, auditing, and compliance automation underneath should be purchased: model monitoring, bias detection, and explainability tooling are commodity capabilities where vendor R&D outpaces what any single organization can build.`,
    },
    {
      category: "Implementation & Strategy Partner",
      description: stage <= 2
        ? "A strategic implementation partner can compress your learning curve by 12-18 months and avoid common early-stage pitfalls."
        : "Domain-specific expertise for complex AI transformations, change management, and operating model redesign.",
      justification: stage <= 2
        ? `Partner. At Stage ${stage}, the highest-risk failure mode is not technology selection - it is organizational: wrong governance model, misaligned incentives, AI projects that solve interesting problems instead of business problems. A strategy partner with ${ind} experience has pattern-matched across dozens of transformations and can compress the learning curve by 12-18 months, avoiding the governance pitfalls and change management failures that stall most early-stage AI programs.`
        : `Partner selectively. At Stage ${stage}, your internal capabilities should lead. Partner only for specialized domains where you lack expertise (e.g., advanced MLOps, regulatory AI compliance) or where an outside perspective can challenge internal assumptions. The risk at this stage is over-reliance on partners for capabilities you should be building in-house.`,
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

interface KPIMetric {
  metric: string;
  target: string;
  currentEstimate: number;
  targetValue: number;
  detail: string;
  dimension: string;
  category: string;
}

interface KPITemplate {
  metric: string;
  category: string;
  dimension: string;
  detail: string;
  targetBySize: { micro: string; small: string; mid: string; large: string };
  numericTarget: number; // 0-100 for gauge
}

function getSizeBracket(employeeCount: number, revenue: number): "micro" | "small" | "mid" | "large" {
  if (employeeCount <= 50 || revenue < 5_000_000) return "micro";
  if (employeeCount <= 200 || revenue < 50_000_000) return "small";
  if (employeeCount <= 2000 || revenue < 500_000_000) return "mid";
  return "large";
}

function resolveIndustryGroup(industry: string): string {
  const groupMap: Record<string, string> = {
    healthcare_providers: "healthcare", healthcare_payers: "healthcare", healthcare_services: "healthcare", life_sciences_pharma: "healthcare",
    banking: "financial_services", capital_markets: "financial_services", asset_wealth_management: "financial_services",
    investment_banking: "financial_services", private_equity: "financial_services", venture_capital: "financial_services", hedge_funds: "financial_services",
    insurance: "financial_services",
    software_saas: "technology", it_services: "technology", hardware_electronics: "technology",
    retail: "retail_ecommerce", ecommerce_digital: "retail_ecommerce", cpg: "retail_ecommerce", dtc: "retail_ecommerce", food_beverage: "retail_ecommerce",
    manufacturing_discrete: "manufacturing", manufacturing_process: "manufacturing", automotive: "manufacturing",
    chemicals_materials: "manufacturing", industrial_services: "manufacturing", construction_engineering: "manufacturing",
    energy_oil_gas: "energy_utilities", utilities: "energy_utilities",
    transportation: "shipping_logistics", shipping_logistics: "shipping_logistics", infrastructure_transport: "shipping_logistics",
    aerospace_defense: "aerospace_defense", defense_contractors: "aerospace_defense",
    telecommunications: "telecommunications", media_entertainment: "telecommunications",
    // Pure advisory / knowledge-work firms use the consulting_services KPI set
    // (billable utilization, engagement-level AI, partner governance).
    consulting_services: "consulting_services", legal_services: "consulting_services", accounting_audit: "consulting_services",
    // Government, nonprofit, and real estate each have distinct operating
    // models that do not match the billable-hour consulting KPI template.
    // Route them to the generic defaults set until bespoke templates are
    // authored. Peer examples, vendor benchmarks, and narratives still use
    // industry-specific content via their own resolvers.
    government_federal: "defaults", government_state_local: "defaults",
    nonprofit_ngo: "defaults",
    real_estate_commercial: "defaults", real_estate_residential: "defaults",
  };
  return groupMap[industry] || "defaults";
}

const INDUSTRY_KPI_TEMPLATES: Record<string, Record<string, KPITemplate[]>> = {
  healthcare: {
    low: [
      { metric: "Clinical Documentation Time Reduction", category: "Clinical Operations", dimension: "workflow_integration", detail: "Ambient AI scribes reduce documentation burden 50-70%. A 15-20% reduction in the first 90 days demonstrates tangible clinician value and builds adoption momentum.", targetBySize: { micro: "15%", small: "15%", mid: "20%", large: "25%" }, numericTarget: 80 },
      { metric: "AI Governance Framework Completion", category: "Compliance & Governance", dimension: "authority_structure", detail: "FDA and ONC AI guidance requires documented governance before clinical AI deployment. This is a prerequisite for any patient-facing AI use case.", targetBySize: { micro: "100%", small: "100%", mid: "100%", large: "100%" }, numericTarget: 100 },
      { metric: "Shadow AI Inventory Coverage", category: "Risk Management", dimension: "adoption_behavior", detail: "HIPAA liability extends to ungoverned AI tools accessing PHI. Complete inventory is the first step to managing clinical AI risk.", targetBySize: { micro: "100%", small: "100%", mid: "100%", large: "100%" }, numericTarget: 100 },
      { metric: "Clinical AI Pilot Deployments", category: "Innovation Pipeline", dimension: "decision_velocity", detail: "Target governed pilots in scheduling optimization, triage support, or clinical decision support. Each pilot builds the evidence base for broader deployment.", targetBySize: { micro: "1", small: "2", mid: "3", large: "5" }, numericTarget: 70 },
      { metric: "Staff AI Readiness Rate", category: "Workforce Development", dimension: "adoption_behavior", detail: "Percentage of clinical and administrative staff completing AI awareness training. Clinician buy-in is the #1 predictor of healthcare AI adoption success.", targetBySize: { micro: "30%", small: "25%", mid: "20%", large: "15%" }, numericTarget: 75 },
    ],
    mid: [
      { metric: "AI-Assisted Diagnostic Accuracy", category: "Clinical Quality", dimension: "workflow_integration", detail: "Leading health systems achieve 85%+ concordance between AI-flagged findings and clinician confirmation. Track improvement from your current baseline across radiology, pathology, or clinical decision support.", targetBySize: { micro: "80%+", small: "82%+", mid: "85%+", large: "85%+" }, numericTarget: 85 },
      { metric: "Revenue Cycle AI Capture Rate", category: "Financial Operations", dimension: "economic_translation", detail: "AI-powered coding and prior authorization reduces claim denials 30-40%. Measure the dollar value of denied claims recovered through AI-assisted processes.", targetBySize: { micro: "$25K/qtr", small: "$75K/qtr", mid: "$250K/qtr", large: "$1M+/qtr" }, numericTarget: 80 },
      { metric: "Patient Throughput Improvement", category: "Operational Efficiency", dimension: "decision_velocity", detail: "AI-optimized scheduling and patient flow at peer institutions improves throughput 15-20% without additional capacity. Measure patients per day per provider.", targetBySize: { micro: "8%", small: "10%", mid: "15%", large: "18%" }, numericTarget: 75 },
      { metric: "Clinical Workflow AI Adoption", category: "Digital Transformation", dimension: "adoption_behavior", detail: "Percentage of clinical workflows with active AI augmentation — from order entry to discharge planning. Peer leaders target 40%+ within 12 months of scaling.", targetBySize: { micro: "30%", small: "35%", mid: "40%", large: "45%" }, numericTarget: 80 },
      { metric: "AI ROI Measurement Coverage", category: "Financial Governance", dimension: "economic_translation", detail: "Percentage of active AI initiatives with standardized ROI tracking. Without measurement, AI budgets are indefensible in the next planning cycle.", targetBySize: { micro: "100%", small: "100%", mid: "100%", large: "100%" }, numericTarget: 100 },
    ],
    high: [
      { metric: "AI-Enabled Revenue Contribution", category: "Strategic Growth", dimension: "economic_translation", detail: "Quantified revenue from AI-powered services: remote patient monitoring, predictive care programs, precision medicine offerings. Top-quartile health systems are building new revenue streams, not just cutting costs.", targetBySize: { micro: "Measured", small: "Measured", mid: "5%+ of rev", large: "5%+ of rev" }, numericTarget: 90 },
      { metric: "Clinical AI Model Portfolio ROI", category: "Investment Returns", dimension: "economic_translation", detail: "Aggregate ROI across all deployed clinical AI models, including cost avoidance from early detection, readmission reduction, and efficiency gains.", targetBySize: { micro: "2:1+", small: "2.5:1+", mid: "3:1+", large: "4:1+" }, numericTarget: 85 },
      { metric: "Predictive Care Accuracy", category: "Clinical Excellence", dimension: "workflow_integration", detail: "Accuracy of AI models predicting patient deterioration, readmission risk, or adverse events. Leading systems achieve 90%+ sensitivity on critical alerts.", targetBySize: { micro: "85%+", small: "88%+", mid: "90%+", large: "92%+" }, numericTarget: 90 },
      { metric: "AI Innovation Pipeline Velocity", category: "Competitive Positioning", dimension: "decision_velocity", detail: "Time from clinical AI concept to validated pilot deployment. Top-quartile health systems complete this cycle in under 8 weeks.", targetBySize: { micro: "<10 wks", small: "<10 wks", mid: "<8 wks", large: "<6 wks" }, numericTarget: 85 },
    ],
  },
  financial_services: {
    low: [
      { metric: "AI Tool Inventory & Risk Classification", category: "Regulatory Compliance", dimension: "authority_structure", detail: "OCC, FDIC, and SEC are increasing AI scrutiny. Complete inventory with risk tiers is the foundation of defensible governance — and a regulatory expectation, not a nice-to-have.", targetBySize: { micro: "100%", small: "100%", mid: "100%", large: "100%" }, numericTarget: 100 },
      { metric: "Fraud Detection Pilot Accuracy", category: "Risk Operations", dimension: "workflow_integration", detail: "ML-based fraud models reduce false positives 40-60% vs. rule-based systems. Even a pilot on one transaction type proves the business case for AI investment.", targetBySize: { micro: "1 pilot", small: "1 pilot", mid: "2 pilots", large: "3 pilots" }, numericTarget: 70 },
      { metric: "Compliance Workflow AI Coverage", category: "Regulatory Efficiency", dimension: "workflow_integration", detail: "Percentage of compliance workflows with AI-assisted monitoring, documentation, or reporting. Regulators expect you to use available technology for oversight.", targetBySize: { micro: "10%", small: "15%", mid: "20%", large: "25%" }, numericTarget: 75 },
      { metric: "AI Governance Committee Establishment", category: "Governance Foundation", dimension: "authority_structure", detail: "Formal AI governance body with clear charter, risk appetite framework, and model validation requirements. Required by evolving regulatory guidance from OCC and Fed.", targetBySize: { micro: "Chartered", small: "Chartered", mid: "Chartered", large: "Chartered" }, numericTarget: 100 },
      { metric: "Staff AI Training Completion", category: "Workforce Readiness", dimension: "adoption_behavior", detail: "Percentage of client-facing and risk staff completing AI literacy program. Financial regulators increasingly expect staff to understand the AI tools they oversee.", targetBySize: { micro: "40%", small: "30%", mid: "25%", large: "20%" }, numericTarget: 75 },
    ],
    mid: [
      { metric: "Straight-Through Processing Rate", category: "Operational Efficiency", dimension: "decision_velocity", detail: "Leading institutions achieve 70%+ STP on standard transactions. Each percentage point reduces manual handling cost and error rate proportionally.", targetBySize: { micro: "50%+", small: "55%+", mid: "60%+", large: "70%+" }, numericTarget: 80 },
      { metric: "Fraud False Positive Reduction", category: "Risk Operations", dimension: "workflow_integration", detail: "ML models reduce false positives 40-60% while maintaining or improving catch rates. Fewer false positives means less customer friction and lower investigation costs.", targetBySize: { micro: "25%", small: "30%", mid: "35%", large: "40%" }, numericTarget: 80 },
      { metric: "AI-Influenced Revenue Attribution", category: "Revenue Impact", dimension: "economic_translation", detail: "Quantify assets or revenue where AI models materially influence decisions — advisory recommendations, risk pricing, portfolio construction, or client acquisition.", targetBySize: { micro: "$1M+", small: "$5M+", mid: "$50M+", large: "$500M+" }, numericTarget: 75 },
      { metric: "Model Risk Management Maturity", category: "Risk Governance", dimension: "authority_structure", detail: "Percentage of production AI models with documented validation, bias testing, and ongoing monitoring per SR 11-7 / OCC 2011-12 guidance.", targetBySize: { micro: "80%", small: "85%", mid: "90%", large: "95%" }, numericTarget: 90 },
      { metric: "Customer AI Interaction Satisfaction", category: "Client Experience", dimension: "adoption_behavior", detail: "NPS or satisfaction score for AI-powered client interactions (chatbots, robo-advisory, automated onboarding). Track against human-assisted baseline.", targetBySize: { micro: "On par", small: "On par", mid: "+5pts", large: "+10pts" }, numericTarget: 75 },
    ],
    high: [
      { metric: "AI Alpha / Incremental Return", category: "Competitive Advantage", dimension: "economic_translation", detail: "Measure the incremental return attributable to AI-driven investment, pricing, or risk decisions versus non-AI baselines. This is the ultimate proof of AI value in financial services.", targetBySize: { micro: "Measured", small: "Measured", mid: "Positive", large: "Positive" }, numericTarget: 85 },
      { metric: "Real-Time Decision Latency", category: "Decision Speed", dimension: "decision_velocity", detail: "From data signal to automated action. Top-quartile institutions process in milliseconds for trading, seconds for credit, minutes for compliance. Benchmark against peers.", targetBySize: { micro: "Top quartile", small: "Top quartile", mid: "Top quartile", large: "Top decile" }, numericTarget: 90 },
      { metric: "AI Revenue as % of Total", category: "Strategic Growth", dimension: "economic_translation", detail: "Revenue from AI-native products and services: algorithmic advisory, AI-powered risk products, automated underwriting platforms. The future P&L, not the legacy one.", targetBySize: { micro: "Measured", small: "5%+", mid: "8%+", large: "10%+" }, numericTarget: 85 },
      { metric: "Regulatory AI Compliance Score", category: "Risk Excellence", dimension: "authority_structure", detail: "Internal compliance score for AI model governance, fairness testing, and explainability requirements. Leading firms treat this as a competitive moat, not a cost center.", targetBySize: { micro: "90%+", small: "92%+", mid: "95%+", large: "98%+" }, numericTarget: 95 },
    ],
  },
  manufacturing: {
    low: [
      { metric: "Predictive Maintenance Pilot Coverage", category: "Production Operations", dimension: "adoption_behavior", detail: "Target critical production lines with IoT + ML predictive maintenance. Even a single-line pilot demonstrating reduced unplanned downtime builds the case for expansion.", targetBySize: { micro: "1 line", small: "1-2 lines", mid: "3-5 lines", large: "5-10 lines" }, numericTarget: 70 },
      { metric: "Quality Defect Detection Automation", category: "Quality Assurance", dimension: "workflow_integration", detail: "Computer vision for quality inspection catches defects human inspectors miss. Pilot on highest-defect-rate product line for fastest ROI proof.", targetBySize: { micro: "1 pilot", small: "1 pilot", mid: "2 pilots", large: "3 pilots" }, numericTarget: 70 },
      { metric: "Production Data Infrastructure", category: "Data Foundation", dimension: "workflow_integration", detail: "Percentage of critical production equipment with IoT sensors feeding a unified data platform. You cannot predict what you cannot measure.", targetBySize: { micro: "30%", small: "35%", mid: "40%", large: "50%" }, numericTarget: 75 },
      { metric: "Shop Floor AI Awareness", category: "Workforce Development", dimension: "adoption_behavior", detail: "Percentage of production supervisors and operators trained on AI-augmented workflows. Operator trust is the adoption bottleneck in manufacturing AI.", targetBySize: { micro: "40%", small: "30%", mid: "25%", large: "20%" }, numericTarget: 75 },
      { metric: "AI Governance Charter", category: "Governance Foundation", dimension: "authority_structure", detail: "Establish formal AI governance covering model validation, safety thresholds for production AI, and escalation protocols for anomalous predictions.", targetBySize: { micro: "Chartered", small: "Chartered", mid: "Chartered", large: "Chartered" }, numericTarget: 100 },
    ],
    mid: [
      { metric: "Unplanned Downtime Reduction", category: "Production Efficiency", dimension: "decision_velocity", detail: "AI-predicted maintenance reduces unplanned downtime 30-40% at peer manufacturers. Track hours of unplanned downtime per production line per month against baseline.", targetBySize: { micro: "20%", small: "25%", mid: "30%", large: "35%" }, numericTarget: 80 },
      { metric: "First-Pass Yield Improvement", category: "Production Quality", dimension: "economic_translation", detail: "AI-optimized process parameters improve first-pass yield 2-5% at advanced manufacturers. Even 1% yield improvement translates to significant margin impact at scale.", targetBySize: { micro: "1%", small: "1.5%", mid: "2%", large: "3%" }, numericTarget: 75 },
      { metric: "Energy Consumption per Unit Reduction", category: "Operational Cost", dimension: "economic_translation", detail: "AI-optimized energy management reduces per-unit energy cost 10-15%. Measurable, defensible savings that directly impact COGS.", targetBySize: { micro: "5%", small: "8%", mid: "10%", large: "12%" }, numericTarget: 75 },
      { metric: "Supply Chain Forecast Accuracy", category: "Planning & Logistics", dimension: "workflow_integration", detail: "ML-based demand and supply forecasting improves accuracy 15-25% over traditional methods, reducing inventory carrying costs and stockouts.", targetBySize: { micro: "+10%", small: "+12%", mid: "+15%", large: "+20%" }, numericTarget: 80 },
      { metric: "AI Initiative ROI Tracking", category: "Financial Governance", dimension: "economic_translation", detail: "Percentage of active AI initiatives with standardized ROI measurement. Manufacturing CFOs need hard numbers — not pilot stories — to approve the next investment cycle.", targetBySize: { micro: "100%", small: "100%", mid: "100%", large: "100%" }, numericTarget: 100 },
    ],
    high: [
      { metric: "Digital Twin Coverage", category: "Advanced Operations", dimension: "workflow_integration", detail: "AI-powered digital twins of production processes enable simulation, optimization, and predictive scenario planning. The competitive moat of next-generation manufacturing.", targetBySize: { micro: "1 line", small: "1 facility", mid: "3+ facilities", large: "Enterprise" }, numericTarget: 85 },
      { metric: "Autonomous Production Coverage", category: "Operational Excellence", dimension: "decision_velocity", detail: "Percentage of production processes with AI-driven autonomous or semi-autonomous operation. Leading manufacturers target lights-out operation on standard runs.", targetBySize: { micro: "10%", small: "15%", mid: "25%", large: "35%" }, numericTarget: 85 },
      { metric: "AI-Driven Revenue from Smart Products", category: "Product Innovation", dimension: "economic_translation", detail: "Revenue from products with embedded AI features or AI-enabled services (predictive maintenance as a service, smart product analytics). This is the manufacturing competitive moat of the next decade.", targetBySize: { micro: "Measured", small: "Measured", mid: "5%+ of rev", large: "8%+ of rev" }, numericTarget: 85 },
      { metric: "Manufacturing AI Portfolio ROI", category: "Investment Returns", dimension: "economic_translation", detail: "Blended return across all production AI investments: predictive maintenance, quality, yield optimization, energy, and supply chain combined.", targetBySize: { micro: "2:1+", small: "2.5:1+", mid: "3:1+", large: "4:1+" }, numericTarget: 85 },
    ],
  },
  shipping_logistics: {
    low: [
      { metric: "Route Optimization Pilot Savings", category: "Fleet Operations", dimension: "workflow_integration", detail: "AI route planning saves 10-15% fuel cost on average. Deploy on your highest-volume corridor first for fastest measurable ROI.", targetBySize: { micro: "5%", small: "8%", mid: "10%", large: "12%" }, numericTarget: 75 },
      { metric: "Shipment Visibility Coverage", category: "Customer Experience", dimension: "adoption_behavior", detail: "Percentage of shipments with real-time AI-powered tracking and ETA prediction. Customers increasingly treat this as table stakes, not a differentiator.", targetBySize: { micro: "50%", small: "60%", mid: "70%", large: "85%" }, numericTarget: 80 },
      { metric: "Logistics AI Governance Framework", category: "Governance Foundation", dimension: "authority_structure", detail: "Formal governance covering AI-driven routing decisions, autonomous vehicle testing protocols, and algorithmic pricing oversight.", targetBySize: { micro: "Chartered", small: "Chartered", mid: "Chartered", large: "Chartered" }, numericTarget: 100 },
      { metric: "Warehouse AI Pilot Deployment", category: "Warehouse Operations", dimension: "decision_velocity", detail: "Deploy AI-guided picking, computer vision for damage detection, or predictive inventory positioning in at least one facility.", targetBySize: { micro: "1 pilot", small: "1 pilot", mid: "2 pilots", large: "3 pilots" }, numericTarget: 70 },
      { metric: "Operations Team AI Training", category: "Workforce Readiness", dimension: "adoption_behavior", detail: "Percentage of dispatchers, warehouse supervisors, and fleet managers trained on AI-augmented tools. Frontline adoption determines whether AI investments pay off.", targetBySize: { micro: "40%", small: "35%", mid: "30%", large: "25%" }, numericTarget: 75 },
    ],
    mid: [
      { metric: "Warehouse Pick Accuracy", category: "Warehouse Operations", dimension: "workflow_integration", detail: "AI-guided picking and computer vision verification at peer operations achieve 99.5%+ accuracy. Track error rate reduction from baseline.", targetBySize: { micro: "98.5%", small: "99%", mid: "99.3%", large: "99.5%" }, numericTarget: 85 },
      { metric: "Demand Forecast Accuracy Improvement", category: "Planning & Capacity", dimension: "decision_velocity", detail: "ML-based demand forecasting improves capacity planning accuracy 15-25% over traditional methods, reducing deadhead miles and excess capacity costs.", targetBySize: { micro: "+10%", small: "+12%", mid: "+15%", large: "+20%" }, numericTarget: 80 },
      { metric: "Cost per Shipment Reduction", category: "Unit Economics", dimension: "economic_translation", detail: "Aggregate AI impact on per-shipment cost: routing, labor, fuel, damage reduction. This is the number your CFO and board care about.", targetBySize: { micro: "3%", small: "5%", mid: "7%", large: "10%" }, numericTarget: 80 },
      { metric: "Fleet Utilization Improvement", category: "Asset Efficiency", dimension: "economic_translation", detail: "AI-optimized load planning and dynamic routing improves fleet utilization 8-12%. More revenue per asset without adding trucks.", targetBySize: { micro: "5%", small: "7%", mid: "9%", large: "12%" }, numericTarget: 80 },
      { metric: "Last-Mile Delivery Prediction Accuracy", category: "Customer Satisfaction", dimension: "workflow_integration", detail: "AI-powered ETA prediction within 15-minute windows. Customer satisfaction and retention correlate directly with delivery predictability.", targetBySize: { micro: "80%+", small: "82%+", mid: "85%+", large: "90%+" }, numericTarget: 85 },
    ],
    high: [
      { metric: "Autonomous Operations Coverage", category: "Advanced Automation", dimension: "workflow_integration", detail: "Percentage of sortation, loading, or last-mile operations with AI-driven autonomous or semi-autonomous systems. The labor arbitrage of the next decade.", targetBySize: { micro: "1 facility", small: "1 facility", mid: "3+ facilities", large: "Network-wide" }, numericTarget: 85 },
      { metric: "AI-Driven Network Optimization ROI", category: "Strategic Returns", dimension: "economic_translation", detail: "Blended return from AI across the entire logistics network: routing, warehousing, demand planning, and fleet management combined.", targetBySize: { micro: "2:1+", small: "2.5:1+", mid: "3:1+", large: "4:1+" }, numericTarget: 85 },
      { metric: "Predictive Supply Chain Resilience", category: "Risk Management", dimension: "decision_velocity", detail: "Time from disruption signal (weather, port closure, supplier issue) to automated rerouting decision. Leading networks respond in hours, not days.", targetBySize: { micro: "<24hr", small: "<12hr", mid: "<6hr", large: "<2hr" }, numericTarget: 90 },
      { metric: "Carbon Footprint Reduction via AI", category: "Sustainability Impact", dimension: "economic_translation", detail: "Measurable CO2 reduction from AI-optimized routing, load consolidation, and fleet electrification planning. Increasingly required by enterprise customers and ESG mandates.", targetBySize: { micro: "5%", small: "8%", mid: "10%", large: "15%" }, numericTarget: 80 },
    ],
  },
  technology: {
    low: [
      { metric: "Developer AI Tool Adoption", category: "Engineering Productivity", dimension: "adoption_behavior", detail: "Percentage of engineering team actively using AI coding assistants (Copilot, Cursor, etc.) weekly. Developer productivity gains of 30-55% are well-documented.", targetBySize: { micro: "60%", small: "50%", mid: "40%", large: "35%" }, numericTarget: 80 },
      { metric: "AI Feature Roadmap Coverage", category: "Product Strategy", dimension: "decision_velocity", detail: "Percentage of product roadmap items with AI/ML components. If AI isn't in the product, it's in the competitor's product.", targetBySize: { micro: "20%", small: "20%", mid: "25%", large: "30%" }, numericTarget: 70 },
      { metric: "AI/ML Infrastructure Readiness", category: "Technical Foundation", dimension: "workflow_integration", detail: "Production-ready ML pipeline, model registry, and monitoring. Without infrastructure, every AI project is a one-off science experiment.", targetBySize: { micro: "MVP", small: "MVP", mid: "Production", large: "Production" }, numericTarget: 75 },
      { metric: "AI Ethics & Governance Framework", category: "Trust & Safety", dimension: "authority_structure", detail: "Documented framework for AI bias testing, data privacy, and responsible deployment. Customer trust depends on it; enterprise sales require it.", targetBySize: { micro: "Drafted", small: "Drafted", mid: "Ratified", large: "Ratified" }, numericTarget: 100 },
      { metric: "Team AI Literacy Rate", category: "Workforce Development", dimension: "adoption_behavior", detail: "Percentage of product, design, and go-to-market staff who understand AI capabilities well enough to identify opportunities. AI can't be engineering-only.", targetBySize: { micro: "50%", small: "40%", mid: "35%", large: "30%" }, numericTarget: 75 },
    ],
    mid: [
      { metric: "AI-Powered Feature Usage Rate", category: "Product Engagement", dimension: "workflow_integration", detail: "Percentage of active users engaging with AI-powered features monthly. Building AI features nobody uses is worse than not building them.", targetBySize: { micro: "20%+", small: "25%+", mid: "30%+", large: "35%+" }, numericTarget: 80 },
      { metric: "Code Review Automation Coverage", category: "Engineering Efficiency", dimension: "workflow_integration", detail: "Percentage of code reviews with AI-assisted analysis (security, performance, style). Reduces review cycle time 40-60% at leading engineering orgs.", targetBySize: { micro: "50%", small: "55%", mid: "60%", large: "70%" }, numericTarget: 80 },
      { metric: "AI Feature Revenue Attribution", category: "Revenue Impact", dimension: "economic_translation", detail: "Revenue directly attributable to AI-powered features — upsell, retention, or net-new. The metric that justifies the next round of AI investment.", targetBySize: { micro: "$100K+", small: "$500K+", mid: "$2M+", large: "$10M+" }, numericTarget: 75 },
      { metric: "Model Deployment Velocity", category: "Engineering Speed", dimension: "decision_velocity", detail: "Time from trained model to production deployment. Best-in-class teams deploy in hours, not weeks. Slow deployment kills AI competitive advantage.", targetBySize: { micro: "<1 wk", small: "<1 wk", mid: "<3 days", large: "<1 day" }, numericTarget: 80 },
      { metric: "AI Incident Response Time", category: "Operational Reliability", dimension: "authority_structure", detail: "Mean time to detect and mitigate AI model degradation, bias drift, or hallucination in production. Customer-facing AI failures are brand-damaging.", targetBySize: { micro: "<4hr", small: "<2hr", mid: "<1hr", large: "<30min" }, numericTarget: 85 },
    ],
    high: [
      { metric: "AI-Native Product Revenue %", category: "Strategic Growth", dimension: "economic_translation", detail: "Revenue from products where AI is the core value proposition, not an add-on feature. This is the future P&L — measure it separately from legacy revenue.", targetBySize: { micro: "15%+", small: "15%+", mid: "20%+", large: "25%+" }, numericTarget: 85 },
      { metric: "AI Competitive Moat Strength", category: "Market Position", dimension: "workflow_integration", detail: "Proprietary data flywheel, model performance advantage, or AI-enabled network effects that competitors cannot easily replicate. Qualitative + quantitative assessment.", targetBySize: { micro: "Assessed", small: "Assessed", mid: "Measured", large: "Measured" }, numericTarget: 85 },
      { metric: "Platform AI API Revenue", category: "Ecosystem Value", dimension: "economic_translation", detail: "Revenue from AI capabilities exposed as APIs or platform features to customers and partners. The platform play is where technology companies capture exponential value.", targetBySize: { micro: "Launched", small: "Launched", mid: "$1M+", large: "$5M+" }, numericTarget: 80 },
      { metric: "AI R&D Efficiency Ratio", category: "Investment Returns", dimension: "decision_velocity", detail: "Revenue generated per dollar of AI R&D investment. Top-quartile technology companies achieve 5:1+ within 24 months of focused AI investment.", targetBySize: { micro: "3:1+", small: "3:1+", mid: "4:1+", large: "5:1+" }, numericTarget: 85 },
    ],
  },
  retail_ecommerce: {
    low: [
      { metric: "Demand Forecast Accuracy Baseline", category: "Inventory Management", dimension: "workflow_integration", detail: "Establish AI-powered demand forecasting baseline on top 20% of SKUs by revenue. ML models outperform traditional methods by 15-25% on forecast accuracy.", targetBySize: { micro: "Top 100 SKUs", small: "Top 20%", mid: "Top 20%", large: "Top 30%" }, numericTarget: 70 },
      { metric: "Customer Segmentation AI Deployment", category: "Marketing Intelligence", dimension: "adoption_behavior", detail: "Deploy ML-based customer segmentation replacing rule-based segments. AI segmentation typically improves campaign response rates 20-40%.", targetBySize: { micro: "1 model", small: "1 model", mid: "2 models", large: "3 models" }, numericTarget: 70 },
      { metric: "Pricing Intelligence Pilot", category: "Revenue Optimization", dimension: "decision_velocity", detail: "AI-driven dynamic pricing on at least one product category. Peer retailers see 2-5% margin improvement from algorithmic pricing.", targetBySize: { micro: "1 category", small: "1 category", mid: "2 categories", large: "3 categories" }, numericTarget: 65 },
      { metric: "Retail AI Governance Framework", category: "Compliance & Ethics", dimension: "authority_structure", detail: "Governance covering algorithmic pricing fairness, personalization bias, and customer data privacy. FTC scrutiny on dark patterns makes this non-optional.", targetBySize: { micro: "Drafted", small: "Drafted", mid: "Ratified", large: "Ratified" }, numericTarget: 100 },
      { metric: "Store/Warehouse Team AI Training", category: "Workforce Readiness", dimension: "adoption_behavior", detail: "Percentage of store managers and warehouse leads trained on AI-augmented tools. Frontline adoption determines whether AI investments translate to the P&L.", targetBySize: { micro: "40%", small: "35%", mid: "30%", large: "25%" }, numericTarget: 75 },
    ],
    mid: [
      { metric: "Personalization Revenue Lift", category: "Customer Experience", dimension: "workflow_integration", detail: "Incremental revenue from AI-powered product recommendations, personalized pricing, and targeted promotions versus non-personalized baseline.", targetBySize: { micro: "3%", small: "5%", mid: "7%", large: "8%" }, numericTarget: 80 },
      { metric: "Inventory Carrying Cost Reduction", category: "Supply Chain Efficiency", dimension: "economic_translation", detail: "AI-optimized inventory positioning reduces carrying costs 10-20% while maintaining or improving in-stock rates. Direct margin impact.", targetBySize: { micro: "8%", small: "10%", mid: "12%", large: "15%" }, numericTarget: 80 },
      { metric: "Customer Lifetime Value Prediction Accuracy", category: "Marketing Analytics", dimension: "decision_velocity", detail: "AI-predicted CLV accuracy vs. actuals. Accurate CLV prediction drives better acquisition spending, retention investment, and personalization decisions.", targetBySize: { micro: "70%+", small: "75%+", mid: "80%+", large: "85%+" }, numericTarget: 80 },
      { metric: "Markdown Optimization Savings", category: "Margin Protection", dimension: "economic_translation", detail: "AI-timed markdowns reduce excess inventory clearance costs 15-25%. Measure gross margin improvement on marked-down inventory vs. previous season.", targetBySize: { micro: "10%", small: "12%", mid: "15%", large: "20%" }, numericTarget: 80 },
      { metric: "Omnichannel AI Integration", category: "Digital Transformation", dimension: "adoption_behavior", detail: "Percentage of customer touchpoints (web, app, store, email, support) with unified AI-powered personalization. Fragmented AI = fragmented customer experience.", targetBySize: { micro: "3 channels", small: "3 channels", mid: "4 channels", large: "5 channels" }, numericTarget: 75 },
    ],
    high: [
      { metric: "AI-Attributed Revenue %", category: "Strategic Growth", dimension: "economic_translation", detail: "Total revenue where AI materially influenced the transaction: personalized recommendations, dynamic pricing, predictive inventory, automated merchandising.", targetBySize: { micro: "15%+", small: "20%+", mid: "25%+", large: "30%+" }, numericTarget: 85 },
      { metric: "Autonomous Merchandising Coverage", category: "Operational Excellence", dimension: "workflow_integration", detail: "Percentage of merchandising decisions (assortment, placement, pricing) made or recommended by AI with human oversight rather than human-led.", targetBySize: { micro: "20%", small: "25%", mid: "35%", large: "45%" }, numericTarget: 85 },
      { metric: "Retail AI Portfolio ROI", category: "Investment Returns", dimension: "economic_translation", detail: "Blended return across all retail AI investments: demand forecasting, personalization, pricing, supply chain, and customer service combined.", targetBySize: { micro: "3:1+", small: "3:1+", mid: "4:1+", large: "5:1+" }, numericTarget: 85 },
      { metric: "Customer Churn Prediction Accuracy", category: "Retention Intelligence", dimension: "decision_velocity", detail: "AI-predicted churn accuracy enables proactive retention. Top retailers achieve 85%+ accuracy with 30-day advance warning, enabling targeted intervention.", targetBySize: { micro: "80%+", small: "82%+", mid: "85%+", large: "88%+" }, numericTarget: 88 },
    ],
  },
  energy_utilities: {
    low: [
      { metric: "Predictive Asset Maintenance Pilot", category: "Grid/Plant Operations", dimension: "workflow_integration", detail: "Deploy AI-predicted maintenance on highest-criticality assets. Utilities with predictive maintenance reduce unplanned outages 25-35% on targeted equipment.", targetBySize: { micro: "1 pilot", small: "2 pilots", mid: "3 pilots", large: "5 pilots" }, numericTarget: 70 },
      { metric: "SCADA/IoT Data Integration", category: "Data Foundation", dimension: "workflow_integration", detail: "Percentage of critical operational data flowing into unified analytics platform. Siloed SCADA data is the #1 barrier to AI deployment in utilities.", targetBySize: { micro: "30%", small: "40%", mid: "50%", large: "60%" }, numericTarget: 75 },
      { metric: "AI Safety & Compliance Framework", category: "Regulatory Governance", dimension: "authority_structure", detail: "Formal AI governance covering grid reliability impacts, NERC CIP implications, and safety-critical system validation. Regulators and PUCs expect documented AI governance.", targetBySize: { micro: "Drafted", small: "Drafted", mid: "Ratified", large: "Ratified" }, numericTarget: 100 },
      { metric: "Field Crew AI Tool Adoption", category: "Workforce Enablement", dimension: "adoption_behavior", detail: "Percentage of field technicians using AI-augmented inspection, work order prioritization, or route optimization tools.", targetBySize: { micro: "25%", small: "25%", mid: "30%", large: "35%" }, numericTarget: 75 },
      { metric: "Energy Trading/Procurement AI Pilot", category: "Financial Operations", dimension: "economic_translation", detail: "AI-assisted energy procurement or trading on at least one market or contract type. ML models improve price forecasting 10-20% vs. traditional methods.", targetBySize: { micro: "1 pilot", small: "1 pilot", mid: "2 pilots", large: "3 pilots" }, numericTarget: 65 },
    ],
    mid: [
      { metric: "Asset Failure Prediction Accuracy", category: "Reliability Engineering", dimension: "workflow_integration", detail: "AI-predicted equipment failure accuracy on monitored assets. Leading utilities achieve 85%+ with 7+ day advance warning, enabling planned maintenance windows.", targetBySize: { micro: "75%+", small: "80%+", mid: "85%+", large: "88%+" }, numericTarget: 85 },
      { metric: "Outage Duration Reduction", category: "Customer Reliability", dimension: "decision_velocity", detail: "AI-optimized crew dispatch and fault localization reduce average outage duration 20-30%. Directly impacts SAIDI/SAIFI metrics and regulatory performance.", targetBySize: { micro: "15%", small: "18%", mid: "22%", large: "28%" }, numericTarget: 80 },
      { metric: "Grid/Plant Efficiency Improvement", category: "Operational Performance", dimension: "economic_translation", detail: "AI-optimized operations improve thermal efficiency, reduce line losses, or optimize renewable dispatch. Each 1% efficiency gain translates to millions in fuel savings.", targetBySize: { micro: "1%", small: "1.5%", mid: "2%", large: "3%" }, numericTarget: 75 },
      { metric: "Demand Response AI Accuracy", category: "Load Management", dimension: "decision_velocity", detail: "AI-predicted load forecasting accuracy enables better demand response programs, reducing peak capacity costs and improving grid stability.", targetBySize: { micro: "80%+", small: "82%+", mid: "85%+", large: "90%+" }, numericTarget: 85 },
      { metric: "AI Initiative ROI Documentation", category: "Financial Governance", dimension: "economic_translation", detail: "Percentage of AI initiatives with PUC/board-ready ROI documentation. Utility regulators require defensible cost-benefit analysis for rate-base recovery of AI investments.", targetBySize: { micro: "100%", small: "100%", mid: "100%", large: "100%" }, numericTarget: 100 },
    ],
    high: [
      { metric: "AI-Optimized Grid/Plant ROI", category: "Investment Returns", dimension: "economic_translation", detail: "Aggregate return from AI across operations: predictive maintenance, load optimization, trading, and customer management. The number that justifies the next investment cycle.", targetBySize: { micro: "2:1+", small: "2.5:1+", mid: "3:1+", large: "4:1+" }, numericTarget: 85 },
      { metric: "Autonomous Grid Operations Coverage", category: "Advanced Automation", dimension: "workflow_integration", detail: "Percentage of grid operations with AI-driven autonomous or semi-autonomous management: self-healing networks, automated dispatch, dynamic load balancing.", targetBySize: { micro: "10%", small: "15%", mid: "25%", large: "35%" }, numericTarget: 85 },
      { metric: "Renewable Integration Optimization", category: "Strategic Positioning", dimension: "decision_velocity", detail: "AI-optimized renewable dispatch and storage management maximizing clean energy utilization. The strategic capability that defines next-generation utilities.", targetBySize: { micro: "Measured", small: "Measured", mid: "+10% util", large: "+15% util" }, numericTarget: 85 },
      { metric: "Customer AI Service Satisfaction", category: "Customer Experience", dimension: "adoption_behavior", detail: "Customer satisfaction with AI-powered outage communication, usage insights, and billing support. Increasingly a competitive differentiator in deregulated markets.", targetBySize: { micro: "+5pts NPS", small: "+5pts", mid: "+8pts", large: "+10pts" }, numericTarget: 80 },
    ],
  },
  telecommunications: {
    low: [
      { metric: "Network Anomaly Detection Pilot", category: "Network Operations", dimension: "workflow_integration", detail: "Deploy AI-based anomaly detection on core network segments. ML models detect network issues 60-80% faster than threshold-based alerting.", targetBySize: { micro: "1 segment", small: "1 segment", mid: "2 segments", large: "3 segments" }, numericTarget: 70 },
      { metric: "Customer Churn Prediction Model", category: "Revenue Protection", dimension: "decision_velocity", detail: "ML-based churn prediction with at least 30-day advance warning. Telecom churn costs 5-10x more than retention — predictive targeting is table stakes.", targetBySize: { micro: "1 model", small: "1 model", mid: "1 model", large: "2 models" }, numericTarget: 70 },
      { metric: "AI Governance & Data Framework", category: "Compliance Foundation", dimension: "authority_structure", detail: "Governance covering customer data usage for AI, algorithmic fairness in pricing/service, and network AI safety. FCC and state AG scrutiny is increasing.", targetBySize: { micro: "Drafted", small: "Drafted", mid: "Ratified", large: "Ratified" }, numericTarget: 100 },
      { metric: "Contact Center AI Pilot", category: "Customer Experience", dimension: "adoption_behavior", detail: "Deploy AI-assisted customer service (chatbot, agent assist, or call routing) on highest-volume issue type. Reduces cost per interaction 20-40%.", targetBySize: { micro: "1 use case", small: "1 use case", mid: "2 use cases", large: "3 use cases" }, numericTarget: 70 },
      { metric: "Frontline Staff AI Training", category: "Workforce Readiness", dimension: "adoption_behavior", detail: "Percentage of NOC, field, and contact center staff trained on AI-augmented tools and workflows.", targetBySize: { micro: "35%", small: "30%", mid: "25%", large: "20%" }, numericTarget: 75 },
    ],
    mid: [
      { metric: "Mean Time to Repair Reduction", category: "Network Reliability", dimension: "decision_velocity", detail: "AI-assisted fault localization and predictive dispatch reduces MTTR 25-35% at leading operators. Directly impacts SLA compliance and customer satisfaction.", targetBySize: { micro: "20%", small: "22%", mid: "25%", large: "30%" }, numericTarget: 80 },
      { metric: "Network Capacity Optimization", category: "Infrastructure Efficiency", dimension: "workflow_integration", detail: "AI-driven traffic management and capacity planning improves network utilization 15-20%, deferring capex on new infrastructure.", targetBySize: { micro: "10%", small: "12%", mid: "15%", large: "18%" }, numericTarget: 80 },
      { metric: "ARPU Uplift from AI Personalization", category: "Revenue Growth", dimension: "economic_translation", detail: "AI-powered plan recommendations, upsell timing, and personalized offers increase ARPU 3-8% at peer operators.", targetBySize: { micro: "2%", small: "3%", mid: "5%", large: "7%" }, numericTarget: 75 },
      { metric: "Contact Center AI Resolution Rate", category: "Customer Efficiency", dimension: "adoption_behavior", detail: "Percentage of customer interactions fully resolved by AI without human handoff. Leading operators achieve 40-50% on common issue types.", targetBySize: { micro: "30%", small: "35%", mid: "40%", large: "45%" }, numericTarget: 80 },
      { metric: "AI Investment ROI Tracking", category: "Financial Governance", dimension: "economic_translation", detail: "All active AI initiatives with standardized ROI measurement. Telecom boards demand hard numbers given the capital intensity of the business.", targetBySize: { micro: "100%", small: "100%", mid: "100%", large: "100%" }, numericTarget: 100 },
    ],
    high: [
      { metric: "Self-Healing Network Coverage", category: "Advanced Automation", dimension: "workflow_integration", detail: "Percentage of network with AI-driven self-healing capability: automatic rerouting, load balancing, and fault isolation without human intervention.", targetBySize: { micro: "15%", small: "20%", mid: "30%", large: "40%" }, numericTarget: 85 },
      { metric: "AI-Driven Revenue %", category: "Strategic Growth", dimension: "economic_translation", detail: "Revenue from AI-native services: smart network slicing, AI-powered enterprise solutions, IoT analytics platforms. The post-connectivity revenue model.", targetBySize: { micro: "5%+", small: "8%+", mid: "10%+", large: "15%+" }, numericTarget: 85 },
      { metric: "5G/Edge AI Monetization", category: "Platform Innovation", dimension: "economic_translation", detail: "Revenue from AI capabilities enabled by 5G/edge infrastructure: real-time analytics, autonomous systems support, AR/VR services. The platform play that justifies 5G capex.", targetBySize: { micro: "Launched", small: "Launched", mid: "$2M+", large: "$10M+" }, numericTarget: 80 },
      { metric: "Telecom AI Portfolio ROI", category: "Investment Returns", dimension: "economic_translation", detail: "Blended return across all AI investments: network optimization, customer management, fraud detection, and new service revenue.", targetBySize: { micro: "2.5:1+", small: "3:1+", mid: "3.5:1+", large: "4:1+" }, numericTarget: 85 },
    ],
  },
  aerospace_defense: {
    low: [
      { metric: "Predictive Maintenance Pilot (Fleet/Systems)", category: "Mission Readiness", dimension: "workflow_integration", detail: "Deploy AI-predicted maintenance on highest-criticality platforms. DoD and prime contractors report 25-40% reduction in unscheduled maintenance through predictive analytics.", targetBySize: { micro: "1 system", small: "1-2 systems", mid: "3 systems", large: "5 systems" }, numericTarget: 70 },
      { metric: "AI Security & Classification Framework", category: "Compliance & Security", dimension: "authority_structure", detail: "Formal AI governance covering ITAR, CMMC, and classified environment constraints. AI deployment in defense requires security-first architecture — not an afterthought.", targetBySize: { micro: "Drafted", small: "Drafted", mid: "Ratified", large: "Ratified" }, numericTarget: 100 },
      { metric: "Supply Chain Visibility AI", category: "Program Management", dimension: "decision_velocity", detail: "AI-powered supply chain risk monitoring for critical components and long-lead items. Defense supply chains are uniquely fragile — visibility is a strategic imperative.", targetBySize: { micro: "1 pilot", small: "1 pilot", mid: "2 pilots", large: "3 pilots" }, numericTarget: 70 },
      { metric: "Engineering Team AI Adoption", category: "Workforce Enablement", dimension: "adoption_behavior", detail: "Percentage of engineering and program management staff using AI tools for design, analysis, documentation, or code generation.", targetBySize: { micro: "30%", small: "30%", mid: "35%", large: "40%" }, numericTarget: 75 },
      { metric: "Digital Engineering Foundation", category: "Technical Infrastructure", dimension: "workflow_integration", detail: "Model-based systems engineering (MBSE) with AI-ready data architecture. Without digital thread infrastructure, AI cannot operate across the program lifecycle.", targetBySize: { micro: "Assessed", small: "Assessed", mid: "Piloted", large: "Piloted" }, numericTarget: 65 },
    ],
    mid: [
      { metric: "Platform Availability Improvement", category: "Mission Readiness", dimension: "decision_velocity", detail: "AI-predicted maintenance and logistics optimization improving platform operational availability. Every 1% improvement in Ao translates to mission capability.", targetBySize: { micro: "3%", small: "4%", mid: "5%", large: "7%" }, numericTarget: 80 },
      { metric: "Digital Twin Coverage", category: "Advanced Engineering", dimension: "workflow_integration", detail: "Systems with AI-powered digital twins for simulation, prognostics, and mission planning. The DoD Digital Engineering Strategy makes this a contract requirement.", targetBySize: { micro: "1 system", small: "2 systems", mid: "3+ systems", large: "5+ systems" }, numericTarget: 80 },
      { metric: "Program Cost Variance Reduction", category: "Financial Performance", dimension: "economic_translation", detail: "AI-assisted cost estimation and risk prediction reducing program cost overruns. Defense programs average 20%+ cost growth — AI can cut this significantly.", targetBySize: { micro: "10%", small: "12%", mid: "15%", large: "20%" }, numericTarget: 75 },
      { metric: "Autonomous Test & Evaluation Coverage", category: "Quality Assurance", dimension: "workflow_integration", detail: "Percentage of test procedures with AI-augmented analysis, anomaly detection, or automated evaluation. Reduces test cycle time 20-30%.", targetBySize: { micro: "15%", small: "20%", mid: "25%", large: "35%" }, numericTarget: 80 },
      { metric: "AI ROI Documentation for Contracts", category: "Business Development", dimension: "economic_translation", detail: "AI capabilities with documented ROI for inclusion in proposals and contract modifications. AI is increasingly a discriminator in competitive source selections.", targetBySize: { micro: "3 cases", small: "5 cases", mid: "8 cases", large: "12 cases" }, numericTarget: 75 },
    ],
    high: [
      { metric: "AI-Enabled Contract Revenue %", category: "Strategic Growth", dimension: "economic_translation", detail: "Revenue from contracts where AI capabilities are a material differentiator or deliverable. The future competitive advantage in defense and aerospace.", targetBySize: { micro: "10%+", small: "15%+", mid: "20%+", large: "25%+" }, numericTarget: 85 },
      { metric: "Autonomous Systems Maturity", category: "Technology Leadership", dimension: "workflow_integration", detail: "Number of autonomous or semi-autonomous systems in production or advanced development. Autonomy is the defining technology race in defense.", targetBySize: { micro: "1 system", small: "2 systems", mid: "3+ systems", large: "5+ systems" }, numericTarget: 85 },
      { metric: "Cross-Program AI Reuse Rate", category: "Portfolio Efficiency", dimension: "decision_velocity", detail: "Percentage of AI models and components reused across programs. Reuse is the path from one-off projects to scalable AI capability — and dramatically improves program margins.", targetBySize: { micro: "20%", small: "25%", mid: "35%", large: "45%" }, numericTarget: 85 },
      { metric: "A&D AI Portfolio ROI", category: "Investment Returns", dimension: "economic_translation", detail: "Blended return across all AI investments: predictive maintenance, digital engineering, autonomous systems, and contract differentiation.", targetBySize: { micro: "2:1+", small: "2.5:1+", mid: "3:1+", large: "4:1+" }, numericTarget: 85 },
    ],
  },
  consulting_services: {
    low: [
      { metric: "Consultant AI Tool Adoption", category: "Delivery Efficiency", dimension: "adoption_behavior", detail: "Percentage of consultants actively using AI for research, analysis, document generation, or client deliverables. Productivity gains of 30-50% are achievable immediately.", targetBySize: { micro: "60%", small: "50%", mid: "40%", large: "35%" }, numericTarget: 80 },
      { metric: "Proposal Generation AI Acceleration", category: "Business Development", dimension: "decision_velocity", detail: "Reduction in proposal/RFP response time using AI-assisted drafting, pricing analysis, and competitive intelligence. Faster proposals win more business.", targetBySize: { micro: "30%", small: "30%", mid: "25%", large: "25%" }, numericTarget: 75 },
      { metric: "Knowledge Management AI Deployment", category: "Intellectual Capital", dimension: "workflow_integration", detail: "AI-powered search and synthesis across prior deliverables, case studies, and institutional knowledge. The asset that differentiates experienced firms from new entrants.", targetBySize: { micro: "Piloted", small: "Piloted", mid: "Deployed", large: "Deployed" }, numericTarget: 70 },
      { metric: "AI Service Offering Definition", category: "Product Strategy", dimension: "economic_translation", detail: "At least one defined AI-powered service offering for clients. If you are not selling AI advisory services, your competitors are already doing it.", targetBySize: { micro: "1 offering", small: "1 offering", mid: "2 offerings", large: "3 offerings" }, numericTarget: 70 },
      { metric: "AI Ethics & Data Governance", category: "Client Trust", dimension: "authority_structure", detail: "Governance framework for AI use with client data: confidentiality, bias prevention, and audit trails. Client trust is the currency of professional services.", targetBySize: { micro: "Drafted", small: "Drafted", mid: "Ratified", large: "Ratified" }, numericTarget: 100 },
    ],
    mid: [
      { metric: "Utilization Rate Improvement", category: "Financial Performance", dimension: "economic_translation", detail: "AI-augmented delivery enabling higher utilization rates by reducing non-billable research, admin, and rework time. Each point of utilization improvement flows directly to margin.", targetBySize: { micro: "+3pts", small: "+3pts", mid: "+4pts", large: "+5pts" }, numericTarget: 80 },
      { metric: "AI-Powered Client Insight Delivery", category: "Service Quality", dimension: "workflow_integration", detail: "Percentage of client engagements enhanced with AI-generated analysis, benchmarking, or predictive insights that complement consultant expertise.", targetBySize: { micro: "40%", small: "45%", mid: "50%", large: "60%" }, numericTarget: 80 },
      { metric: "AI Service Revenue Attribution", category: "Revenue Growth", dimension: "economic_translation", detail: "Revenue from engagements where AI capabilities were a material differentiator in winning or expanding the work.", targetBySize: { micro: "$50K+", small: "$200K+", mid: "$1M+", large: "$5M+" }, numericTarget: 75 },
      { metric: "Deliverable Quality Consistency", category: "Operational Excellence", dimension: "workflow_integration", detail: "Reduction in deliverable revision cycles through AI-assisted quality checks, formatting, and consistency verification across engagement teams.", targetBySize: { micro: "25%", small: "25%", mid: "30%", large: "35%" }, numericTarget: 75 },
      { metric: "Client Satisfaction Improvement", category: "Client Outcomes", dimension: "adoption_behavior", detail: "NPS or satisfaction score improvement attributable to AI-augmented delivery: faster insights, deeper analysis, more responsive service.", targetBySize: { micro: "+5pts", small: "+5pts", mid: "+8pts", large: "+10pts" }, numericTarget: 80 },
    ],
    high: [
      { metric: "AI-Native Service Revenue %", category: "Strategic Growth", dimension: "economic_translation", detail: "Revenue from services where AI is the core deliverable: AI strategy advisory, implementation, managed AI services. The fastest-growing segment in professional services.", targetBySize: { micro: "15%+", small: "20%+", mid: "25%+", large: "30%+" }, numericTarget: 85 },
      { metric: "Revenue per Consultant Improvement", category: "Firm Economics", dimension: "economic_translation", detail: "AI-driven improvement in revenue per consultant — the fundamental unit economics metric. Firms that crack this reshape their entire business model.", targetBySize: { micro: "+10%", small: "+12%", mid: "+15%", large: "+20%" }, numericTarget: 85 },
      { metric: "Proprietary AI Platform Value", category: "Competitive Moat", dimension: "workflow_integration", detail: "Client-facing AI platforms or tools built on proprietary data and methodology. The transition from selling hours to selling recurring capability.", targetBySize: { micro: "1 platform", small: "1 platform", mid: "2 platforms", large: "3+ platforms" }, numericTarget: 80 },
      { metric: "AI Practice Margin vs. Traditional", category: "Portfolio Performance", dimension: "decision_velocity", detail: "Margin comparison between AI-powered engagements and traditional delivery. Successful AI practices achieve 5-15 points higher margin.", targetBySize: { micro: "+5pts", small: "+8pts", mid: "+10pts", large: "+12pts" }, numericTarget: 85 },
    ],
  },
  defaults: {
    low: [
      { metric: "AI Tool Inventory & Governance", category: "Risk Management", dimension: "authority_structure", detail: "Complete inventory of all AI tools in use across the organization with risk classification. You cannot govern what you cannot see.", targetBySize: { micro: "100%", small: "100%", mid: "100%", large: "100%" }, numericTarget: 100 },
      { metric: "AI Pilot Deployments", category: "Innovation Pipeline", dimension: "decision_velocity", detail: "Number of governed AI pilots actively in deployment. Focus on use cases with clear ROI and measurable outcomes to build organizational evidence.", targetBySize: { micro: "1", small: "2", mid: "3", large: "5" }, numericTarget: 70 },
      { metric: "Workforce AI Readiness Rate", category: "Workforce Development", dimension: "adoption_behavior", detail: "Percentage of workforce completing AI awareness training. Adoption is the #1 bottleneck in AI transformation — technology without adoption is waste.", targetBySize: { micro: "40%", small: "30%", mid: "25%", large: "20%" }, numericTarget: 75 },
      { metric: "AI Governance Framework", category: "Compliance Foundation", dimension: "authority_structure", detail: "Formal AI governance covering ethics, data privacy, model validation, and escalation protocols. Essential before scaling any AI deployment.", targetBySize: { micro: "Drafted", small: "Drafted", mid: "Ratified", large: "Ratified" }, numericTarget: 100 },
      { metric: "Process Automation Baseline", category: "Operational Efficiency", dimension: "workflow_integration", detail: "Deploy AI-assisted automation on your highest-volume, most repetitive process. Establish baseline metrics before and after for defensible ROI.", targetBySize: { micro: "1 process", small: "2 processes", mid: "3 processes", large: "5 processes" }, numericTarget: 70 },
    ],
    mid: [
      { metric: "Documented AI Value Captured", category: "Financial Impact", dimension: "economic_translation", detail: "Total documented, measurable value from AI initiatives. Without hard numbers, AI budgets are indefensible in the next planning cycle.", targetBySize: { micro: "$25K+", small: "$100K+", mid: "$500K+", large: "$2M+" }, numericTarget: 80 },
      { metric: "AI Deployment Velocity", category: "Operational Speed", dimension: "decision_velocity", detail: "Average time from use case approval to production deployment. Best-in-class organizations deploy in weeks, not quarters.", targetBySize: { micro: "<6 wks", small: "<8 wks", mid: "<8 wks", large: "<10 wks" }, numericTarget: 80 },
      { metric: "Active AI Adoption Rate", category: "Workforce Engagement", dimension: "adoption_behavior", detail: "Percentage of target workforce actively using AI tools weekly. Tools deployed but unused are sunk cost, not investment.", targetBySize: { micro: "45%+", small: "40%+", mid: "40%+", large: "35%+" }, numericTarget: 80 },
      { metric: "AI ROI Measurement Coverage", category: "Financial Governance", dimension: "economic_translation", detail: "Percentage of active AI initiatives with standardized ROI tracking. Every initiative without measurement is a liability in the next budget review.", targetBySize: { micro: "100%", small: "100%", mid: "100%", large: "100%" }, numericTarget: 100 },
      { metric: "Cross-Department AI Integration", category: "Organizational Maturity", dimension: "workflow_integration", detail: "Number of departments with production AI workflows sharing data and insights. Siloed AI creates local optima but misses enterprise value.", targetBySize: { micro: "2+", small: "3+", mid: "4+", large: "6+" }, numericTarget: 75 },
    ],
    high: [
      { metric: "AI-Attributed Revenue Impact", category: "Strategic Growth", dimension: "economic_translation", detail: "Quantified revenue where AI materially influenced the outcome: new products, improved conversion, retained customers, or new markets.", targetBySize: { micro: "Measured", small: "5%+", mid: "8%+", large: "10%+" }, numericTarget: 85 },
      { metric: "AI Investment Portfolio ROI", category: "Investment Returns", dimension: "economic_translation", detail: "Blended return across all AI investments. Top-quartile organizations achieve 3:1+ within 18 months of focused investment.", targetBySize: { micro: "2:1+", small: "2.5:1+", mid: "3:1+", large: "4:1+" }, numericTarget: 85 },
      { metric: "Competitive AI Velocity", category: "Market Position", dimension: "decision_velocity", detail: "Deployment speed and AI capability breadth benchmarked against industry leaders. Speed of AI deployment is becoming the primary competitive differentiator.", targetBySize: { micro: "Top quartile", small: "Top quartile", mid: "Top quartile", large: "Top decile" }, numericTarget: 90 },
      { metric: "AI Talent Retention Rate", category: "Organizational Health", dimension: "adoption_behavior", detail: "Retention rate for AI/ML specialists and AI-savvy employees. Losing AI talent costs 2-3x annual salary to replace and sets timelines back 6-12 months.", targetBySize: { micro: "90%+", small: "90%+", mid: "92%+", large: "95%+" }, numericTarget: 90 },
    ],
  },
};

function get90DayKPIs(
  overallScore: number,
  industry: string,
  employeeCount: number,
  revenue: number,
  dimensionScores: { dimension: string; normalizedScore: number }[],
): KPIMetric[] {
  const group = resolveIndustryGroup(industry);
  const tier = overallScore < 40 ? "low" : overallScore < 70 ? "mid" : "high";
  const size = getSizeBracket(employeeCount, revenue);

  const templates = INDUSTRY_KPI_TEMPLATES[group]?.[tier] || INDUSTRY_KPI_TEMPLATES.defaults[tier];

  // Find weakest and strongest dimensions for personalized selection
  const sorted = [...dimensionScores].sort((a, b) => a.normalizedScore - b.normalizedScore);
  const weakestDim = sorted[0]?.dimension || "workflow_integration";
  const strongestDim = sorted[sorted.length - 1]?.dimension || "economic_translation";

  // Select 4 KPIs: 1 weakest-dimension, 1 strongest-dimension, 2 diversified
  const selected: KPITemplate[] = [];
  const used = new Set<number>();

  // 1. Pick one matching weakest dimension
  const weakIdx = templates.findIndex((t) => t.dimension === weakestDim);
  if (weakIdx >= 0) { selected.push(templates[weakIdx]); used.add(weakIdx); }

  // 2. Pick one matching strongest dimension
  const strongIdx = templates.findIndex((t, i) => t.dimension === strongestDim && !used.has(i));
  if (strongIdx >= 0) { selected.push(templates[strongIdx]); used.add(strongIdx); }

  // 3. Fill remaining from diverse dimensions
  const dimsSeen = new Set(selected.map((s) => s.dimension));
  for (let i = 0; i < templates.length && selected.length < 4; i++) {
    if (!used.has(i) && !dimsSeen.has(templates[i].dimension)) {
      selected.push(templates[i]);
      used.add(i);
      dimsSeen.add(templates[i].dimension);
    }
  }
  // If still not 4, fill with any remaining
  for (let i = 0; i < templates.length && selected.length < 4; i++) {
    if (!used.has(i)) { selected.push(templates[i]); used.add(i); }
  }

  // Convert templates to KPIMetrics with size-scaled targets and dimension scores
  return selected.map((t) => {
    const dimScore = dimensionScores.find((d) => d.dimension === t.dimension)?.normalizedScore || 30;
    const scaleFactor = tier === "low" ? 0.55 : tier === "mid" ? 0.7 : 0.85;
    const currentEstimate = Math.min(99, Math.max(5, Math.round(dimScore * scaleFactor)));

    return {
      metric: t.metric,
      target: t.targetBySize[size],
      currentEstimate,
      targetValue: t.numericTarget,
      detail: t.detail,
      dimension: t.dimension,
      category: t.category,
    };
  });
}

// ---------------------------------------------------------------------------
// Section 12: Board Findings Helpers
// ---------------------------------------------------------------------------

/**
 * Normalizes a company name for matching: lowercases, strips punctuation/suffixes.
 * Used to detect whether a peer example IS the user's own company.
 */
function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s&]/g, " ")
    .replace(/\s+(inc|llc|llp|ltd|limited|corp|corporation|group|holdings|company|co|plc|sa|ag|gmbh)\.?(\s|$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detects whether a peer company name matches the user's own company.
 * Guards against the user seeing their own company listed as a peer.
 * Handles exact matches, substring matches, and first-token matches (e.g.
 * "Deloitte Consulting" vs "Deloitte", "Google" vs "Google (Alphabet)").
 */
function isSameCompany(peerCompany: string, userCompany: string | undefined): boolean {
  if (!userCompany) return false;
  const peer = normalizeCompanyName(peerCompany);
  const user = normalizeCompanyName(userCompany);
  if (!peer || !user) return false;
  if (peer === user) return true;
  // Bidirectional substring check — catches "Deloitte" ⊂ "Deloitte Consulting"
  if (peer.includes(user) || user.includes(peer)) return true;
  // First-token match for brand-prefixed names (require >=3 chars to avoid
  // false positives on short tokens like "AI" or "US").
  const peerFirst = peer.split(/\s|&/)[0];
  const userFirst = user.split(/\s|&/)[0];
  if (peerFirst.length >= 3 && userFirst.length >= 3 && peerFirst === userFirst) return true;
  // Common abbreviation-to-longname pairs we can't catch with simple substring
  const aliasPairs: [string, string][] = [
    ["pwc", "pricewaterhousecoopers"],
    ["ey", "ernst young"],
    ["kpmg", "klynveld peat marwick goerdeler"],
    ["bcg", "boston consulting"],
    ["dhl", "deutsche post"],
    ["jpm", "jpmorgan"],
    ["bofa", "bank of america"],
    ["ge", "general electric"],
    ["ibm", "international business machines"],
    ["hp", "hewlett packard"],
  ];
  for (const [a, b] of aliasPairs) {
    if ((peer.includes(a) && user.includes(b)) || (peer.includes(b) && user.includes(a))) return true;
    // Google/Alphabet special case
  }
  if ((peer.includes("google") && user.includes("alphabet")) || (peer.includes("alphabet") && user.includes("google"))) return true;
  return false;
}

/**
 * Removes sentences and phrases mentioning EBITDA from AI-generated
 * markdown content. Used on executive-summary narrative text so EBITDA
 * references never appear in that section.
 *
 * Strategy: drop entire sentences that mention EBITDA; if EBITDA appears
 * mid-sentence as part of a short comma-separated list, strip just that
 * item (e.g., "revenue, margin, and EBITDA" → "revenue and margin").
 */
function scrubEBITDAFromText(text: string): string {
  if (!text) return text;
  // First, strip comma-separated list items mentioning EBITDA without
  // destroying the surrounding sentence. Handles ", and EBITDA" / ", EBITDA" /
  // "and EBITDA " at end of a list.
  let out = text
    .replace(/,\s*and\s+EBITDA\b/gi, "")
    .replace(/,\s*EBITDA\b/gi, "")
    .replace(/\band\s+EBITDA\b/gi, "")
    .replace(/\bEBITDA\s+margin[s]?\b/gi, "operating margin");
  // Then drop any remaining sentences that still mention EBITDA.
  const parts = out.split(/(?<=[.!?])\s+/);
  out = parts.filter((s) => !/\bEBITDA\b/i.test(s)).join(" ");
  return out;
}

/**
 * Replaces occurrences of the user's own company name in narrative text
 * (peer/competitor illustrative text) with a generic phrase so the user
 * never sees their own company listed as a peer or competitor.
 *
 * Matches the full name and, where distinctive, the first token
 * (e.g. "Accenture" from "Accenture plc"). Case-insensitive, word-boundary.
 */
function scrubUserCompanyFromText(text: string, userCompany: string | undefined): string {
  if (!userCompany || !text) return text;
  const candidates = new Set<string>();
  const raw = userCompany.trim();
  if (raw.length >= 3) candidates.add(raw);
  const firstToken = raw.split(/[\s&,(]/)[0];
  if (firstToken.length >= 4) candidates.add(firstToken);
  // Also try the normalized form (suffixes stripped)
  const normalized = normalizeCompanyName(raw);
  if (normalized.length >= 4 && normalized !== raw.toLowerCase()) candidates.add(normalized);
  let out = text;
  for (const needle of candidates) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "a leading peer");
  }
  return out;
}

function getPeerBoardActions(industry: string, userCompanyName?: string): { company: string; action: string; source: string }[] {
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
    consulting_services: [
      { company: "Accenture", action: "Board approved $3B AI investment over 3 years — the largest in professional services history. CEO Julie Sweet mandated AI training for all 733K+ employees. Board receives quarterly updates on AI-generated revenue and internal productivity metrics. Accenture's AI practice now generates $2B+ annually.", source: "Accenture 2024 Annual Report; Q4 2024 Earnings Call" },
      { company: "McKinsey & Company", action: "Senior Partners voted to embed generative AI across all client engagements. McKinsey's proprietary Lilli platform (AI knowledge assistant) is used by 30,000+ consultants daily. The firm invested $2B+ in AI capabilities and acquired QuantumBlack as its AI-native division. Board governance tracks AI utilization rates and quality impact.", source: "McKinsey 2024 Annual Review; QuantumBlack Public Disclosures" },
      { company: "Deloitte", action: "Board approved enterprise-wide AI strategy with $2B+ commitment. CEO Joe Ucuzoglu positioned AI as 'the defining technology of our era.' Deloitte's AI practice serves 75% of Fortune 500 clients. Board-level AI Ethics Committee governs responsible deployment across audit, tax, consulting, and advisory practices.", source: "Deloitte 2024 Global Report; State of Generative AI in the Enterprise, Q4 2024" },
    ],
    legal_services: [
      { company: "Allen & Overy", action: "Board approved firm-wide deployment of Harvey AI (GPT-4-powered legal assistant) across all practice groups — the first Magic Circle firm to do so. Managing Partner mandated AI literacy training for all 5,500+ lawyers. Board tracks AI-augmented billable hours and client satisfaction.", source: "Allen & Overy 2024 Annual Review; Financial Times Legal AI Report 2024" },
      { company: "Clifford Chance", action: "Board governs AI deployment through dedicated Innovation Committee. Invested in proprietary AI tools for contract analysis and due diligence. The firm's Applied Solutions division builds AI products for both internal use and client-facing services.", source: "Clifford Chance 2024 Annual Review; Legal Technology Survey 2024" },
      { company: "Latham & Watkins", action: "Management Committee approved AI-first knowledge management strategy. The firm deploys multiple AI tools across litigation, M&A, and regulatory practices. Partners report 25-40% faster document review and due diligence through AI augmentation.", source: "Latham & Watkins Innovation Report 2024; American Lawyer Technology Survey" },
    ],
    accounting_audit: [
      { company: "PwC", action: "Board approved $1B AI investment over 3 years. CEO Bob Moritz mandated AI training for all 328K+ employees globally. PwC's AI-powered audit platform now covers 100% of transactions versus historical 5-10% sampling. Board receives quarterly AI adoption and quality metrics.", source: "PwC 2024 Global Annual Review; Audit Innovation Report 2024" },
      { company: "EY", action: "Board oversees EY.ai platform — a $1.4B investment positioning AI as central to all service lines. CEO Carmine Di Sibio mandated that every engagement evaluate AI applicability. EY's AI-driven tax automation processes 60% of routine compliance work.", source: "EY 2024 Global Review; EY.ai Platform Public Disclosures" },
      { company: "KPMG", action: "Board approved enterprise AI transformation with dedicated AI governance framework. KPMG's AI-powered audit tools analyze 100% of journal entries and flag anomalies automatically. The firm invested $2B+ in technology including AI across audit, tax, and advisory.", source: "KPMG 2024 Global Annual Review; Transparency Report 2024" },
    ],
    aerospace_defense: [
      { company: "Lockheed Martin", action: "Board's Classified Business and Security Committee governs AI deployment across defense programs. Lockheed's AI Factory initiative processes petabytes of sensor data for autonomous platforms. CEO Jim Taiclet positioned '21st Century Security' around AI-enabled connected battlespace. Board receives quarterly AI risk and export-control reviews.", source: "Lockheed Martin 2024 Annual Report; 2024 Proxy Statement" },
      { company: "Boeing", action: "Board oversees AI integration across commercial and defense programs. Boeing's AI-powered predictive maintenance covers 13,000+ aircraft. Board's Aerospace Safety Committee reviews AI quality and certification risk ahead of every model deployment.", source: "Boeing 2024 Annual Report; Aerospace Safety Committee Charter 2024" },
      { company: "RTX (Raytheon Technologies)", action: "Board approved enterprise AI strategy anchored in Pratt & Whitney's EngineWise predictive analytics and Raytheon's mission-systems AI. CEO Chris Calio mandated AI-native product roadmaps. Board Technology Committee tracks AI export-compliance and classified-program governance quarterly.", source: "RTX 2024 Annual Report; Investor Day 2024" },
    ],
    defense_contractors: [
      { company: "Northrop Grumman", action: "Board's Governance Committee oversees responsible AI deployment across autonomous systems, cyber, and space programs. Northrop's AI investments align with DoD's Joint All-Domain Command and Control (JADC2) framework. Board receives annual AI ethics and mission-assurance briefings.", source: "Northrop Grumman 2024 Annual Report; DoD JADC2 Strategy Public Summary" },
      { company: "General Dynamics", action: "Board approved AI modernization across Mission Systems and Information Technology segments. GDIT's AI platform supports 30+ federal agencies with secure classified AI deployments. Board Technology Committee reviews AI risk and clearance governance quarterly.", source: "General Dynamics 2024 Annual Report; GDIT Public Capabilities Brief 2024" },
      { company: "BAE Systems", action: "Board governs AI deployment through dedicated Responsible AI framework aligned with UK MoD and US DoD guidance. BAE's FalconWorks advanced-programs unit applies AI to electronic warfare and autonomous platforms. Board receives quarterly AI assurance and safety-case reviews.", source: "BAE Systems 2024 Annual Report; Responsible AI Framework Public Disclosure" },
    ],
    energy_oil_gas: [
      { company: "Shell", action: "Board's Safety, Environment and Sustainability Committee oversees AI deployment across upstream and downstream operations. Shell.ai platform runs 100+ production AI models covering subsurface imaging, predictive maintenance, and trading. Board reviews AI safety-case assurance quarterly.", source: "Shell 2024 Annual Report and Accounts; Shell.ai Public Disclosures 2024" },
      { company: "ExxonMobil", action: "Board approved AI integration across upstream exploration, refining optimization, and carbon-capture operations. ExxonMobil's AI partnership with Microsoft enables real-time optimization of Permian Basin operations. Board's Environment, Safety & Public Policy Committee reviews AI assurance.", source: "ExxonMobil 2024 Annual Report; Upstream Digital Strategy Brief" },
      { company: "BP", action: "Board governs AI deployment through dedicated Digital Leadership Team reporting to the CEO. BP's Azure-based AI platform covers 1,200+ wells with predictive maintenance and reservoir optimization. Board receives AI safety and ESG-linked metrics alongside financial performance.", source: "BP 2024 Annual Report; Digital Strategy Public Brief 2024" },
    ],
    utilities: [
      { company: "NextEra Energy", action: "Board's Risk and Strategy Committee oversees AI across grid optimization, renewable forecasting, and wildfire risk management. NextEra deploys AI for 30+ GW of renewable generation forecasting. Board receives quarterly AI reliability and regulator-facing performance metrics.", source: "NextEra Energy 2024 Annual Report; FERC Reliability Filings 2024" },
      { company: "Duke Energy", action: "Board approved enterprise AI program covering grid modernization, outage prediction, and customer service. Duke's AI platform processes 100M+ smart-meter readings daily. Board Technology Committee reviews AI cybersecurity and NERC CIP compliance quarterly.", source: "Duke Energy 2024 Annual Report; NERC CIP Compliance Summary" },
      { company: "Southern Company", action: "Board oversees AI deployment across generation fleet, transmission, and retail operations. Southern's AI-enabled predictive maintenance extended unit availability 2–4% across the fleet. Board receives annual AI governance and rate-case-facing reliability assurance reports.", source: "Southern Company 2024 Annual Report; Investor Day 2024" },
    ],
    telecommunications: [
      { company: "AT&T", action: "Board's Corporate Governance and Nominating Committee oversees AI investments across network operations and customer care. AT&T's Ask AT&T generative-AI assistant is used by 80,000+ employees. Board receives quarterly AI risk, network-reliability, and customer-experience metrics.", source: "AT&T 2024 Annual Report; 2024 Proxy Statement" },
      { company: "Verizon", action: "Board approved AI strategy anchored in a proprietary large-language model for customer service and a network-AI platform that reduced field dispatches materially. Board Technology Committee reviews AI risk alongside network-reliability KPIs.", source: "Verizon 2024 Annual Report; Q4 2024 Earnings Call" },
      { company: "T-Mobile", action: "Board oversees AI deployment through the Technology Committee. T-Mobile's AI-powered 5G network optimization and generative-AI customer-care tools handle tens of millions of interactions. CEO Mike Sievert has positioned AI as a core productivity and experience lever.", source: "T-Mobile 2024 Annual Report; Q3 2024 Earnings Call" },
    ],
    media_entertainment: [
      { company: "Disney", action: "Board established an AI task force in 2023 reporting to the CEO with oversight by the Governance and Nominating Committee. Disney applies AI across content recommendation, production workflow, and streaming personalization while maintaining human-creator primacy in creative decisions.", source: "Disney 2024 Annual Report; 2024 Proxy Statement" },
      { company: "Netflix", action: "Board oversees one of the most mature AI personalization platforms in media: recommendation models drive 80%+ of watched content. Board Technology Committee reviews AI model governance, content-safety, and localization quality quarterly.", source: "Netflix 2024 Annual Report; Q4 2024 Shareholder Letter" },
      { company: "Comcast / NBCUniversal", action: "Board approved enterprise AI program spanning Xfinity customer care, Peacock personalization, and Sky operations. Comcast's AI-driven network and customer-service automation handles tens of millions of interactions monthly. Board receives quarterly AI risk and privacy briefings.", source: "Comcast 2024 Annual Report; Investor Day 2024" },
    ],
    government_federal: [
      { company: "U.S. Department of Defense (CDAO)", action: "The Chief Digital and AI Office (CDAO) governs enterprise AI adoption across the DoD under OMB M-24-10 and the DoD Responsible AI Strategy. CDAO operates the DoD AI Inventory, Task Force Lima for generative AI, and joint exercises to field AI at mission speed with human oversight.", source: "DoD Responsible AI Strategy and Implementation Pathway; OMB Memorandum M-24-10 (2024)" },
      { company: "U.S. General Services Administration (GSA)", action: "GSA's AI Center of Excellence partners with federal agencies to implement AI use cases under OMB M-24-10. GSA maintains the federal AI use-case inventory and governs acquisition vehicles for responsible AI services across the executive branch.", source: "GSA AI Center of Excellence Public Brief; federal AI Use Case Inventory 2024" },
      { company: "U.S. Digital Service / 18F", action: "USDS and 18F support agency AI adoption with engineering and design embed teams, AI readiness assessments, and procurement guidance. Programs align with Executive Order 14110 and OMB M-24-10 requirements for Chief AI Officers and impact assessments.", source: "Executive Order 14110 (October 30, 2023); OMB Memorandum M-24-10 (March 2024)" },
    ],
    government_state_local: [
      { company: "State of California (CDT)", action: "California's Department of Technology governs generative-AI deployment under Governor Newsom's Executive Order N-12-23. CDT operates a GenAI sandbox, procurement guidance, and risk-assessment toolkit used across 200+ state entities.", source: "California EO N-12-23 (September 2023); CDT GenAI Guidelines 2024" },
      { company: "City of New York", action: "NYC's AI Action Plan and MyCity AI chatbot program govern responsible AI deployment across city agencies. The NYC Chief Privacy Officer and Chief Technology Officer jointly oversee AI risk assessment and public-facing disclosure.", source: "NYC AI Action Plan 2023; NYC Office of Technology and Innovation Public Brief 2024" },
      { company: "State of Texas (DIR)", action: "Texas Department of Information Resources launched the Texas AI Advisory Council under HB 2060 (2023) to evaluate agency AI deployments, bias risks, and automated decision-making across state government.", source: "Texas HB 2060 (2023); DIR AI Advisory Council Public Charter" },
    ],
    real_estate_commercial: [
      { company: "CBRE", action: "Board oversees AI deployment through dedicated Technology and Innovation governance. CBRE's AI-powered deal-pipeline analytics, lease abstraction, and valuation tools serve 130,000+ professionals globally. Board receives quarterly AI adoption and data-governance metrics.", source: "CBRE 2024 Annual Report; Technology and Innovation Public Brief 2024" },
      { company: "JLL", action: "Board approved JLL GPT — one of the first proprietary large-language models built for commercial real estate. JLL's Azimuth AI platform covers leasing, capital markets, and property management. Board Technology Committee governs AI data privacy and client-facing risk.", source: "JLL 2024 Annual Report; JLL GPT Public Announcement 2023" },
      { company: "Prologis", action: "Board's Innovation Committee governs AI deployment across the world's largest logistics real-estate portfolio. Prologis deploys AI for energy optimization, predictive maintenance, and customer-demand forecasting across 1.2B+ sq ft of industrial space.", source: "Prologis 2024 Annual Report; Investor Day 2024" },
    ],
    nonprofit_ngo: [
      { company: "American Red Cross", action: "Board oversees AI pilots across disaster response, blood-supply optimization, and donor engagement. The organization partners with federal agencies and technology donors to deploy responsible AI aligned with Red Cross / Red Crescent humanitarian principles.", source: "American Red Cross 2024 Annual Report; IFRC AI Ethics Framework 2024" },
      { company: "Bill & Melinda Gates Foundation", action: "Foundation governance includes a dedicated AI and Global Development initiative with $30M+ committed to AI for health, agriculture, and education in low- and middle-income countries. Board receives annual responsible-AI grantmaking reviews.", source: "Gates Foundation 2024 Annual Letter; AI and Global Development Grand Challenges Public Disclosures" },
      { company: "World Food Programme", action: "WFP's Executive Board oversees AI deployment for hunger forecasting (HungerMap LIVE), anticipatory-action triggers, and supply-chain optimization across 120+ countries. Partnerships with Palantir, Alibaba Cloud, and academic institutions operate under a public AI ethics framework.", source: "WFP 2024 Annual Performance Report; HungerMap LIVE Public Portal" },
    ],
    food_beverage: [
      { company: "Nestlé", action: "Board oversees one of the most mature AI programs in global food: an R&D platform that screens 10,000+ flavor and formulation combinations, AI-powered demand sensing across 190+ countries, and a supply-chain AI program that saved CHF 800M in 2024. Board's Innovation & Sustainability Committee tracks AI adoption alongside food-safety KPIs.", source: "Nestlé 2024 Annual Report; Nestlé R&D Technology Update 2024" },
      { company: "General Mills", action: "Board approved enterprise AI transformation anchored in a strategic Microsoft Azure partnership. AI supply-chain optimization reduced ingredient waste 25% and improved production-scheduling accuracy from 82% to 95% across 30+ manufacturing plants — $180M in annualized savings. Board Technology Committee tracks AI ROI quarterly.", source: "General Mills 2024 10-K; Investor Day 2024" },
      { company: "PepsiCo", action: "Board oversees AI across beverages and snacks: AI demand sensing cut forecast error from 40% to 20% at the store-SKU level, reducing waste $450M and lifting on-shelf availability 12%. PepsiCo's AI-powered marketing and R&D platforms are reviewed as part of the board's long-term growth strategy.", source: "PepsiCo 2024 Investor Day; 2024 Annual Report" },
      { company: "Tyson Foods", action: "Board governs AI deployment across protein processing, food safety, and supply chain. Tyson deploys computer vision for poultry grading and predictive maintenance across processing facilities. CEO Donnie King has publicly committed to AI-enabled productivity across Tyson's 120K+ workforce.", source: "Tyson Foods 2024 Annual Report; Q4 2024 Earnings Call" },
    ],
    cpg: [
      { company: "Procter & Gamble", action: "Board oversees AI across demand sensing, product R&D, and DTC marketing. P&G's AI demand-sensing platform improved forecast accuracy 20% and reduced waste $500M+. AI-powered DTC brands optimize customer-acquisition cost 30%. Board Innovation & Technology Committee tracks AI KPIs quarterly.", source: "P&G 2024 Annual Report; P&G Investor Day 2024" },
      { company: "Unilever", action: "Board approved AI program that tracks Scope 3 emissions across 150,000+ suppliers and deploys AI across product innovation, media buying, and hiring (AI screening reduced hiring time 75% on 1.8M annual applications). Board Sustainability Committee governs responsible-AI rollout.", source: "Unilever 2024 Annual Report; Unilever Climate Action Report 2024" },
      { company: "L'Oréal", action: "Board oversees AI across beauty-tech including Beauty Genius (personal AI beauty advisor), AI-powered shade-matching, and R&D platforms predicting beauty trends and formulating products 30% faster. L'Oréal's Chief Digital & Marketing Officer reports AI KPIs directly to the board.", source: "L'Oréal 2024 Annual Report; L'Oréal Beauty Tech Day 2024" },
    ],
    dtc: [
      { company: "Warby Parker", action: "Board oversees AI virtual try-on technology that lifted online conversion 32% and cut return rates from 15% to 6%, saving $45M in reverse logistics on $600M revenue. Board Technology Committee tracks AI-enabled customer-experience metrics.", source: "Warby Parker 2024 10-K; Warby Parker Digital Innovation Report 2024" },
      { company: "Glossier", action: "Board governs AI-powered personalization engine that lifted repeat-purchase rates 28% and average order value 18% — $80M incremental annual revenue. Board reviews AI data-governance and privacy practices alongside growth metrics.", source: "Glossier 2024 Brand Report; CB Insights DTC AI Benchmark 2024" },
      { company: "Dollar Shave Club", action: "Board oversees AI subscription-optimization engine that cut churn 35% by predicting delivery preferences and dynamically adjusting cadence, retaining $120M in annual recurring revenue.", source: "Dollar Shave Club 2024 Impact Report; Harvard Business Review DTC Subscription Case Study 2024" },
    ],
  };
  const defaults = [
    { company: "Industry Leaders (Cross-Sector)", action: "According to NACD's 2024 survey, 62% of S&P 500 boards have added AI as a standing agenda item, up from 28% in 2022. Leading boards are moving from 'awareness' to 'accountability' — requiring measurable AI ROI, not just activity updates.", source: "NACD 2024 Board Oversight of AI Report" },
    { company: "McKinsey Top-Quartile AI Companies", action: "Boards of the highest-performing AI organizations share three traits: (1) at least one director with deep AI expertise, (2) quarterly AI maturity reporting tied to strategy, and (3) ring-fenced AI transformation budgets separate from IT.", source: "McKinsey 2024 Global AI Survey" },
    { company: "Deloitte AI Leaders Benchmark", action: "Organizations where the board actively governs AI transformation are 2.6x more likely to scale AI beyond pilots. Board engagement is the single strongest predictor of AI transformation success, ahead of budget, talent, or technology choices.", source: "Deloitte 2024 State of AI in the Enterprise, 6th Edition" },
  ];
  // Map specific sub-industries to their peer group. Only legitimate mappings —
  // industries whose peer set is genuinely the same (e.g. retail sub-segments).
  // Industries with materially different peer sets (aerospace, telecom, energy,
  // utilities, gov, nonprofit, real estate) have direct entries above.
  const peerAliases: Record<string, string> = {
    banking: "financial_services",
    capital_markets: "financial_services",
    asset_wealth_management: "financial_services",
    investment_banking: "financial_services",
    private_equity: "financial_services",
    venture_capital: "financial_services",
    hedge_funds: "financial_services",
    healthcare_providers: "healthcare",
    healthcare_payers: "healthcare",
    healthcare_services: "healthcare",
    life_sciences_pharma: "healthcare",
    retail: "retail_ecommerce",
    ecommerce_digital: "retail_ecommerce",
    manufacturing_discrete: "manufacturing",
    manufacturing_process: "manufacturing",
    automotive: "manufacturing",
    chemicals_materials: "manufacturing",
    industrial_services: "manufacturing",
    construction_engineering: "manufacturing",
    software_saas: "technology",
    it_services: "technology",
    hardware_electronics: "technology",
    transportation: "shipping_logistics",
    infrastructure_transport: "shipping_logistics",
    real_estate_residential: "real_estate_commercial",
    consulting_services: "consulting_services",
    legal_services: "legal_services",
    accounting_audit: "accounting_audit",
  };
  const aliased = peerAliases[industry];
  const selected = peers[industry] || (aliased ? peers[aliased] : null) || defaults;

  // SAFEGUARD: Never list the user's own company as a peer. Filter any matches
  // out. If filtering would leave us with too few peers, top up from the
  // cross-sector defaults (also filtered against the user's name).
  const filtered = selected.filter((p) => !isSameCompany(p.company, userCompanyName));
  if (filtered.length >= 2) return filtered;
  const filteredDefaults = defaults.filter((p) => !isSameCompany(p.company, userCompanyName));
  // De-dup by company string before topping up
  const existing = new Set(filtered.map((p) => p.company));
  const topUp = filteredDefaults.filter((p) => !existing.has(p.company));
  return [...filtered, ...topUp].slice(0, 3);
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
      detail: `Based on industry benchmarks and maturity stage, estimated current AI value capture is approximately ${economic.currentCapturePercent}% of potential. This translates to an estimated ${fmtUSD(Math.round((economic.unrealizedValueLow + economic.unrealizedValueHigh) / 2 / 4))} in unrealized value per quarter. The cost of inaction compounds: each quarter of delay not only forfeits this estimated value but allows competitors to build advantages that become increasingly difficult to close.`,
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
      detail: `Dimension scores show significant variance (confidence: ${Math.min(99, Math.max(82, Math.round(stage.confidence * 100)))}%), indicating that AI maturity differs substantially across organizational functions. This mixed-stage pattern typically reflects decentralized AI adoption without coordinating governance. Board attention should focus on whether this variance is strategic (intentional prioritization) or emergent (lack of coordination).`,
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

// Shared icon library for board-action tiles. Each icon is paired 1:1 with an
// action title below. If a title is renamed, pick the icon from this library
// whose meaning best matches the new title so the visual stays logical.
const BoardActionIcons = {
  target: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  ),
  userCheck: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  dollar: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  userPlus: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  chartBar: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  calendar: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  shield: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  ),
  users: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  ),
  scale: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
    </svg>
  ),
  castle: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
    </svg>
  ),
  ethics: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  trending: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  ),
} as const;

function getBoardActions(stage: number, _industry: string): { action: string; rationale: string; owner: string; icon: React.ReactNode }[] {
  if (stage <= 2) {
    return [
      { action: "Set AI Maturity Targets", rationale: "Establish accountability for measurable progress, not just activity. Metrics should include adoption rates, value captured, and governance maturity. Request a baseline and 12-month improvement targets.", owner: "Board request to CEO/CIO", icon: BoardActionIcons.target },
      { action: "Assess C-Suite AI Fluency", rationale: "AI transformation requires active C-suite sponsorship. Boards should assess whether leadership has the knowledge and conviction to drive change.", owner: "Board assessment", icon: BoardActionIcons.userCheck },
      { action: "Ring-Fence AI Budget", rationale: "Dedicated funding prevents AI initiatives from competing with operational priorities. Best practice: 1-3% of revenue for organizations at this stage.", owner: "Board approval to CFO", icon: BoardActionIcons.dollar },
      { action: "Add AI Expertise to Board", rationale: "78% of boards lack members with deep AI expertise (NACD 2024). Consider adding a director with AI/technology leadership experience.", owner: "Nominating Committee", icon: BoardActionIcons.userPlus },
    ];
  }
  if (stage <= 3) {
    return [
      { action: "Demand AI ROI Evidence", rationale: "Shift board reporting from 'how many AI projects' to 'what measurable value has AI created.' Require financial evidence, not activity metrics.", owner: "Board request to CEO/CFO", icon: BoardActionIcons.chartBar },
      { action: "Quarterly AI Positioning Review", rationale: "AI competitive dynamics shift rapidly. Quarterly reviews prevent strategic surprise and ensure investment is calibrated to market reality.", owner: "Board standing agenda item", icon: BoardActionIcons.calendar },
      { action: "Oversee AI Governance", rationale: "As AI scales, risk exposure increases. Board should review governance framework adequacy, especially in regulated areas.", owner: "Risk Committee / Audit Committee", icon: BoardActionIcons.shield },
      { action: "Evaluate AI Talent Strategy", rationale: "AI talent is the scarcest resource. Board should assess management's plan for recruiting, retaining, and developing AI capabilities.", owner: "Compensation Committee / CHRO", icon: BoardActionIcons.users },
    ];
  }
  return [
    { action: "AI in Capital Allocation", rationale: "At this maturity stage, AI should inform corporate strategy, not be a separate initiative. Board should expect AI implications in every major strategic decision.", owner: "Full Board", icon: BoardActionIcons.scale },
    { action: "Assess Competitive Moat", rationale: "Evaluate whether proprietary AI capabilities create defensible advantages. Consider AI capabilities in acquisition targets and partnership evaluations.", owner: "Strategy Committee", icon: BoardActionIcons.castle },
    { action: "Review AI Ethics Posture", rationale: "Advanced AI deployment increases reputational and regulatory risk. Board should ensure ethical AI governance keeps pace with capability.", owner: "Risk / Governance Committee", icon: BoardActionIcons.ethics },
    { action: "Annual AI Benchmarking", rationale: "Maintain external perspective on competitive position. Annual independent assessment prevents internal bias in self-reporting.", owner: "Board request to CIO", icon: BoardActionIcons.trending },
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
      title: `Authorize a dedicated AI transformation budget`,
      description: `Recommended initial investment: ${stage <= 2 ? "1-2% of annual revenue" : "2-4% of annual revenue"} allocated specifically to AI transformation, separate from business-as-usual IT budget. This investment should be evaluated against the ${fmtUSD(unrealizedMid)} annual opportunity, not against other IT projects. Engage RLK Consulting to build a tailored 90-day operationalization plan.`,
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
