import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-shell">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <p className="onb-eyebrow" style={{ justifyContent: "center" }}>404</p>
        <h1 className="auth-title">That page doesn&apos;t exist.</h1>
        <p className="auth-sub">The link may be old, or the page moved. Head back to the dashboard.</p>
        <div style={{ display: "flex", gap: ".7rem", justifyContent: "center", flexWrap: "wrap", marginTop: "1.2rem" }}>
          <Link className="btn btn-primary" href="/dashboard">Go to dashboard →</Link>
          <Link className="btn btn-ghost" href="/">Back to site</Link>
        </div>
      </div>
    </main>
  );
}
