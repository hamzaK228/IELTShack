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
        <p className="auth-sub">Last updated 23 October 2026 · placeholder pending legal review.</p>
        <h2>What we store</h2>
        <p>
          Your account email and password are handled by Supabase, the shared
          authentication provider for IELTShack, SAThack and AdmissionHack. Your
          IELTShack profile, attempts, saved questions, vocabulary, plan tasks,
          writing drafts, speaking ratings and community posts are stored in
          Supabase under the <code>ielts_</code> prefix. A copy is kept in your
          browser as an offline cache.
        </p>
        <h2>Cookies and sessions</h2>
        <p>
          Supabase sets authentication cookies so you can stay signed in. We do
          not use advertising cookies or third-party analytics.
        </p>
        <h2>AI evaluation</h2>
        <p>
          When you use “Check with AI”, the task prompt and your answer are sent
          to the AI provider configured by the site operator (for example
          DeepSeek or OpenAI) to produce feedback. Do not paste personal or
          confidential information into a practice answer. AI feedback is a
          study estimate, not an official IELTS result.
        </p>
        <h2>Third-party media</h2>
        <p>
          Listening recordings and some practice images are loaded directly from
          practicepteonline.com. Their server receives your IP address and the
          requesting page when media loads, under their own privacy policy.
        </p>
        <h2>What we do not do</h2>
        <p>
          We do not sell data, run third-party advertising, or share your
          practice history with other learners. Community posts are visible to
          signed-in ecosystem users.
        </p>
        <h2>Your controls</h2>
        <p>
          Settings lets you export your profile, attempts and local cache as JSON,
          reset progress, sign out, or delete your IELTShack data. Deleting app data
          removes your <code>ielts_*</code> rows but keeps the shared ecosystem
          login so SAThack access survives. Clearing site data in your browser
          removes the local cache.
        </p>
        <h2>Retention and contact</h2>
        <p>
          Data is retained until you delete it or the operator removes the
          project. This is a small independent project; use the operator’s
          published contact channel for privacy requests. This page is a
          placeholder pending legal review.
        </p>
      </article>
    </main>
  );
}
