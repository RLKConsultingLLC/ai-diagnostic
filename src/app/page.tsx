import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-offwhite">
      {/* Gradient Bar */}
      <div className="rlk-gradient-bar-thick" />

      {/* Header */}
      <header className="bg-white border-b border-light">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <div className="text-navy text-sm font-bold tracking-[0.3em] uppercase">
            RLK AI Diagnostic
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-secondary">
            <a href="#why-rlk" className="hover:text-navy transition-colors">
              Why RLK
            </a>
            <a href="#how-it-works" className="hover:text-navy transition-colors">
              How It Works
            </a>
            <a href="#pricing" className="hover:text-navy transition-colors">
              Pricing
            </a>
            <Link
              href="/assessment"
              className="bg-navy text-white px-5 py-2.5 text-sm font-semibold hover:bg-secondary transition-colors"
            >
              Start Diagnostic
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-white relative overflow-hidden">
        {/* Subtle background accent */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-navy/[0.02] to-transparent" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-navy/[0.015] blur-3xl translate-y-1/2" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 py-24 md:py-32 lg:py-36">
          <div className="text-center max-w-4xl mx-auto">
            <p className="text-tertiary text-xs md:text-sm font-semibold tracking-[0.3em] uppercase mb-6">
              For CIOs who have run enough pilots
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] leading-[1.1] font-bold text-navy tracking-tight mb-8">
              Your AI investments are working.
              <span className="block mt-2 text-foreground/50">Your organization is not.</span>
            </h1>
            <div className="mx-auto w-16 h-px bg-navy/20 mb-8" />
            <p className="text-lg md:text-xl text-foreground/70 leading-relaxed mb-4 max-w-2xl mx-auto">
              Pilots succeed in isolation. Productivity improves in pockets.
              Yet at the enterprise level, boards see no meaningful margin
              expansion, operating models remain intact, and decision speed
              stays constrained by legacy structures.
            </p>
            <p className="text-base md:text-lg text-foreground/55 leading-relaxed mb-12 max-w-2xl mx-auto">
              This is the diagnostic that explains why. Built
              on the same frameworks RLK developed across a decade at
              McKinsey and Deloitte, it identifies the structural barriers
              preventing your AI investments from translating into enterprise
              value.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              <Link
                href="/assessment"
                className="inline-flex items-center bg-navy text-white px-10 py-4 text-base font-semibold hover:bg-secondary transition-colors shadow-sm"
              >
                Start Your Diagnostic
                <svg
                  className="ml-2.5 w-4 h-4"
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
              </Link>
              <span className="text-sm text-tertiary">
                20 minutes. No tools audit. Just operating-model truth.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Diagonal Divider */}
      <div className="rlk-diagonal-divider" />

      {/* The Problem — navy section for visual contrast */}
      <section className="bg-navy text-white py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <p className="text-white/40 text-xs font-semibold tracking-[0.3em] uppercase mb-4">
              The Problem
            </p>
            <h2 className="text-2xl md:text-3xl text-white mb-6">
              AI is not failing inside your organization.
              It is colliding with management structures designed for a
              different information environment.
            </h2>
            <p className="text-white/60 leading-relaxed">
              The tools work. Individual contributors report meaningful
              productivity gains. But the organization surrounding those
              tools has not adapted. Approval chains still assume scarce
              information. Governance frameworks still treat AI as an IT
              project. Financial measurement still cannot connect deployed
              capabilities to bottom-line impact.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-px bg-white/10">
            {[
              { stat: "87%", text: "of organizations use AI in at least one business function, yet only a small fraction can point to measurable bottom-line impact." },
              { stat: "3x", text: "the number of AI pilots launched vs. those that reach production. Most organizations are stuck between experimentation and operational integration." },
              { stat: "6\u201312+", text: "months from AI use case identification to funded pilot in most enterprises. By the time approval arrives, the competitive window has narrowed." },
            ].map((item) => (
              <div key={item.stat} className="bg-navy p-8">
                <div className="text-4xl md:text-5xl font-bold text-white/90 mb-3 tracking-tight">{item.stat}</div>
                <div className="w-8 h-0.5 bg-white/20 mb-4" />
                <p className="text-sm text-white/50 leading-relaxed">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section className="bg-white py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <p className="text-tertiary text-xs font-semibold tracking-widest uppercase mb-4">
              What You Receive
            </p>
            <h2 className="text-2xl md:text-3xl mb-3">
              Not another maturity assessment. A structural diagnosis.
            </h2>
            <p className="text-tertiary text-base max-w-2xl mx-auto">
              The AI Diagnostic measures five hidden dimensions that
              determine whether your AI investments translate into
              enterprise value, or evaporate.
            </p>
          </div>
          {/* Five dimensions — left accent bar cards */}
          <div className="grid md:grid-cols-5 gap-0 md:gap-px bg-light/50 border border-light overflow-hidden">
            {[
              { title: "Adoption Behavior", desc: "How employees actually use AI vs. how leadership thinks they do." },
              { title: "Authority Structure", desc: "Who controls AI decisions. Where permission bottlenecks exist." },
              { title: "Workflow Integration", desc: "Whether AI is embedded in work or bolted onto it." },
              { title: "Decision Velocity", desc: "How fast your organization moves from insight to action." },
              { title: "Economic Translation", desc: "Whether AI value shows up in financial statements or vanishes." },
            ].map((dim, i) => (
              <div key={dim.title} className="bg-white p-6 border-l-[3px] border-l-navy md:border-l-0 md:border-b-[3px] md:border-b-navy">
                <div className="text-[10px] font-bold text-navy/30 tracking-widest uppercase mb-2">0{i + 1}</div>
                <h3 className="text-sm font-bold text-navy mb-2">{dim.title}</h3>
                <p className="text-xs text-foreground/60 leading-relaxed">{dim.desc}</p>
              </div>
            ))}
          </div>

          {/* Three deliverables — McKinsey-style accent bar cards */}
          <div className="mt-16 grid md:grid-cols-3 gap-8">
            {[
              { title: "Behavioral Diagnosis", text: "61 behavioral questions that diagnose how your people actually interact with AI, not which tools you purchased. The gap between those two things is where value disappears." },
              { title: "Financial Quantification", text: "Dollar-denominated unrealized value your board can act on. Not vendor ROI projections. An independent economic model that translates behavioral patterns into financial exposure." },
              { title: "Board-Ready Report", text: "A 5 to 8 page PDF briefing designed for executive and board audiences. Enriched with company-specific intelligence from public filings, news, and competitive analysis. Includes a 90-day action plan with named owners." },
            ].map((item) => (
              <div key={item.title} className="bg-offwhite border border-light border-l-[3px] border-l-navy p-8">
                <h3 className="text-lg font-semibold mb-3">{item.title}</h3>
                <p className="text-foreground/70 text-sm leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Diagonal Divider */}
      <div className="rlk-diagonal-divider-reverse" />

      {/* Why RLK */}
      <section id="why-rlk" className="bg-offwhite py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid md:grid-cols-2 gap-16 items-start">
            <div>
              <p className="text-tertiary text-xs font-semibold tracking-widest uppercase mb-4">
                Who Built This
              </p>
              <h2 className="text-2xl md:text-3xl mb-6">
                This diagnostic was not built by a software company.
                It was built by a consultant who has done this work by hand.
              </h2>
              <div className="flex items-start gap-5 mb-6">
                <Image
                  src="/ryan-king.jpg"
                  alt="Ryan King, Founder of RLK Consulting"
                  width={72}
                  height={80}
                  className="rounded-lg object-cover object-[center_20%] w-[72px] h-[80px] shrink-0 border border-light shadow-sm"
                />
                <div>
                  <p className="text-sm font-semibold text-navy">Ryan L. King</p>
                  <p className="text-xs text-tertiary">Founder, RLK Consulting</p>
                </div>
              </div>
              <p className="text-foreground/70 leading-relaxed mb-5">
                Ryan has spent nearly 15 years in consulting, including a
                decade across McKinsey &amp; Company and Deloitte, advising
                CIOs, CTOs, and senior technology leaders on strategy,
                performance, and organizational transformation. She is the
                author of <em>The Human and Machine Company</em> (2026).
              </p>
              <p className="text-foreground/70 leading-relaxed mb-5">
                Her work sits at the intersection of technology strategy
                and organizational design. She has advised leaders inside
                Fortune 50 enterprises and small founder-led companies,
                across insurance, banking, healthcare, logistics, government,
                consumer retail, aerospace, and technology environments.
              </p>
              <p className="text-foreground/70 leading-relaxed mb-8">
                This diagnostic is a productized version of the assessment
                Ryan has conducted by hand for enterprise clients. The same
                frameworks, the same analytical rigor, the same CIO-grade
                output. Delivered in 20 minutes instead of 6 weeks, at a
                fraction of the cost.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="bg-white p-5 border border-light flex-1">
                  <div className="text-xs text-tertiary tracking-widest uppercase mb-1">
                    Background
                  </div>
                  <div className="text-sm font-semibold text-navy">
                    McKinsey &amp; Company, Deloitte
                  </div>
                </div>
                <div className="bg-white p-5 border border-light flex-1">
                  <div className="text-xs text-tertiary tracking-widest uppercase mb-1">
                    Experience
                  </div>
                  <div className="text-sm font-semibold text-navy">
                    Nearly 15 years, CIO advisory
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div className="bg-white border border-light p-8">
                <p className="text-tertiary text-xs font-semibold tracking-widest uppercase mb-4">
                  The Core Thesis
                </p>
                <blockquote className="text-lg text-secondary leading-relaxed italic mb-6">
                  &ldquo;Artificial intelligence is not failing inside large
                  organizations. It is colliding with management structures
                  designed for a different information environment. The tools
                  are working. The organization surrounding them has not yet
                  adapted.&rdquo;
                </blockquote>
                <div className="border-t border-light pt-4">
                  <div className="text-sm font-semibold text-navy">
                    Ryan L. King
                  </div>
                  <div className="text-xs text-tertiary">
                    RLK Consulting
                  </div>
                </div>
              </div>

              <a
                href="https://www.rlkconsultingco.com/general-7"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 bg-white border border-light p-6 flex items-center gap-5 group hover:border-accent transition-colors block"
              >
                <Image
                  src="/book-cover.jpg"
                  alt="The Human and Machine Company by Ryan King"
                  width={80}
                  height={120}
                  className="shadow-md shrink-0 group-hover:shadow-lg transition-shadow"
                />
                <div>
                  <p className="text-tertiary text-[10px] font-semibold tracking-widest uppercase mb-1.5">
                    The Book
                  </p>
                  <p className="text-sm font-semibold text-navy mb-1">
                    The Human and Machine Company
                  </p>
                  <p className="text-xs text-foreground/60 leading-relaxed mb-2">
                    How organizations must restructure authority, governance,
                    and decision-making to capture value from AI.
                  </p>
                  <span className="text-xs font-semibold text-navy group-hover:underline">
                    Read more &rarr;
                  </span>
                </div>
              </a>

              <div className="mt-6 bg-white border border-light p-8">
                <p className="text-tertiary text-xs font-semibold tracking-widest uppercase mb-4">
                  What This Diagnostic Measures
                </p>
                <p className="text-sm text-foreground/70 leading-relaxed mb-4">
                  AI adoption follows a predictable progression. Individuals
                  experiment. Organizations attempt to govern. Only later do
                  some redesign workflows and decision authority. Most
                  enterprises are stalled between governance and redesign,
                  accumulating activity without structural impact.
                </p>
                <p className="text-sm text-foreground/70 leading-relaxed">
                  The diagnostic measures exactly where you are stalled,
                  what structural barrier is holding you there, and what it
                  is costing you in unrealized value.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="bg-white py-16 border-y border-light">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <div className="inline-flex items-center gap-3 mb-5">
            <div className="h-px w-12 bg-accent" />
            <span className="text-xs font-semibold tracking-widest uppercase text-tertiary">
              Advisory Foundation
            </span>
            <div className="h-px w-12 bg-accent" />
          </div>
          <p className="text-xl md:text-2xl text-secondary font-semibold max-w-3xl mx-auto leading-relaxed">
            Built on frameworks developed across nearly 15 years of
            enterprise advisory work spanning financial services, insurance,
            healthcare, government, logistics, and manufacturing.
          </p>
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-2xl mx-auto">
            <div>
              <div className="text-2xl font-bold text-navy">5</div>
              <div className="text-xs text-tertiary mt-1">
                Hidden Dimensions
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-navy">61</div>
              <div className="text-xs text-tertiary mt-1">
                Behavioral Questions
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-navy">23</div>
              <div className="text-xs text-tertiary mt-1">
                Industries Calibrated
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-navy">3</div>
              <div className="text-xs text-tertiary mt-1">
                Composite Indices
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-offwhite py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-3xl mb-3">How It Works</h2>
            <p className="text-tertiary text-base">
              Three steps. Twenty minutes. Board-level clarity.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-14 h-14 mx-auto bg-navy text-white flex items-center justify-center text-xl font-bold mb-5">
                1
              </div>
              <h3 className="text-lg font-semibold mb-3">
                Complete the Assessment
              </h3>
              <p className="text-foreground/70 text-sm leading-relaxed max-w-xs mx-auto">
                Answer 61 behavioral questions across five dimensions.
                While you respond, our AI researches your company using
                public filings, news, and competitive intelligence.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 mx-auto bg-secondary text-white flex items-center justify-center text-xl font-bold mb-5">
                2
              </div>
              <h3 className="text-lg font-semibold mb-3">
                Receive Your Diagnosis
              </h3>
              <p className="text-foreground/70 text-sm leading-relaxed max-w-xs mx-auto">
                Your diagnostic data merges with company-specific
                intelligence to produce a structural analysis: stage
                classification, composite indices, and economic
                quantification.
              </p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 mx-auto bg-tertiary text-white flex items-center justify-center text-xl font-bold mb-5">
                3
              </div>
              <h3 className="text-lg font-semibold mb-3">
                Get Your Board Report
              </h3>
              <p className="text-foreground/70 text-sm leading-relaxed max-w-xs mx-auto">
                Download a professionally formatted PDF briefing with
                executive summary, vendor landscape analysis, competitive
                positioning, and a 90-day action plan with named owners
                by role.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What Makes This Different — side-by-side comparison */}
      <section className="bg-white py-20 md:py-24 border-t border-light">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl mb-3">
              Why this is not another survey
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-0 max-w-4xl mx-auto overflow-hidden border border-light">
            <div className="bg-offwhite p-8 md:p-10">
              <h3 className="text-xs font-bold text-foreground/40 uppercase tracking-[0.2em] mb-5">
                Most AI Assessments
              </h3>
              <ul className="text-sm text-foreground/50 space-y-3">
                {[
                  "Ask which tools you use",
                  "Measure self-reported adoption percentages",
                  "Produce generic maturity scores",
                  "Recommend \u201Cbuilding a center of excellence\u201D",
                  "Cost $50K+ and take 6 weeks",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="text-foreground/20 mt-0.5">&mdash;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-navy p-8 md:p-10">
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-[0.2em] mb-5">
                The RLK Diagnostic
              </h3>
              <ul className="text-sm text-white/80 space-y-3">
                {[
                  "Diagnoses behavioral patterns, not tool inventories",
                  "Identifies structural barriers your team cannot see from inside",
                  "Quantifies unrealized value in dollar terms",
                  "Delivers a 90-day action plan with owners by role",
                  "$497, delivered in minutes, enriched with public intelligence",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <svg className="w-4 h-4 text-white/40 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Diagonal Divider */}
      <div className="rlk-diagonal-divider-reverse" />

      {/* Pricing */}
      <section id="pricing" className="bg-offwhite py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl mb-3">Investment</h2>
            <p className="text-tertiary text-base max-w-xl mx-auto">
              The same analytical framework RLK applies in six-figure
              advisory engagements. Productized for leadership teams that
              need clarity now.
            </p>
          </div>
          <div className="max-w-lg mx-auto bg-white border border-light p-10 text-center">
            <div className="text-sm font-semibold text-tertiary tracking-widest uppercase mb-4">
              RLK AI Diagnostic
            </div>
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <span className="text-5xl font-bold text-navy">$497</span>
            </div>
            <p className="text-sm text-tertiary mb-8">One-time assessment</p>
            <ul className="text-left text-sm text-foreground/80 space-y-3 mb-10">
              {[
                "61-question behavioral diagnostic across 5 dimensions",
                "Stage classification with confidence scoring",
                "3 composite indices (Authority Friction, Decision Velocity, Economic Translation)",
                "Dollar-denominated unrealized value quantification",
                "Company-specific intelligence from public filings and news",
                "AI vendor landscape analysis for your industry and use cases",
                "Board-ready PDF report with executive summary",
                "90-day action plan with owners by role",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-navy shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/assessment"
              className="block bg-navy text-white px-8 py-4 text-base font-semibold hover:bg-secondary transition-colors text-center"
            >
              Begin Your Assessment
            </Link>
            <p className="text-xs text-tertiary mt-4">
              Secure payment processed by Stripe. All data treated as
              confidential.
            </p>
          </div>
        </div>
      </section>

      {/* Diagonal to Footer */}
      <div className="rlk-diagonal-white-to-navy" />

      {/* Footer */}
      <footer className="bg-navy text-white/70 py-14">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid md:grid-cols-3 gap-10 mb-10">
            <div>
              <div className="text-white text-sm font-bold tracking-[0.3em] uppercase mb-4">
                RLK Consulting
              </div>
              <p className="text-sm leading-relaxed mb-4">
                CIO Advisory. Helping CIOs, CTOs, and senior technology
                leaders navigate digital transformation and translate
                technology investment into measurable organizational value.
              </p>
              <p className="text-sm">
                Founded by Ryan King. McKinsey &amp; Deloitte alum.
                Author of <em>The Human and Machine Company</em>.
              </p>
            </div>
            <div>
              <div className="text-white text-xs font-semibold tracking-widest uppercase mb-4">
                Product
              </div>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#how-it-works"
                    className="hover:text-white transition-colors"
                  >
                    How It Works
                  </a>
                </li>
                <li>
                  <a
                    href="#why-rlk"
                    className="hover:text-white transition-colors"
                  >
                    Why RLK
                  </a>
                </li>
                <li>
                  <a
                    href="#pricing"
                    className="hover:text-white transition-colors"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <Link
                    href="/assessment"
                    className="hover:text-white transition-colors"
                  >
                    Start Diagnostic
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <div className="text-white text-xs font-semibold tracking-widest uppercase mb-4">
                Contact
              </div>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="mailto:hello@rlkconsultingco.com"
                    className="hover:text-white transition-colors"
                  >
                    hello@rlkconsultingco.com
                  </a>
                </li>
                <li>
                  <a
                    href="https://rlkconsultingco.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    rlkconsultingco.com
                  </a>
                </li>
              </ul>
              <div className="text-white text-xs font-semibold tracking-widest uppercase mt-6 mb-2">
                Legal
              </div>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/privacy" className="hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs">
              &copy; {new Date().getFullYear()} RLK Consulting, LLC. All
              rights reserved.
            </p>
            <p className="text-xs text-white/40">
              All assessment data is treated as strictly confidential and
              is not shared with third parties.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
