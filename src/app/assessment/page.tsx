"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  Industry,
  CompanyProfile,
  DiagnosticQuestion,
  AssessmentResponse,
} from "@/types/diagnostic";

// ---------------------------------------------------------------------------
// Static Data
// ---------------------------------------------------------------------------

const INDUSTRIES: { value: Industry; label: string }[] = [
  { value: "financial_services", label: "Financial Services" },
  { value: "insurance", label: "Insurance" },
  { value: "healthcare", label: "Healthcare" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "technology", label: "Technology" },
  { value: "retail_ecommerce", label: "Retail / E-Commerce" },
  { value: "professional_services", label: "Professional Services" },
  { value: "energy_utilities", label: "Energy & Utilities" },
  { value: "government", label: "Government" },
  { value: "education", label: "Education" },
  { value: "media_entertainment", label: "Media & Entertainment" },
  { value: "other", label: "Other" },
];

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

// Placeholder diagnostic questions. The real set comes from the API in production;
// this gives a representative sample so the UI is functional end-to-end.
const QUESTIONS: DiagnosticQuestion[] = [
  {
    id: "ab_01",
    dimension: "adoption_behavior",
    text: "How would you characterize employee AI tool usage across your organization?",
    subtext:
      "Consider both sanctioned and unsanctioned tools, from generative AI to embedded features.",
    options: [
      { text: "Virtually no one uses AI tools in their daily work", score: 1 },
      { text: "A small group of early adopters experiment on their own", score: 2 },
      { text: "Several departments have adopted AI tools with varying success", score: 3 },
      { text: "Most teams use AI tools regularly with documented workflows", score: 4 },
      { text: "AI is deeply embedded in most workflows across the organization", score: 5 },
    ],
    weight: 1.0,
    tags: ["adoption", "behavioral"],
  },
  {
    id: "ab_02",
    dimension: "adoption_behavior",
    text: "When a new AI capability becomes available, how does your organization typically respond?",
    subtext: "Think about the last 2-3 AI tools or features introduced.",
    options: [
      { text: "New AI tools are generally ignored or blocked", score: 1 },
      { text: "Individual enthusiasts try them; no organizational response", score: 2 },
      { text: "IT evaluates them but rollout is slow and inconsistent", score: 3 },
      { text: "There is a defined evaluation and rollout process", score: 4 },
      { text: "Rapid, structured evaluation with clear adoption pathways", score: 5 },
    ],
    weight: 1.0,
    tags: ["adoption", "process"],
  },
  {
    id: "as_01",
    dimension: "authority_structure",
    text: "Who has decision-making authority over AI investments and implementation?",
    subtext:
      "Consider both formal authority (budget, policy) and informal influence.",
    options: [
      { text: "No clear ownership; decisions happen ad hoc", score: 1 },
      { text: "IT department controls most AI decisions unilaterally", score: 2 },
      { text: "Shared between IT and business units, but often contentious", score: 3 },
      { text: "Cross-functional governance with clear accountability", score: 4 },
      { text: "Federated model with executive oversight and business-unit autonomy", score: 5 },
    ],
    weight: 1.2,
    tags: ["authority", "governance"],
  },
  {
    id: "as_02",
    dimension: "authority_structure",
    text: "How are AI policies (acceptable use, data governance, ethics) established and enforced?",
    options: [
      { text: "No formal AI policies exist", score: 1 },
      { text: "Informal guidelines exist but are not enforced", score: 2 },
      { text: "Written policies exist but compliance is inconsistent", score: 3 },
      { text: "Clear policies with regular training and enforcement", score: 4 },
      { text: "Comprehensive framework with continuous monitoring and adaptation", score: 5 },
    ],
    weight: 1.1,
    tags: ["authority", "policy"],
  },
  {
    id: "wi_01",
    dimension: "workflow_integration",
    text: "To what extent are AI tools integrated into core business processes?",
    subtext:
      "Core processes = those directly tied to revenue, customer experience, or compliance.",
    options: [
      { text: "AI is not part of any core business process", score: 1 },
      { text: "AI is used in peripheral tasks (e.g., note-taking, summarization)", score: 2 },
      { text: "AI supports some core processes but is not essential to them", score: 3 },
      { text: "AI is integral to several core processes with fallback procedures", score: 4 },
      { text: "AI is deeply embedded in most core processes and continuously optimized", score: 5 },
    ],
    weight: 1.0,
    tags: ["workflow", "integration"],
  },
  {
    id: "wi_02",
    dimension: "workflow_integration",
    text: "How well do your AI systems integrate with existing enterprise software and data infrastructure?",
    options: [
      { text: "AI tools are standalone; no integration with existing systems", score: 1 },
      { text: "Basic integrations exist but require manual data transfer", score: 2 },
      { text: "Some API-level integrations but significant gaps remain", score: 3 },
      { text: "Well-integrated with most systems; unified data pipelines", score: 4 },
      { text: "Fully integrated ecosystem with real-time data flow and automated orchestration", score: 5 },
    ],
    weight: 1.0,
    tags: ["workflow", "infrastructure"],
  },
  {
    id: "dv_01",
    dimension: "decision_velocity",
    text: "How quickly can your organization move from an AI insight to an operational decision?",
    subtext:
      "Consider a typical scenario where an AI model surfaces a recommendation.",
    options: [
      { text: "AI-generated insights are rarely acted upon", score: 1 },
      { text: "Insights are reviewed but decisions take weeks or months", score: 2 },
      { text: "Moderate speed -- decisions within days for non-critical items", score: 3 },
      { text: "Fast decision cycle; AI recommendations are acted on within hours to a day", score: 4 },
      { text: "Near-real-time; AI recommendations automatically trigger or accelerate decisions", score: 5 },
    ],
    weight: 1.2,
    tags: ["velocity", "decision"],
  },
  {
    id: "dv_02",
    dimension: "decision_velocity",
    text: "How effectively does your leadership team use AI-generated data in strategic decisions?",
    options: [
      { text: "Leadership does not use AI outputs in decision-making", score: 1 },
      { text: "AI data is occasionally referenced but not trusted", score: 2 },
      { text: "AI data informs some decisions but is supplemented heavily by intuition", score: 3 },
      { text: "AI data is a key input in most strategic discussions", score: 4 },
      { text: "AI-driven insights are central to strategy with executive confidence in the models", score: 5 },
    ],
    weight: 1.1,
    tags: ["velocity", "leadership"],
  },
  {
    id: "et_01",
    dimension: "economic_translation",
    text: "Can you quantify the financial return on your AI investments?",
    subtext:
      "Consider direct savings, revenue growth, efficiency gains, or risk reduction.",
    options: [
      { text: "We have no way to measure AI ROI", score: 1 },
      { text: "We have anecdotal evidence of value but no formal measurement", score: 2 },
      { text: "Some initiatives have measured ROI; others do not", score: 3 },
      { text: "Most AI initiatives have defined KPIs and regular ROI reporting", score: 4 },
      { text: "Comprehensive ROI framework with real-time value tracking across all AI investments", score: 5 },
    ],
    weight: 1.3,
    tags: ["economic", "measurement"],
  },
  {
    id: "et_02",
    dimension: "economic_translation",
    text: "How does your organization allocate budget for AI initiatives?",
    options: [
      { text: "No dedicated AI budget; funded ad hoc from departmental budgets", score: 1 },
      { text: "Small exploratory budget controlled by IT", score: 2 },
      { text: "Dedicated AI budget but inconsistent allocation criteria", score: 3 },
      { text: "Strategic AI budget with business-case-driven allocation", score: 4 },
      { text: "Dynamic portfolio approach with stage-gate funding tied to measurable outcomes", score: 5 },
    ],
    weight: 1.0,
    tags: ["economic", "budget"],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Step = "intake" | "questions" | "review";

export default function AssessmentPage() {
  const router = useRouter();

  // -- Navigation state
  const [step, setStep] = useState<Step>("intake");
  const [currentQ, setCurrentQ] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -- Intake form
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState<Industry | "">("");
  const [revenue, setRevenue] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [publicOrPrivate, setPublicOrPrivate] = useState<
    "public" | "private" | ""
  >("");
  const [regulatoryIntensity, setRegulatoryIntensity] = useState<
    CompanyProfile["regulatoryIntensity"] | ""
  >("");
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [executiveEmail, setExecutiveEmail] = useState("");

  // -- Question responses (indexed by question array position)
  const [responses, setResponses] = useState<(number | null)[]>(
    () => new Array(QUESTIONS.length).fill(null)
  );

  // ---------- Handlers ----------

  const toggleUseCase = useCallback((uc: string) => {
    setSelectedUseCases((prev) =>
      prev.includes(uc) ? prev.filter((x) => x !== uc) : [...prev, uc]
    );
  }, []);

  const selectOption = useCallback(
    (optionIndex: number) => {
      setResponses((prev) => {
        const next = [...prev];
        next[currentQ] = optionIndex;
        return next;
      });
    },
    [currentQ]
  );

  const intakeValid =
    companyName.trim() !== "" &&
    industry !== "" &&
    revenue !== "" &&
    employeeCount !== "" &&
    publicOrPrivate !== "" &&
    regulatoryIntensity !== "" &&
    selectedUseCases.length > 0;

  const allQuestionsAnswered = responses.every((r) => r !== null);

  // Submit intake to create a session
  const handleIntakeSubmit = async () => {
    if (!intakeValid) return;
    setSubmitting(true);
    setError(null);

    const profile: CompanyProfile = {
      companyName: companyName.trim(),
      industry: industry as Industry,
      revenue: parseFloat(revenue),
      employeeCount: parseInt(employeeCount, 10),
      publicOrPrivate: publicOrPrivate as "public" | "private",
      regulatoryIntensity:
        regulatoryIntensity as CompanyProfile["regulatoryIntensity"],
      primaryAIUseCases: selectedUseCases,
      executiveEmail: executiveEmail.trim() || undefined,
    };

    try {
      const res = await fetch("/api/assessment/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyProfile: profile }),
      });

      if (!res.ok) throw new Error("Failed to start assessment session.");

      const data = await res.json();
      setSessionId(data.sessionId ?? data.id);
      setStep("questions");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Final submit
  const handleFinalSubmit = async () => {
    if (!allQuestionsAnswered) return;
    setSubmitting(true);
    setError(null);

    const assessmentResponses: AssessmentResponse[] = QUESTIONS.map(
      (q, idx) => ({
        questionId: q.id,
        selectedOptionIndex: responses[idx]!,
        score: q.options[responses[idx]!].score,
      })
    );

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

  // ---------- Progress ----------

  const totalSteps = QUESTIONS.length + 2; // intake + questions + review
  const currentStep =
    step === "intake" ? 1 : step === "questions" ? currentQ + 2 : totalSteps;
  const progressPercent = Math.round((currentStep / totalSteps) * 100);

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
            RLK Consulting
          </Link>
          <div className="text-xs text-tertiary">
            {step === "intake"
              ? "Company Profile"
              : step === "questions"
              ? `Question ${currentQ + 1} of ${QUESTIONS.length}`
              : "Review & Submit"}
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-light">
          <div
            className="h-full bg-navy transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 md:py-14">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 text-sm px-5 py-3">
            {error}
          </div>
        )}

        {/* ---------- INTAKE FORM ---------- */}
        {step === "intake" && (
          <div>
            <p className="text-xs font-semibold text-tertiary tracking-widest uppercase mb-2">
              Step 1
            </p>
            <h1 className="text-2xl md:text-3xl mb-2">Company Profile</h1>
            <p className="text-foreground/60 text-sm mb-10 max-w-lg">
              We use this information to customize the diagnostic scoring and
              generate industry-relevant benchmarks.
            </p>

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

              {/* Industry */}
              <Field label="Industry" required>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value as Industry)}
                  className="form-input"
                >
                  <option value="">Select industry...</option>
                  {INDUSTRIES.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </select>
              </Field>

              {/* Revenue + Employees — two columns */}
              <div className="grid md:grid-cols-2 gap-6">
                <Field label="Annual Revenue (USD)" required>
                  <input
                    type="number"
                    value={revenue}
                    onChange={(e) => setRevenue(e.target.value)}
                    className="form-input"
                    placeholder="e.g. 500000000"
                    min={0}
                  />
                </Field>
                <Field label="Employee Count" required>
                  <input
                    type="number"
                    value={employeeCount}
                    onChange={(e) => setEmployeeCount(e.target.value)}
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

              {/* Email */}
              <Field label="Executive Email" optional>
                <input
                  type="email"
                  value={executiveEmail}
                  onChange={(e) => setExecutiveEmail(e.target.value)}
                  className="form-input"
                  placeholder="ceo@company.com"
                />
                <p className="text-xs text-tertiary mt-1.5">
                  Optional. Used only to deliver your completed report.
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
        {step === "questions" && (
          <div>
            <p className="text-xs font-semibold text-tertiary tracking-widest uppercase mb-2">
              Question {currentQ + 1} of {QUESTIONS.length}
            </p>

            <DimensionBadge dimension={QUESTIONS[currentQ].dimension} />

            <h1 className="text-xl md:text-2xl mt-4 mb-2 leading-snug">
              {QUESTIONS[currentQ].text}
            </h1>
            {QUESTIONS[currentQ].subtext && (
              <p className="text-sm text-foreground/50 mb-8">
                {QUESTIONS[currentQ].subtext}
              </p>
            )}
            {!QUESTIONS[currentQ].subtext && <div className="mb-8" />}

            <div className="space-y-3">
              {QUESTIONS[currentQ].options.map((opt, oi) => (
                <button
                  key={oi}
                  onClick={() => selectOption(oi)}
                  className={`w-full text-left px-5 py-4 border transition-all text-sm leading-relaxed ${
                    responses[currentQ] === oi
                      ? "border-navy bg-navy/5 text-navy font-medium"
                      : "border-light bg-white text-foreground/80 hover:border-accent"
                  }`}
                >
                  <span className="inline-flex items-center gap-3">
                    <span
                      className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        responses[currentQ] === oi
                          ? "border-navy"
                          : "border-accent"
                      }`}
                    >
                      {responses[currentQ] === oi && (
                        <span className="w-2.5 h-2.5 rounded-full bg-navy" />
                      )}
                    </span>
                    {opt.text}
                  </span>
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="mt-10 flex justify-between items-center">
              <button
                onClick={() => {
                  if (currentQ === 0) {
                    setStep("intake");
                  } else {
                    setCurrentQ((q) => q - 1);
                  }
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
                Previous
              </button>

              {currentQ < QUESTIONS.length - 1 ? (
                <button
                  onClick={() => setCurrentQ((q) => q + 1)}
                  disabled={responses[currentQ] === null}
                  className="bg-navy text-white px-6 py-3 text-sm font-semibold hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Next
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
              ) : (
                <button
                  onClick={() => setStep("review")}
                  disabled={responses[currentQ] === null}
                  className="bg-navy text-white px-6 py-3 text-sm font-semibold hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Review Answers
                </button>
              )}
            </div>
          </div>
        )}

        {/* ---------- REVIEW SCREEN ---------- */}
        {step === "review" && (
          <div>
            <p className="text-xs font-semibold text-tertiary tracking-widest uppercase mb-2">
              Final Step
            </p>
            <h1 className="text-2xl md:text-3xl mb-2">
              Review Your Responses
            </h1>
            <p className="text-foreground/60 text-sm mb-10 max-w-lg">
              Confirm your answers below. You can click on any question to go
              back and change your selection.
            </p>

            <div className="space-y-4">
              {QUESTIONS.map((q, idx) => {
                const selectedIdx = responses[idx];
                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      setCurrentQ(idx);
                      setStep("questions");
                    }}
                    className="w-full text-left bg-white border border-light p-5 hover:border-accent transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-tertiary mb-1">
                          Q{idx + 1} &middot;{" "}
                          {dimensionLabel(q.dimension)}
                        </p>
                        <p className="text-sm font-medium text-foreground/90">
                          {q.text}
                        </p>
                        {selectedIdx !== null && (
                          <p className="text-sm text-navy mt-1.5">
                            {q.options[selectedIdx].text}
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

            {/* Submit */}
            <div className="mt-12 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <button
                onClick={() => {
                  setCurrentQ(QUESTIONS.length - 1);
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
  children,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
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
