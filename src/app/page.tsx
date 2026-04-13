import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-offwhite">
      {/* Gradient Bar */}
      <div className="rlk-gradient-bar-thick" />

      {/* Header */}
      <header className="bg-white border-b border-light">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <div className="text-navy text-sm font-bold tracking-[0.3em] uppercase">
            RLK Consulting
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-secondary">
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
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <div className="max-w-3xl">
            <p className="text-tertiary text-sm font-semibold tracking-widest uppercase mb-4">
              AI Strategy Diagnostic
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] leading-tight mb-6">
              Your organization is investing in AI.
              <span className="block mt-1">Is it working?</span>
            </h1>
            <p className="text-lg md:text-xl text-foreground/80 leading-relaxed mb-4 max-w-2xl">
              Most enterprises are spending millions on AI initiatives without a
              clear framework to measure behavioral adoption, authority alignment,
              or economic return.
            </p>
            <p className="text-lg text-foreground/70 leading-relaxed mb-10 max-w-2xl">
              The AI Board Brief diagnostic gives your leadership team a
              data-driven assessment of AI maturity across five critical
              dimensions, with board-ready reporting and actionable
              recommendations.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <Link
                href="/assessment"
                className="inline-flex items-center bg-navy text-white px-8 py-4 text-base font-semibold hover:bg-secondary transition-colors"
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
              <span className="text-sm text-tertiary mt-2 sm:mt-3">
                Takes approximately 15 minutes
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Diagonal Divider: Hero -> Feature Columns */}
      <div className="rlk-diagonal-divider" />

      {/* Feature Columns */}
      <section className="bg-offwhite py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl mb-3">
              What You Will Receive
            </h2>
            <p className="text-tertiary text-base max-w-xl mx-auto">
              A comprehensive assessment that translates AI activity into
              executive-level insight.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-white p-8 border border-light">
              <div className="w-12 h-12 bg-navy/5 flex items-center justify-center mb-5">
                <svg
                  className="w-6 h-6 text-navy"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21a48.25 48.25 0 0 1-8.135-.687c-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-3">
                Behavioral Diagnosis
              </h3>
              <p className="text-foreground/70 text-sm leading-relaxed">
                Move beyond technology audits. We assess how your people actually
                use AI, including adoption patterns, authority structures, and workflow
                integration at every level of your organization.
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white p-8 border border-light">
              <div className="w-12 h-12 bg-navy/5 flex items-center justify-center mb-5">
                <svg
                  className="w-6 h-6 text-navy"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-3">Financial Impact</h3>
              <p className="text-foreground/70 text-sm leading-relaxed">
                Quantify the gap between your AI potential and current capture.
                Our economic model translates behavioral patterns into
                dollar-denominated unrealized value your board can act on.
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white p-8 border border-light">
              <div className="w-12 h-12 bg-navy/5 flex items-center justify-center mb-5">
                <svg
                  className="w-6 h-6 text-navy"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-3">
                Board-Ready Report
              </h3>
              <p className="text-foreground/70 text-sm leading-relaxed">
                Receive a professionally formatted PDF briefing designed for
                executive and board-level audiences. Clear visualizations,
                stage classifications, and prioritized action items.
              </p>
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
              Trusted Framework
            </span>
            <div className="h-px w-12 bg-accent" />
          </div>
          <p className="text-xl md:text-2xl text-secondary font-semibold max-w-3xl mx-auto leading-relaxed">
            Based on frameworks developed from 200+ enterprise AI engagements
            across financial services, insurance, healthcare, and manufacturing.
          </p>
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-2xl mx-auto">
            <div>
              <div className="text-2xl font-bold text-navy">200+</div>
              <div className="text-xs text-tertiary mt-1">Engagements</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-navy">5</div>
              <div className="text-xs text-tertiary mt-1">Dimensions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-navy">12</div>
              <div className="text-xs text-tertiary mt-1">Industries</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-navy">$2B+</div>
              <div className="text-xs text-tertiary mt-1">Value Identified</div>
            </div>
          </div>
        </div>
      </section>

      {/* Diagonal Divider: Social Proof -> How It Works */}
      <div className="rlk-diagonal-divider-reverse" />

      {/* How It Works */}
      <section id="how-it-works" className="bg-offwhite py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl md:text-3xl mb-3">How It Works</h2>
            <p className="text-tertiary text-base">
              Three steps to board-level AI clarity.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-14 h-14 mx-auto bg-navy text-white flex items-center justify-center text-xl font-bold mb-5">
                1
              </div>
              <h3 className="text-lg font-semibold mb-3">
                Complete the Assessment
              </h3>
              <p className="text-foreground/70 text-sm leading-relaxed max-w-xs mx-auto">
                Answer questions about your organization&apos;s AI adoption across
                five behavioral dimensions. Takes approximately 15 minutes.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center">
              <div className="w-14 h-14 mx-auto bg-secondary text-white flex items-center justify-center text-xl font-bold mb-5">
                2
              </div>
              <h3 className="text-lg font-semibold mb-3">
                Receive Your Diagnosis
              </h3>
              <p className="text-foreground/70 text-sm leading-relaxed max-w-xs mx-auto">
                Our model scores your organization across five dimensions,
                classifies your maturity stage, and quantifies economic impact.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-14 h-14 mx-auto bg-tertiary text-white flex items-center justify-center text-xl font-bold mb-5">
                3
              </div>
              <h3 className="text-lg font-semibold mb-3">
                Get Your Board Report
              </h3>
              <p className="text-foreground/70 text-sm leading-relaxed max-w-xs mx-auto">
                Download a professionally formatted PDF briefing with executive
                summary, dimension analysis, and prioritized action plan.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-white py-20 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl md:text-3xl mb-3">Investment</h2>
            <p className="text-tertiary text-base max-w-xl mx-auto">
              A fraction of the cost of traditional consulting, with
              board-level analytical rigor.
            </p>
          </div>
          <div className="max-w-lg mx-auto bg-offwhite border border-light p-10 text-center">
            <div className="text-sm font-semibold text-tertiary tracking-widest uppercase mb-4">
              AI Board Brief Diagnostic
            </div>
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <span className="text-5xl font-bold text-navy">$497</span>
            </div>
            <p className="text-sm text-tertiary mb-8">One-time assessment</p>
            <ul className="text-left text-sm text-foreground/80 space-y-3 mb-10">
              <li className="flex items-start gap-3">
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
                Full 5-dimension behavioral diagnostic
              </li>
              <li className="flex items-start gap-3">
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
                Maturity stage classification with confidence scoring
              </li>
              <li className="flex items-start gap-3">
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
                Economic impact quantification with dollar-denominated values
              </li>
              <li className="flex items-start gap-3">
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
                Board-ready PDF report with executive summary
              </li>
              <li className="flex items-start gap-3">
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
                Prioritized action plan tailored to your industry
              </li>
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

      {/* Diagonal Divider: Pricing -> Footer (white to navy) */}
      <div className="rlk-diagonal-white-to-navy" />

      {/* Footer */}
      <footer className="bg-navy text-white/70 py-14">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid md:grid-cols-3 gap-10 mb-10">
            <div>
              <div className="text-white text-sm font-bold tracking-[0.3em] uppercase mb-4">
                RLK Consulting
              </div>
              <p className="text-sm leading-relaxed">
                Enterprise AI strategy advisory. Helping leadership teams
                translate AI investment into measurable organizational value.
              </p>
            </div>
            <div>
              <div className="text-white text-xs font-semibold tracking-widest uppercase mb-4">
                Product
              </div>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#how-it-works" className="hover:text-white transition-colors">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-white transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <Link href="/assessment" className="hover:text-white transition-colors">
                    Start Diagnostic
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <div className="text-white text-xs font-semibold tracking-widest uppercase mb-4">
                Legal
              </div>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Data Security
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs">
              &copy; {new Date().getFullYear()} RLK Consulting. All rights
              reserved.
            </p>
            <p className="text-xs text-white/40">
              All assessment data is treated as strictly confidential and is not
              shared with third parties.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
