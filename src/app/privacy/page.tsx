import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How IELTShack handles your data.",
};

export default function PrivacyPage() {
  return (
    <main className="auth-shell">
      <div className="auth-topbar">
        <Link className="brand" href="/"><span className="brand-prompt">&gt;</span><span className="brand-name">IELTShack</span></Link>
        <Link className="auth-link" href="/">← Back to site</Link>
      </div>
      <article className="legal-page">
        <h1 className="auth-title">Privacy Policy</h1>
        <p className="auth-sub">Last updated 21 October 2026 · placeholder pending legal review.</p>
        <h2>What we store</h2>
        <p>In demo mode, your name, email, goals, attempts, saved questions, and vocabulary progress are stored in this browser&apos;s local storage. Nothing is sent to a server.</p>
        <h2>What we do not do</h2>
        <p>We do not sell data, run third-party advertising, or share your practice history.</p>
        <h2>Your controls</h2>
        <p>Settings lets you export your data as JSON, reset progress, or sign out. Clearing site data in your browser removes everything.</p>
        <h2>Future accounts</h2>
        <p>When real accounts arrive, this page will describe server-side storage, retention, and deletion before any data is collected.</p>
      </article>
    </main>
  );
}
