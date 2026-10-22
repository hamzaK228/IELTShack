"use client";

import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="auth-shell">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <p className="onb-eyebrow">Something broke</p>
        <h1 className="auth-title">That didn&apos;t load.</h1>
        <p className="auth-sub">
          {error.message || "An unexpected error occurred. Try again, or head back to the dashboard."}
        </p>
        <div style={{ display: "flex", gap: ".7rem", justifyContent: "center", flexWrap: "wrap", marginTop: "1.2rem" }}>
          <button className="btn btn-primary" onClick={reset}>Try again →</button>
          <Link className="btn btn-ghost" href="/dashboard">Dashboard</Link>
          <Link className="btn btn-ghost" href="/">Home</Link>
        </div>
        {error.digest && <p className="attempt-meta" style={{ marginTop: "1rem" }}>Reference: {error.digest}</p>}
      </div>
    </main>
  );
}
