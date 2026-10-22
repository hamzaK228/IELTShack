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
        <p className="auth-sub">Last updated 21 October 2026 · placeholder pending legal review.</p>
        <h2>Using IELTShack</h2>
        <p>IELTShack provides practice material and study tools for IELTS preparation. You may use the service for personal study. Do not resell, scrape, or redistribute practice content.</p>
        <h2>No affiliation</h2>
        <p>IELTS is a registered trademark of the British Council, IDP: IELTS Australia and Cambridge University Press &amp; Assessment. IELTShack is not affiliated with or endorsed by them.</p>
        <h2>Results</h2>
        <p>Band estimates and progress analytics are practice tools, not official IELTS results. Always confirm readiness with official practice material.</p>
        <h2>Demo accounts</h2>
        <p>During development, accounts and progress are stored locally in your browser. Clearing browser storage removes them.</p>
      </article>
    </main>
  );
}
