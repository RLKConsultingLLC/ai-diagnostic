import Link from "next/link";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-offwhite">
      <div className="rlk-gradient-bar-thick" />
      <header className="bg-white border-b border-light">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <Link href="/" className="text-navy text-sm font-bold tracking-[0.3em] uppercase">
            RLK AI Diagnostic
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold text-navy mb-2">Terms of Service</h1>
        <p className="text-sm text-tertiary mb-10">Last updated: April 2026</p>

        <div className="prose prose-sm text-foreground/80 space-y-6 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-navy mb-3">Agreement</h2>
            <p>
              By accessing or using the RLK AI Diagnostic platform operated by RLK Consulting,
              LLC (&ldquo;RLK,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;), you agree to these terms. If you do not agree,
              do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy mb-3">Service Description</h2>
            <p>
              The RLK AI Diagnostic is a web-based assessment tool that analyzes organizational
              AI readiness across five dimensions. It produces a diagnostic report combining
              your survey responses with publicly available company intelligence. The report
              includes scoring, analysis, competitive positioning, financial estimates, and
              recommended actions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy mb-3">Payment and Refunds</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>The diagnostic report is a one-time purchase at the listed price ($497 unless otherwise indicated).</li>
              <li>Payment is processed securely via Stripe.</li>
              <li>Because the report is generated immediately upon payment, all sales are final. If you experience a technical issue preventing report delivery, contact us and we will resolve it.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy mb-3">Intellectual Property</h2>
            <p>
              The diagnostic framework, scoring methodology, question design, and report
              structure are proprietary to RLK Consulting. Your generated report is licensed
              for your internal business use. You may share it within your organization and
              with your board of directors. You may not resell, redistribute, or publish
              the report publicly.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy mb-3">Disclaimer</h2>
            <p>
              The diagnostic report is an analytical tool, not professional consulting advice.
              Financial estimates, competitive positioning, and recommendations are based on
              the information you provide and publicly available data. They are intended to
              inform executive discussion, not to serve as audited financial projections or
              legal guidance. RLK Consulting is not liable for business decisions made based
              on report content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy mb-3">Data and Confidentiality</h2>
            <p>
              Your assessment data is treated as confidential. See our{" "}
              <Link href="/privacy" className="text-navy underline">Privacy Policy</Link>{" "}
              for details on data collection, use, and retention.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy mb-3">Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, RLK Consulting&rsquo;s total liability
              for any claim arising from use of the service is limited to the amount you
              paid for the diagnostic report.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy mb-3">Changes to Terms</h2>
            <p>
              We may update these terms from time to time. Continued use of the platform
              after changes constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy mb-3">Contact</h2>
            <p>
              For questions about these terms, contact:<br />
              RLK Consulting, LLC<br />
              <a href="mailto:hello@rlkconsultingco.com" className="text-navy underline">hello@rlkconsultingco.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
