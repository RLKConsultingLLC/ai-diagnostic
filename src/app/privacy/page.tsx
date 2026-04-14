import Link from "next/link";

export default function PrivacyPolicy() {
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
        <h1 className="text-3xl font-bold text-navy mb-2">Privacy Policy</h1>
        <p className="text-sm text-tertiary mb-10">Last updated: April 2026</p>

        <div className="prose prose-sm text-foreground/80 space-y-6 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-navy mb-3">Overview</h2>
            <p>
              RLK Consulting, LLC (&ldquo;RLK,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) operates the RLK AI Diagnostic
              platform. This policy describes how we collect, use, and protect information
              provided through the diagnostic assessment.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy mb-3">Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Company profile data:</strong> Company name, industry, size, and related organizational details you provide during the intake.</li>
              <li><strong>Assessment responses:</strong> Your answers to diagnostic questions about AI adoption, governance, workflows, and organizational structure.</li>
              <li><strong>Contact information:</strong> Email address provided for report delivery and payment processing.</li>
              <li><strong>Payment information:</strong> Processed securely by Stripe. We do not store credit card numbers or banking details on our servers.</li>
              <li><strong>Public intelligence:</strong> During the assessment, our AI researches publicly available information about your company (SEC filings, news, press releases). This data is already public.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy mb-3">How We Use Your Data</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To generate your personalized AI diagnostic report.</li>
              <li>To process your payment via Stripe.</li>
              <li>To improve the diagnostic framework and scoring methodology (aggregated, de-identified data only).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy mb-3">Data Protection</h2>
            <p>
              All assessment data is treated as strictly confidential. We do not sell, share,
              or distribute your individual assessment responses or diagnostic results to
              third parties. Your data is stored in encrypted, access-controlled cloud
              infrastructure and is automatically deleted after 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy mb-3">Third-Party Services</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Stripe:</strong> Payment processing. Subject to <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-navy underline">Stripe&rsquo;s Privacy Policy</a>.</li>
              <li><strong>Vercel:</strong> Application hosting infrastructure.</li>
              <li><strong>Anthropic:</strong> AI model provider for report generation. Assessment data sent to the model is not used for training.</li>
              <li><strong>Upstash:</strong> Encrypted data storage.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy mb-3">Your Rights</h2>
            <p>
              You may request deletion of your assessment data at any time by contacting us at{" "}
              <a href="mailto:hello@rlkconsultingco.com" className="text-navy underline">hello@rlkconsultingco.com</a>.
              Data is automatically purged 30 days after your assessment.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-navy mb-3">Contact</h2>
            <p>
              For questions about this policy, contact:<br />
              RLK Consulting, LLC<br />
              <a href="mailto:hello@rlkconsultingco.com" className="text-navy underline">hello@rlkconsultingco.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
