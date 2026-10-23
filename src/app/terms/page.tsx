import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "IELTShack terms of service.",
};

export default function TermsPage() {
  return (
    <main className="auth-shell">
      <div className="auth-topbar">
        <Link className="brand" href="/"><span className="brand-prompt">&gt;</span><span className="brand-name">IELTShack</span></Link>
        <Link className="auth-link" href="/">← Back to site</Link>
      </div>
      <article className="legal-page">
        <h1 className="auth-title">Terms of Service</h1>
        <p className="auth-sub">Last updated 23 October 2026 · placeholder pending legal review.</p>
        <h2>Using IELTShack</h2>
        <p>
          IELTShack provides practice material and study tools for IELTS
          preparation. You may use the service for personal study. Do not
          resell, scrape, automate, or redistribute practice content, question
          keys, audio or images.
        </p>
        <h2>Accounts</h2>
        <p>
          IELTShack shares an account with SAThack and AdmissionHack. Keep your
          password secure. You are responsible for activity under your account.
          Deleting IELTShack data removes this app’s rows but keeps the shared
          login; ecosystem account deletion must be handled by the account owner.
        </p>
        <h2>No affiliation</h2>
        <p>
          IELTS is a registered trademark of the British Council, IDP: IELTS
          Australia and Cambridge University Press &amp; Assessment. IELTShack
          is not affiliated with or endorsed by them. Practice content is
          third-party study material and may contain errors; report a question
          from the review screen where available.
        </p>
        <h2>Results and AI feedback</h2>
        <p>
          Band estimates, projections and AI examiner feedback are practice
          tools, not official IELTS results. They can be wrong. Always confirm
          readiness with official practice material.
        </p>
        <h2>Availability</h2>
        <p>
          The service is provided as-is during development, without warranties
          or guaranteed availability. Features and content may change or be
          removed.
        </p>
      </article>
    </main>
  );
}
