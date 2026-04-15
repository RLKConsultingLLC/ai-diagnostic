"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  Industry,
  CompanyProfile,
  DiagnosticQuestion,
  AssessmentResponse,
  Dimension,
} from "@/types/diagnostic";
import IndustrySelector from "./components/IndustrySelector";
import { validateCompanyProfile } from "@/lib/validation/intake";

// ---------------------------------------------------------------------------
// Static Data
// ---------------------------------------------------------------------------

// INDUSTRY_GROUPS removed — replaced by MCC_INDUSTRY_TREE via IndustrySelector

const AI_USE_CASES = [
  "Customer Service / Chatbots",
  "Data Analytics / BI",
  "Process Automation / RPA",
  "Document Processing",
  "Predictive Modeling",
  "Content Generation",
  "Code Development",
  "Risk Assessment",
  "Supply Chain Optimization",
  "HR / Talent Management",
];

const REGULATORY_OPTIONS: {
  value: CompanyProfile["regulatoryIntensity"];
  label: string;
}[] = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
  { value: "very_high", label: "Very High" },
];

const DIMENSION_ORDER: Dimension[] = [
  "adoption_behavior",
  "authority_structure",
  "workflow_integration",
  "decision_velocity",
  "economic_translation",
];

const DIMENSION_META: Record<
  Dimension,
  { label: string; description: string }
> = {
  adoption_behavior: {
    label: "Adoption Behavior",
    description:
      "How AI tools are discovered, adopted, and used across your organization.",
  },
  authority_structure: {
    label: "Authority Structure",
    description:
      "Governance models, decision rights, and policy frameworks for AI.",
  },
  workflow_integration: {
    label: "Workflow Integration",
    description:
      "How deeply AI is embedded into core business processes and systems.",
  },
  decision_velocity: {
    label: "Decision Velocity",
    description:
      "Speed and effectiveness of translating AI insights into action.",
  },
  economic_translation: {
    label: "Economic Translation",
    description:
      "Ability to measure, quantify, and capture financial value from AI.",
  },
};

// Research status messages to cycle through
const RESEARCH_STATUS_MESSAGES = [
  "Background research in progress...",
  "Analyzing SEC filings...",
  "Gathering industry intelligence...",
  "Benchmarking against peers...",
  "Compiling market data...",
  "Reviewing regulatory landscape...",
  "Mapping competitive positioning...",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Step = "intake" | "questions" | "dimension_transition" | "review";

interface DimensionGroup {
  dimension: Dimension;
  questions: DiagnosticQuestion[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AssessmentPage() {
  const router = useRouter();

  // -- Navigation state
  const [step, setStep] = useState<Step>("intake");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -- Questions from API
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [dimensionGroups, setDimensionGroups] = useState<DimensionGroup[]>([]);

  // -- Dimension-based navigation
  const [currentDimIndex, setCurrentDimIndex] = useState(0);
  const [currentQInDim, setCurrentQInDim] = useState(0);
  const [completedDimensions, setCompletedDimensions] = useState<Dimension[]>(
    []
  );

  // -- Dimension transition screen state
  const [dimensionInsight, setDimensionInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightLayer, setInsightLayer] = useState(0);
  const [researchEnriched, setResearchEnriched] = useState(false);
  const [reportPreview, setReportPreview] = useState<{
    unlockedSections: string[];
    nextUnlock: string | null;
    valueTeaser: string;
  } | null>(null);
  const [dimensionScoreDisplay, setDimensionScoreDisplay] = useState<number | null>(null);

  // -- Research status polling
  const [researchStatus, setResearchStatus] = useState<string>(
    RESEARCH_STATUS_MESSAGES[0]
  );
  const [researchComplete, setResearchComplete] = useState(false);

  // -- Intake form
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState<Industry | "">("");
  const [industryDisplayLabel, setIndustryDisplayLabel] = useState("");
  const [revenue, setRevenue] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [publicOrPrivate, setPublicOrPrivate] = useState<
    "public" | "private" | ""
  >("");
  const [regulatoryIntensity, setRegulatoryIntensity] = useState<
    CompanyProfile["regulatoryIntensity"] | ""
  >("");
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [ticker, setTicker] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [executiveName, setExecutiveName] = useState("");
  const [executiveEmail, setExecutiveEmail] = useState("");

  // -- Question responses keyed by question id
  const [responses, setResponses] = useState<
    Record<string, { optionIndex: number; score: number; durationMs?: number }>
  >({});

  // -- Track when each question was first displayed for timing
  const questionStartRef = useRef<number>(Date.now());

  // -- Insight cache: dimension -> insight text
  const [insightCache, setInsightCache] = useState<
    Record<string, string>
  >({});

  // ---------- Derived ----------

  const currentGroup: DimensionGroup | undefined =
    dimensionGroups[currentDimIndex];
  const currentQuestion: DiagnosticQuestion | undefined =
    currentGroup?.questions[currentQInDim];

  const totalQuestions = questions.length;
  const answeredCount = Object.keys(responses).length;

  // Overall progress percent
  const progressPercent =
    step === "intake"
      ? 0
      : step === "review"
      ? 100
      : totalQuestions > 0
      ? Math.round((answeredCount / totalQuestions) * 100)
      : 0;

  const allQuestionsAnswered =
    totalQuestions > 0 && answeredCount === totalQuestions;

  // ---------- Group questions by dimension ----------

  const groupQuestionsByDimension = useCallback(
    (qs: DiagnosticQuestion[]): DimensionGroup[] => {
      const groups: DimensionGroup[] = [];
      for (const dim of DIMENSION_ORDER) {
        const dimQuestions = qs.filter((q) => q.dimension === dim);
        if (dimQuestions.length > 0) {
          groups.push({ dimension: dim, questions: dimQuestions });
        }
      }
      return groups;
    },
    []
  );

  // ---------- Research status polling ----------

  useEffect(() => {
    if (!sessionId || step === "intake" || researchComplete) return;

    let statusIndex = 0;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/research/status?sessionId=${sessionId}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.status === "complete" || data.complete) {
            setResearchComplete(true);
            setResearchStatus("Research complete");
            return;
          }
          if (data.message) {
            setResearchStatus(data.message);
            return;
          }
        }
      } catch {
        // Silently continue on poll failure
      }
      // Cycle through status messages as fallback
      statusIndex = (statusIndex + 1) % RESEARCH_STATUS_MESSAGES.length;
      setResearchStatus(RESEARCH_STATUS_MESSAGES[statusIndex]);
    };

    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [sessionId, step, researchComplete]);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Reset question timer when current question changes
  useEffect(() => {
    questionStartRef.current = Date.now();
  }, [currentDimIndex, currentQInDim]);

  // ---------- Handlers ----------

  const toggleUseCase = useCallback((uc: string) => {
    setSelectedUseCases((prev) =>
      prev.includes(uc) ? prev.filter((x) => x !== uc) : [...prev, uc]
    );
  }, []);

  const selectOption = useCallback(
    (optionIndex: number) => {
      if (!currentQuestion) return;
      const durationMs = Date.now() - questionStartRef.current;
      setResponses((prev) => ({
        ...prev,
        [currentQuestion.id]: {
          optionIndex,
          score: currentQuestion.options[optionIndex].score,
          durationMs,
        },
      }));
      // Reset timer for the next question
      questionStartRef.current = Date.now();
    },
    [currentQuestion]
  );

  const intakeValid =
    companyName.trim() !== "" &&
    industry !== "" &&
    revenue !== "" &&
    employeeCount !== "" &&
    publicOrPrivate !== "" &&
    regulatoryIntensity !== "" &&
    selectedUseCases.length > 0 &&
    Object.keys(validationErrors).length === 0;

  // Fetch dimension insight from API (escalating with each dimension)
  const fetchDimensionInsight = useCallback(
    async (dimension: Dimension) => {
      // Return cached insight if available
      if (insightCache[dimension]) {
        setDimensionInsight(insightCache[dimension]);
        return;
      }

      setInsightLoading(true);
      setDimensionInsight(null);
      setReportPreview(null);
      setDimensionScoreDisplay(null);

      try {
        const dimQuestions = questions.filter(
          (q) => q.dimension === dimension
        );
        const dimResponses = dimQuestions
          .filter((q) => responses[q.id])
          .map((q) => ({
            questionId: q.id,
            score: responses[q.id].score,
          }));

        // Build completed dimensions context for cumulative analysis
        const completedDims = completedDimensions
          .filter((d) => d !== dimension)
          .map((d) => {
            const dQuestions = questions.filter((q) => q.dimension === d);
            const dResponses = dQuestions.filter((q) => responses[q.id]);
            const avg =
              dResponses.length > 0
                ? dResponses.reduce((s, q) => s + responses[q.id].score, 0) /
                  dResponses.length
                : 0;
            return { dimension: d, responses: [], averageScore: avg };
          });

        const res = await fetch("/api/assessment/insight", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dimension,
            responses: dimResponses,
            companyName,
            industry,
            employeeCount: employeeCount ? parseInt(employeeCount, 10) : undefined,
            revenue: revenue ? parseFloat(revenue) : undefined,
            sessionId,
            completedDimensions: completedDims,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.insight || data.text || data.message;
          if (text) {
            setDimensionInsight(text);
            setInsightCache((prev) => ({ ...prev, [dimension]: text }));
          }
          if (data.layer) setInsightLayer(data.layer);
          if (data.dimensionScore) setDimensionScoreDisplay(data.dimensionScore);
          if (data.reportPreview) setReportPreview(data.reportPreview);
          if (data.researchEnriched) setResearchEnriched(true);
        }

        if (!dimensionInsight) {
          setDimensionInsight(
            "Your responses are being analyzed. Detailed insights will appear in your final report."
          );
        }
      } catch {
        setDimensionInsight(
          "Your responses are being analyzed. Detailed insights will appear in your final report."
        );
      } finally {
        setInsightLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [questions, responses, insightCache, completedDimensions, companyName, industry, employeeCount, revenue, sessionId]
  );

  // Submit intake to create a session and get questions
  const handleIntakeSubmit = async () => {
    const profile: CompanyProfile = {
      companyName: companyName.trim(),
      industry: industry as Industry,
      industryDisplayLabel: industryDisplayLabel || undefined,
      revenue: parseFloat(revenue),
      employeeCount: parseInt(employeeCount, 10),
      publicOrPrivate: publicOrPrivate as "public" | "private",
      regulatoryIntensity:
        regulatoryIntensity as CompanyProfile["regulatoryIntensity"],
      primaryAIUseCases: selectedUseCases,
      executiveName: executiveName.trim() || undefined,
      executiveEmail: executiveEmail.trim() || undefined,
      ticker: ticker.trim() || undefined,
      websiteUrl: websiteUrl.trim() || undefined,
    };

    const validation = validateCompanyProfile(profile);
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }
    setValidationErrors({});
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/assessment/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!res.ok) throw new Error("Failed to start assessment session.");

      const data = await res.json();
      const sid = data.session?.id ?? data.sessionId ?? data.id;
      setSessionId(sid);

      // Use questions from the response, or fall back to fetching them
      let fetchedQuestions: DiagnosticQuestion[] = data.questions || [];

      if (fetchedQuestions.length === 0) {
        try {
          const qRes = await fetch(`/api/assessment/questions?industry=${encodeURIComponent(industry)}`);
          if (qRes.ok) {
            const qData = await qRes.json();
            fetchedQuestions = qData.questions || qData || [];
          }
        } catch {
          // If fallback also fails, we cannot proceed
        }
      }

      if (fetchedQuestions.length === 0) {
        throw new Error(
          "No assessment questions available. Please try again."
        );
      }

      setQuestions(fetchedQuestions);
      const groups = groupQuestionsByDimension(fetchedQuestions);
      setDimensionGroups(groups);
      setCurrentDimIndex(0);
      setCurrentQInDim(0);
      setStep("questions");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Handle moving to next question / dimension transition
  const handleNext = useCallback(() => {
    if (!currentGroup) return;

    const isLastInDimension =
      currentQInDim >= currentGroup.questions.length - 1;

    if (isLastInDimension) {
      // Mark dimension complete
      setCompletedDimensions((prev) => {
        if (prev.includes(currentGroup.dimension)) return prev;
        return [...prev, currentGroup.dimension];
      });

      // Always show transition screen (including after the final dimension)
      setStep("dimension_transition");
      fetchDimensionInsight(currentGroup.dimension);

      // The continue button in the transition screen handles routing
      // to either the next dimension or the review screen
    } else {
      // Next question within same dimension
      setCurrentQInDim((q) => q + 1);
    }
  }, [
    currentGroup,
    currentQInDim,
    fetchDimensionInsight,
  ]);

  // Handle moving to previous question
  const handlePrev = useCallback(() => {
    if (currentQInDim > 0) {
      setCurrentQInDim((q) => q - 1);
    } else if (currentDimIndex > 0) {
      // Go back to last question of previous dimension
      const prevGroup = dimensionGroups[currentDimIndex - 1];
      setCurrentDimIndex((d) => d - 1);
      setCurrentQInDim(prevGroup.questions.length - 1);
    } else {
      // First question of first dimension -- go back to intake
      setStep("intake");
    }
  }, [currentQInDim, currentDimIndex, dimensionGroups]);

  // Continue from dimension transition to next dimension (or review if last)
  const handleContinueFromTransition = useCallback(() => {
    const isLastDimension = currentDimIndex >= dimensionGroups.length - 1;
    setDimensionInsight(null);
    setReportPreview(null);
    setDimensionScoreDisplay(null);

    if (isLastDimension) {
      setStep("review");
    } else {
      setCurrentDimIndex((d) => d + 1);
      setCurrentQInDim(0);
      setStep("questions");
    }
  }, [currentDimIndex, dimensionGroups.length]);

  // Final submit
  const handleFinalSubmit = async () => {
    if (!allQuestionsAnswered) return;
    setSubmitting(true);
    setError(null);

    const assessmentResponses: AssessmentResponse[] = questions.map((q) => ({
      questionId: q.id,
      selectedOptionIndex: responses[q.id].optionIndex,
      score: responses[q.id].score,
      durationMs: responses[q.id].durationMs,
    }));

    try {
      const res = await fetch("/api/assessment/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          responses: assessmentResponses,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit assessment.");

      const data = await res.json();
      const sid = data.sessionId ?? sessionId;
      router.push(`/report?sessionId=${sid}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
      setSubmitting(false);
    }
  };

  // Navigate to a specific question from the review screen
  const navigateToQuestion = useCallback(
    (questionId: string) => {
      for (let di = 0; di < dimensionGroups.length; di++) {
        const qi = dimensionGroups[di].questions.findIndex(
          (q) => q.id === questionId
        );
        if (qi !== -1) {
          setCurrentDimIndex(di);
          setCurrentQInDim(qi);
          setStep("questions");
          return;
        }
      }
    },
    [dimensionGroups]
  );

  // ---------- Progress helpers ----------

  // Compute which question number we are on overall (1-indexed)
  const overallQuestionIndex = (() => {
    let count = 0;
    for (let i = 0; i < currentDimIndex; i++) {
      count += dimensionGroups[i]?.questions.length ?? 0;
    }
    count += currentQInDim + 1;
    return count;
  })();

  // ---------- Header label ----------

  const headerLabel =
    step === "intake"
      ? "Company Profile"
      : step === "questions" && currentGroup
      ? `Question ${overallQuestionIndex} of ${totalQuestions}`
      : step === "dimension_transition"
      ? "Dimension Complete"
      : "Review & Submit";

  // ---------- Render: Shell ----------

  return (
    <div className="min-h-screen bg-offwhite">
      <div className="rlk-gradient-bar" />

      {/* Sticky Header */}
      <header className="bg-white border-b border-light sticky top-0 z-30">
        <div className="mx-auto max-w-4xl px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-navy text-sm font-bold tracking-[0.3em] uppercase"
          >
            RLK AI Diagnostic
          </Link>
          <div className="text-xs text-tertiary">{headerLabel}</div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-light">
          <div
            className="h-full bg-navy transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Building Your AI Profile sidebar / top card (visible during questions) */}
      {(step === "questions" || step === "dimension_transition") &&
        dimensionGroups.length > 0 && (
          <div className="mx-auto max-w-3xl px-6 pt-6">
            <div className="bg-white border border-light p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-navy tracking-wide uppercase">
                  Building Your AI Profile
                </h3>
                <span className="text-xs text-tertiary">
                  {answeredCount} of {totalQuestions} questions
                </span>
              </div>

              {/* Dimension progress indicators */}
              <div className="space-y-2">
                {dimensionGroups.map((group, idx) => {
                  const isCompleted = completedDimensions.includes(
                    group.dimension
                  );
                  const isCurrent = idx === currentDimIndex;
                  const dimAnswered = group.questions.filter(
                    (q) => responses[q.id]
                  ).length;
                  const dimTotal = group.questions.length;

                  return (
                    <div key={group.dimension} className="flex items-center gap-3">
                      {/* Status icon */}
                      <div
                        className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                          isCompleted
                            ? "bg-navy"
                            : isCurrent
                            ? "border-2 border-navy"
                            : "border-2 border-light"
                        }`}
                      >
                        {isCompleted && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                        {isCurrent && !isCompleted && (
                          <span className="w-2 h-2 rounded-full bg-navy" />
                        )}
                      </div>

                      {/* Label and mini bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-medium truncate ${
                              isCompleted
                                ? "text-navy"
                                : isCurrent
                                ? "text-secondary"
                                : "text-accent"
                            }`}
                          >
                            {DIMENSION_META[group.dimension].label}
                          </span>
                          <span className="text-xs text-tertiary ml-2 shrink-0">
                            {dimAnswered}/{dimTotal}
                          </span>
                        </div>
                        <div className="h-1 bg-light mt-1 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-navy rounded-full transition-all duration-300"
                            style={{
                              width: `${
                                dimTotal > 0
                                  ? Math.round(
                                      (dimAnswered / dimTotal) * 100
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Research status indicator */}
              {sessionId && !researchComplete && (
                <div className="mt-4 pt-3 border-t border-light flex items-center gap-2">
                  <div className="research-pulse shrink-0 w-2 h-2 rounded-full bg-navy" />
                  <span className="text-xs text-tertiary research-status-text">
                    {researchStatus}
                  </span>
                </div>
              )}
              {sessionId && researchComplete && (
                <div className="mt-4 pt-3 border-t border-light flex items-center gap-2">
                  <svg
                    className="w-3.5 h-3.5 text-navy shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-xs text-navy font-medium">
                    Research complete
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

      <main className="mx-auto max-w-3xl px-6 py-10 md:py-14">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 text-sm px-5 py-3">
            {error}
          </div>
        )}

        {/* ---------- INTAKE FORM ---------- */}
        {step === "intake" && (
          <div>
            <div className="text-center mb-10">
              <p className="text-xs font-semibold text-tertiary tracking-[0.3em] uppercase mb-3">
                Step 1
              </p>
              <h1 className="text-2xl md:text-3xl font-bold text-navy mb-3">Company Profile</h1>
              <div className="mx-auto w-12 h-px bg-navy/15 mb-4" />
              <p className="text-foreground/60 text-sm max-w-lg mx-auto">
                We use this information to customize the diagnostic scoring and
                generate industry-relevant benchmarks.
              </p>
            </div>

            <div className="space-y-8">
              {/* Company Name */}
              <Field label="Company Name" required>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="form-input"
                  placeholder="Acme Corporation"
                />
              </Field>

              {/* Stock Ticker + Website URL */}
              <div className="grid md:grid-cols-2 gap-6">
                <Field label="Stock Ticker" optional>
                  <input
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    className="form-input"
                    placeholder="e.g. AAPL"
                  />
                  <p className="text-xs text-tertiary mt-1.5">
                    Public companies only. Enables SEC filing analysis.
                  </p>
                </Field>
                <Field label="Company Website" optional>
                  <input
                    type="url"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="form-input"
                    placeholder="e.g. https://acme.com"
                  />
                  <p className="text-xs text-tertiary mt-1.5">
                    Helps us identify the right company for research.
                  </p>
                </Field>
              </div>

              {/* Industry */}
              <Field label="Industry" required>
                <IndustrySelector
                  value={
                    industry
                      ? { slug: industry as Industry, displayLabel: industryDisplayLabel }
                      : null
                  }
                  onChange={(sel) => {
                    setIndustry(sel.slug);
                    setIndustryDisplayLabel(sel.displayLabel);
                  }}
                />
              </Field>

              {/* Revenue + Employees -- two columns */}
              <div className="grid md:grid-cols-2 gap-6">
                <Field label="Annual Revenue (USD)" required error={validationErrors.revenue}>
                  <input
                    type="number"
                    value={revenue}
                    onChange={(e) => { setRevenue(e.target.value); setValidationErrors(({ revenue: _r, ...rest }) => rest); }}
                    className="form-input"
                    placeholder="e.g. 500000000"
                    min={0}
                  />
                </Field>
                <Field label="Employee Count" required error={validationErrors.employeeCount}>
                  <input
                    type="number"
                    value={employeeCount}
                    onChange={(e) => { setEmployeeCount(e.target.value); setValidationErrors(({ employeeCount: _ec, ...rest }) => rest); }}
                    className="form-input"
                    placeholder="e.g. 5000"
                    min={1}
                  />
                </Field>
              </div>

              {/* Public / Private */}
              <Field label="Organization Type" required>
                <div className="flex gap-6">
                  {(["public", "private"] as const).map((val) => (
                    <label
                      key={val}
                      className="flex items-center gap-2.5 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="publicOrPrivate"
                        value={val}
                        checked={publicOrPrivate === val}
                        onChange={() => setPublicOrPrivate(val)}
                        className="accent-[var(--rlk-navy)] w-4 h-4"
                      />
                      <span className="text-sm capitalize">{val}</span>
                    </label>
                  ))}
                </div>
              </Field>

              {/* Regulatory Intensity */}
              <Field label="Regulatory Intensity" required>
                <select
                  value={regulatoryIntensity}
                  onChange={(e) =>
                    setRegulatoryIntensity(
                      e.target.value as CompanyProfile["regulatoryIntensity"]
                    )
                  }
                  className="form-input"
                >
                  <option value="">Select level...</option>
                  {REGULATORY_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>

              {/* AI Use Cases */}
              <Field label="Primary AI Use Cases" required>
                <p className="text-xs text-tertiary mb-3">
                  Select all that apply to your organization.
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {AI_USE_CASES.map((uc) => (
                    <label
                      key={uc}
                      className={`flex items-center gap-2.5 px-4 py-2.5 border cursor-pointer transition-colors text-sm ${
                        selectedUseCases.includes(uc)
                          ? "border-navy bg-navy/5 text-navy"
                          : "border-light bg-white text-foreground/70 hover:border-accent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUseCases.includes(uc)}
                        onChange={() => toggleUseCase(uc)}
                        className="accent-[var(--rlk-navy)] w-4 h-4"
                      />
                      {uc}
                    </label>
                  ))}
                </div>
              </Field>

              {/* Executive Name */}
              <Field label="Your Name" optional>
                <input
                  type="text"
                  value={executiveName}
                  onChange={(e) => setExecutiveName(e.target.value)}
                  className="form-input"
                  placeholder="Jane Smith"
                />
              </Field>

              {/* Email */}
              <Field label="Email Address" optional error={validationErrors.executiveEmail}>
                <input
                  type="email"
                  value={executiveEmail}
                  onChange={(e) => setExecutiveEmail(e.target.value)}
                  className="form-input"
                  placeholder="jane@company.com"
                />
                <p className="text-xs text-tertiary mt-1.5">
                  Your completed diagnostic report will be delivered here.
                </p>
              </Field>
            </div>

            {/* Submit */}
            <div className="mt-12 flex justify-end">
              <button
                onClick={handleIntakeSubmit}
                disabled={!intakeValid || submitting}
                className="bg-navy text-white px-8 py-3.5 text-sm font-semibold hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? "Starting..." : "Continue to Assessment"}
                {!submitting && (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ---------- QUESTION VIEW ---------- */}
        {step === "questions" && currentGroup && currentQuestion && (
          <div>
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-3">
                <DimensionBadge dimension={currentGroup.dimension} />
                <span className="text-xs text-tertiary">
                  {currentQInDim + 1} of {currentGroup.questions.length}
                </span>
              </div>
              <p className="text-xs font-semibold text-tertiary tracking-[0.3em] uppercase mb-4">
                Question {overallQuestionIndex} of {totalQuestions}
              </p>
              <h1 className="text-xl md:text-2xl font-bold text-navy leading-snug max-w-2xl mx-auto">
                {currentQuestion.text}
              </h1>
              {currentQuestion.subtext && (
                <p className="text-sm text-foreground/50 mt-2 max-w-xl mx-auto">
                  {currentQuestion.subtext}
                </p>
              )}
            </div>

            <div className="space-y-3">
              {currentQuestion.options.map((opt, oi) => {
                const isSelected =
                  responses[currentQuestion.id]?.optionIndex === oi;
                return (
                  <button
                    key={oi}
                    onClick={() => selectOption(oi)}
                    className={`question-option w-full text-left px-5 py-4 border transition-all text-sm leading-relaxed ${
                      isSelected
                        ? "border-navy bg-navy/5 text-navy font-medium"
                        : "border-light bg-white text-foreground/80 hover:border-accent hover:bg-white/80"
                    }`}
                  >
                    <span className="inline-flex items-center gap-3">
                      <span
                        className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected ? "border-navy" : "border-accent"
                        }`}
                      >
                        {isSelected && (
                          <span className="w-2.5 h-2.5 rounded-full bg-navy" />
                        )}
                      </span>
                      {opt.text}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="mt-10 flex justify-between items-center">
              <button
                onClick={handlePrev}
                className="text-sm text-secondary hover:text-navy transition-colors flex items-center gap-1.5"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 16l-4-4m0 0l4-4m-4 4h18"
                  />
                </svg>
                Previous
              </button>

              <button
                onClick={handleNext}
                disabled={!responses[currentQuestion.id]}
                className="bg-navy text-white px-6 py-3 text-sm font-semibold hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {currentQInDim >= currentGroup.questions.length - 1 &&
                currentDimIndex >= dimensionGroups.length - 1
                  ? "Review Answers"
                  : "Next"}
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ---------- DIMENSION TRANSITION SCREEN ---------- */}
        {step === "dimension_transition" && currentGroup && (
          <div className="dimension-transition">
            {/* Diagonal stripe divider */}
            <div className="rlk-diagonal-divider mb-8 -mx-6" />

            {/* Centered completion header */}
            <div className="text-center mb-8">
              <p className="text-xs font-semibold text-tertiary tracking-[0.3em] uppercase mb-3">
                Dimension {currentDimIndex + 1} of {dimensionGroups.length} complete
              </p>
              <div className="inline-flex items-center gap-2 bg-navy/5 border border-navy/20 px-5 py-2.5 mb-4">
                <svg className="w-4 h-4 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm font-semibold text-navy">
                  {DIMENSION_META[currentGroup.dimension].label}
                </span>
              </div>
              {dimensionScoreDisplay !== null && (
                <div className="mt-2">
                  <div className="text-3xl font-bold text-navy">
                    {((dimensionScoreDisplay / 5) * 100).toFixed(0)}
                    <span className="text-sm text-tertiary font-normal ml-0.5">/100</span>
                  </div>
                  <div className="text-xs text-tertiary mt-1">Dimension Score</div>
                </div>
              )}
              <div className="mx-auto w-12 h-px bg-navy/15 mt-5" />
            </div>

            {/* AI Insight Card (the main event) */}
            <div className="insight-card bg-white border border-light text-left p-6 mb-6 border-l-4 border-l-navy">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="text-xs font-semibold text-navy uppercase tracking-wider">
                    {insightLayer <= 1 ? "Structural Insight" :
                     insightLayer === 2 ? "Cross-Dimensional Pattern" :
                     insightLayer === 3 ? "Emerging Diagnosis" :
                     insightLayer === 4 ? "Preliminary Findings" :
                     "Complete Structural Analysis"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {researchEnriched && !insightLoading && (
                    <span className="text-xs text-white bg-secondary px-2 py-0.5 tracking-wide uppercase font-semibold">
                      Enriched with public intelligence
                    </span>
                  )}
                  {insightLayer > 1 && (
                    <span className="text-xs text-accent">
                      Layer {insightLayer}/5
                    </span>
                  )}
                </div>
              </div>
              {insightLoading ? (
                <div className="space-y-3 py-2">
                  <div className="flex items-center gap-3">
                    <Spinner />
                    <span className="text-sm text-secondary font-medium">
                      {insightLayer <= 1 ? "Analyzing behavioral patterns..." :
                       insightLayer === 2 ? "Identifying cross-dimensional dynamics..." :
                       insightLayer === 3 ? "Building structural diagnosis..." :
                       insightLayer === 4 ? "Synthesizing competitive position..." :
                       "Completing full organizational analysis..."}
                    </span>
                  </div>
                  <div className="h-1 bg-light rounded-full overflow-hidden">
                    <div className="h-full bg-navy/30 rounded-full animate-pulse" style={{ width: "60%" }} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground/80 leading-relaxed insight-text">
                  {dimensionInsight}
                </p>
              )}
            </div>

            {/* Report Preview: Progressive Unlock */}
            {reportPreview && !insightLoading && (
              <div className="insight-card bg-offwhite border border-light p-6 mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                  <span className="text-xs font-semibold text-secondary uppercase tracking-wider">
                    Your Report is Building
                  </span>
                </div>

                <p className="text-xs text-foreground/60 mb-4">
                  {reportPreview.valueTeaser}
                </p>

                {/* Section unlock list */}
                <div className="space-y-2">
                  {reportPreview.unlockedSections.map((section, idx) => (
                    <div key={section} className="flex items-center gap-2.5 report-section-unlock" style={{ animationDelay: `${idx * 0.1}s` }}>
                      <div className="w-4 h-4 rounded-full bg-navy flex items-center justify-center shrink-0">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-xs font-medium text-navy">{section}</span>
                    </div>
                  ))}
                  {reportPreview.nextUnlock && (
                    <div className="flex items-center gap-2.5 opacity-40">
                      <div className="w-4 h-4 rounded-full border border-accent shrink-0" />
                      <span className="text-xs text-tertiary">{reportPreview.nextUnlock}</span>
                    </div>
                  )}
                  {/* Show remaining locked sections */}
                  {Array.from({ length: Math.max(0, 7 - (reportPreview.unlockedSections.length + (reportPreview.nextUnlock ? 1 : 0))) }).map((_, i) => (
                    <div key={`locked-${i}`} className="flex items-center gap-2.5 opacity-20">
                      <div className="w-4 h-4 rounded-full border border-light shrink-0" />
                      <div className="h-2 bg-light rounded w-32" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next dimension preview */}
            {currentDimIndex + 1 < dimensionGroups.length && (
              <div className="bg-white border border-light p-5 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-tertiary uppercase tracking-wider mb-1">
                      Next Dimension
                    </p>
                    <p className="text-sm font-semibold text-secondary">
                      {DIMENSION_META[dimensionGroups[currentDimIndex + 1].dimension].label}
                    </p>
                    <p className="text-xs text-foreground/50 mt-0.5">
                      {DIMENSION_META[dimensionGroups[currentDimIndex + 1].dimension].description}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-tertiary">
                      {dimensionGroups[currentDimIndex + 1].questions.length} questions
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Dimension completion dots */}
            <div className="flex items-center justify-center gap-3 mb-8">
              {dimensionGroups.map((group, idx) => (
                <div
                  key={group.dimension}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    completedDimensions.includes(group.dimension)
                      ? "bg-navy"
                      : idx === currentDimIndex + 1
                      ? "border-2 border-navy bg-transparent"
                      : "bg-light"
                  }`}
                  title={DIMENSION_META[group.dimension].label}
                />
              ))}
            </div>

            {/* Continue button */}
            <div className="text-center">
              <button
                onClick={handleContinueFromTransition}
                disabled={insightLoading}
                className="bg-navy text-white px-8 py-3.5 text-sm font-semibold hover:bg-secondary transition-colors disabled:opacity-40 flex items-center gap-2 mx-auto"
              >
                {currentDimIndex + 1 < dimensionGroups.length
                  ? `Continue to ${DIMENSION_META[dimensionGroups[currentDimIndex + 1].dimension].label}`
                  : "Review All Responses"}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ---------- REVIEW SCREEN ---------- */}
        {step === "review" && (
          <div>
            <div className="text-center mb-10">
              <p className="text-xs font-semibold text-tertiary tracking-[0.3em] uppercase mb-3">
                Final Step
              </p>
              <h1 className="text-2xl md:text-3xl font-bold text-navy mb-3">
                Review Your Responses
              </h1>
              <div className="mx-auto w-12 h-px bg-navy/15 mb-4" />
              <p className="text-foreground/60 text-sm max-w-lg mx-auto">
                Confirm your answers below. You can click on any question to go
                back and change your selection.
              </p>
            </div>

            {/* Group reviews by dimension */}
            {dimensionGroups.map((group) => (
              <div key={group.dimension} className="mb-8">
                <div className="flex items-center gap-2 mb-3">
                  <DimensionBadge dimension={group.dimension} />
                  {/* Show cached insight inline if available */}
                  {insightCache[group.dimension] && (
                    <span className="text-xs text-tertiary ml-auto max-w-xs truncate hidden sm:block">
                      {insightCache[group.dimension]}
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {group.questions.map((q) => {
                    const resp = responses[q.id];
                    // Compute the question's overall index (1-indexed)
                    const globalIdx = questions.indexOf(q) + 1;
                    return (
                      <button
                        key={q.id}
                        onClick={() => navigateToQuestion(q.id)}
                        className="w-full text-left bg-white border border-light p-5 hover:border-accent transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs text-tertiary mb-1">
                              Q{globalIdx}
                            </p>
                            <p className="text-sm font-medium text-foreground/90">
                              {q.text}
                            </p>
                            {resp && (
                              <p className="text-sm text-navy mt-1.5">
                                {q.options[resp.optionIndex].text}
                              </p>
                            )}
                          </div>
                          <svg
                            className="w-4 h-4 text-accent group-hover:text-secondary shrink-0 mt-1 transition-colors"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z"
                            />
                          </svg>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Submit */}
            <div className="mt-12 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <button
                onClick={() => {
                  // Go back to last question of last dimension
                  const lastGroup =
                    dimensionGroups[dimensionGroups.length - 1];
                  setCurrentDimIndex(dimensionGroups.length - 1);
                  setCurrentQInDim(lastGroup.questions.length - 1);
                  setStep("questions");
                }}
                className="text-sm text-secondary hover:text-navy transition-colors flex items-center gap-1.5"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 16l-4-4m0 0l4-4m-4 4h18"
                  />
                </svg>
                Back to Questions
              </button>

              <button
                onClick={handleFinalSubmit}
                disabled={!allQuestionsAnswered || submitting}
                className="bg-navy text-white px-8 py-3.5 text-sm font-semibold hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Spinner />
                    Submitting...
                  </>
                ) : (
                  "Submit Assessment"
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Inline form styles -- scoped so we don't need a separate CSS file */}
      <style jsx global>{`
        .form-input {
          display: block;
          width: 100%;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          border: 1px solid var(--rlk-light);
          background: var(--rlk-white);
          color: var(--rlk-body);
          outline: none;
          transition: border-color 0.15s;
        }
        .form-input:focus {
          border-color: var(--rlk-navy);
        }
        .form-input::placeholder {
          color: var(--rlk-accent);
        }

        /* Question option hover/selection states */
        .question-option {
          position: relative;
          transition: all 0.15s ease;
        }
        .question-option:hover {
          transform: translateX(2px);
        }

        /* Insight card fade-in */
        .insight-card {
          animation: insightFadeIn 0.5s ease-out;
        }
        .insight-text {
          animation: insightTextFade 0.6s ease-out 0.2s both;
        }
        @keyframes insightFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes insightTextFade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* Dimension transition screen fade-in */
        .dimension-transition {
          animation: dimTransitionIn 0.4s ease-out;
        }
        @keyframes dimTransitionIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* Research status pulse */
        .research-pulse {
          animation: researchPulse 2s ease-in-out infinite;
        }
        @keyframes researchPulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }

        /* Research status text transition */
        .research-status-text {
          transition: opacity 0.3s ease;
        }

        /* Report section unlock animation */
        .report-section-unlock {
          animation: sectionUnlock 0.4s ease-out both;
        }
        @keyframes sectionUnlock {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Field({
  label,
  required,
  optional,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-secondary mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {optional && (
          <span className="text-tertiary font-normal ml-1.5 text-xs">
            (Optional)
          </span>
        )}
      </label>
      {children}
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}

function DimensionBadge({ dimension }: { dimension: string }) {
  return (
    <span className="inline-block text-xs font-semibold tracking-wider uppercase text-tertiary bg-offwhite px-3 py-1 border border-light">
      {dimensionLabel(dimension)}
    </span>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
    >
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
