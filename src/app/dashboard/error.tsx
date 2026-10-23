"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled dashboard error", error);
  }, [error]);

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Something broke.</h1>
          <p className="dash-sub">This screen could not load. Try again, or return to the dashboard.</p>
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
