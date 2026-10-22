"use client";

import Link from "next/link";
import { useAppData } from "@/lib/useAppData";
import { SKILL_LABEL, SKILLS, type Skill } from "@/lib/types";

export default function AnalyticsPage() {
  const { loaded, profile, attempts } = useAppData();
  if (!loaded || !profile) return null;

  const ordered = [...attempts].sort(
    (a, b) => new Date(a.finishedAt).getTime() - new Date(b.finishedAt).getTime()
  );
  // Writing-only sets carry no marks, so they must not drag bands or accuracy.
  const scored = ordered.filter((a) => a.total > 0);
  const latest = scored[scored.length - 1];
  const best = scored.length ? Math.max(...scored.map((a) => a.overallBand)) : null;
  const totals = scored.reduce(
    (acc, a) => {
      acc.correct += a.correct;
      acc.total += a.total;
      return acc;
    },
    { correct: 0, total: 0 }
  );
  const accuracy = totals.total ? Math.round((totals.correct / totals.total) * 100) : 0;

  const skillStats = SKILLS.map((skill) => {
    let correct = 0;
    let total = 0;
    for (const attempt of attempts) {
      const bucket = attempt.perSkill[skill];
      if (!bucket) continue;
      correct += bucket.correct;
      total += bucket.total;
    }
    return { skill, correct, total, percent: total ? Math.round((correct / total) * 100) : 0 };
  });

  const points = ordered.map((attempt, index) => {
    const x = ordered.length === 1 ? 300 : 30 + (index / (ordered.length - 1)) * 540;
    const y = 150 - (attempt.overallBand / 9) * 120;
    return { x, y, band: attempt.overallBand };
  });

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Analytics</h1>
          <p className="dash-sub">
            {attempts.length
              ? `${attempts.length} session${attempts.length === 1 ? "" : "s"} logged · accuracy ${accuracy}%`
              : "Take a session to unlock your analytics."}
          </p>
        </div>
        <div className="dash-head-actions">
          <span className="chip">Target {profile.targetBand.toFixed(1)}</span>
          {latest && <span className="chip">Latest {latest.overallBand.toFixed(1)}</span>}
        </div>
      </div>

      {attempts.length === 0 ? (
        <div className="dash-card dash-empty">
          <p>No data yet — the diagnostic is the fastest way to fill this page.</p>
          <Link className="btn btn-primary" href="/dashboard/diagnostic" style={{ marginTop: "1rem" }}>
            Start diagnostic →
          </Link>
        </div>
      ) : (
        <>
          <div className="dash-stat-grid">
            <div className="dash-stat-card">
              <span className="dash-stat-label">Sessions</span>
              <span className="dash-stat-value">{attempts.length}</span>
            </div>
            <div className="dash-stat-card">
              <span className="dash-stat-label">Accuracy</span>
              <span className="dash-stat-value accent">{accuracy}%</span>
            </div>
            <div className="dash-stat-card">
              <span className="dash-stat-label">Best band</span>
              <span className="dash-stat-value">{best?.toFixed(1) ?? "—"}</span>
            </div>
            <div className="dash-stat-card">
              <span className="dash-stat-label">Questions answered</span>
              <span className="dash-stat-value">{totals.total}</span>
            </div>
          </div>

          <div className="dash-card">
            <h2 className="dash-section-title">Overall band trend</h2>
            <svg viewBox="0 0 600 170" className="mini-trend" role="img" aria-label="Band trend">
              <defs>
                <linearGradient id="trendLine" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#c6ff4a" />
                  <stop offset="100%" stopColor="#5eead4" />
                </linearGradient>
              </defs>
              {[0, 3, 6, 9].map((band) => {
                const y = 150 - (band / 9) * 120;
                return (
                  <g key={band}>
                    <line x1="30" y1={y} x2="570" y2={y} stroke="#22261b" strokeWidth="1" />
                    <text x="8" y={y + 4} fill="#5f6554" fontSize="10">{band}</text>
                  </g>
                );
              })}
              <line
                x1="30"
                y1={150 - (profile.targetBand / 9) * 120}
                x2="570"
                y2={150 - (profile.targetBand / 9) * 120}
                stroke="#a78bfa"
                strokeDasharray="5 5"
                strokeWidth="1"
              />
              {points.length > 1 && (
                <polyline
                  points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="url(#trendLine)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {points.map((point, i) => (
                <circle key={i} cx={point.x} cy={point.y} r="4" fill="#c6ff4a" />
              ))}
            </svg>
            <p className="attempt-meta">Dashed line = target band {profile.targetBand.toFixed(1)}.</p>
          </div>

          <div className="dash-card">
            <h2 className="dash-section-title">Accuracy by skill</h2>
            <div className="skill-bars">
              {skillStats.map(({ skill, correct, total, percent }) => (
                <div className="priority-row" key={skill}>
                  <span>{SKILL_LABEL[skill as Skill]}</span>
                  <span className="priority-bar">
                    <span style={{ ["--w" as string]: `${percent}%` }} />
                  </span>
                  <span className="priority-val">
                    {total ? `${percent}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
