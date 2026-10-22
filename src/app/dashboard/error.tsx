"use client";

import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Something broke.</h1>
          <p className="dash-sub">{error.message || "This screen could not load."}</p>
        </div>
      </div>
      <div className="dash-card dash-empty">
        <div style={{ display: "flex", gap: ".7rem", justifyContent: "center", flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={reset}>Try again →</button>
          <Link className="btn btn-ghost" href="/dashboard">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
