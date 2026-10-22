"use client";

import Link from "next/link";
import { computeStreak, levelFor, useAppData } from "@/lib/useAppData";
import { SKILL_LABEL, SKILLS } from "@/lib/types";

export default function DashboardHome() {
  const { loaded, profile, attempts } = useAppData();
  if (!loaded || !profile) return null;

  const latest = attempts.find((attempt) => attempt.total > 0);
  const currentBand = profile.currentBand ?? latest?.overallBand ?? null;
  const totals = attempts.reduce(
    (acc, attempt) => {
      acc.correct += attempt.correct;
      acc.total += attempt.total;
      return acc;
    },
    { correct: 0, total: 0 }
  );
  const accuracy = totals.total ? Math.round((totals.correct / totals.total) * 100) : null;
  const streak = computeStreak(attempts);
  const xp = attempts.reduce((sum, a) => sum + a.correct * 10 + 20, 0);
  const level = levelFor(xp);
  const days =
    profile.testDate
      ? Math.ceil((new Date(profile.testDate).getTime() - Date.now()) / 86_400_000)
      : null;
  const firstName = profile.name.split(" ")[0];

  const bestBySkill = SKILLS.map((skill) => {
    const entries = attempts
      .map((a) => a.perSkill[skill])
      .filter(Boolean) as Array<{ band: number; correct: number; total: number }>;
    if (!entries.length) return { skill, band: null, percent: 0 };
    const best = Math.max(...entries.map((e) => e.band));
    return { skill, band: best, percent: (best / 9) * 100 };
  });

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Welcome back, {firstName} 👋</h1>
          <p className="dash-sub">
            {profile.targetBand
              ? `You're aiming for Band ${profile.targetBand.toFixed(1)}. Let's close the gap.`
              : "Set a target band in Settings to build your plan."}
          </p>
        </div>
        <div className="dash-head-actions">
          {days !== null && (
            <span className="chip">
              {days > 0 ? `${days} days to test` : "Test day is here"}
            </span>
          )}
          <Link className="btn btn-primary" href="/dashboard/session">
            Start session →
          </Link>
        </div>
      </div>

      <div className="dash-stat-grid">
        <div className="dash-stat-card">
          <span className="dash-stat-label">Current band</span>
          <span className="dash-stat-value">
            {currentBand != null ? currentBand.toFixed(1) : "—"}
          </span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-label">Target band</span>
          <span className="dash-stat-value">{profile.targetBand.toFixed(1)}</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-label">Accuracy</span>
          <span className="dash-stat-value accent">
            {accuracy !== null ? `${accuracy}%` : "—"}
          </span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-label">Day streak</span>
          <span className="dash-stat-value">{streak ? `🔥 ${streak}` : "—"}</span>
        </div>
      </div>

      <Link className="dash-progress" href="/dashboard/leaderboard">
        <span className="dash-progress-badge" aria-hidden="true">{level.level}</span>
        <span className="dash-progress-info">
          <strong>{level.title}</strong>
          <span>{xp.toLocaleString()} XP · {streak}-day streak</span>
        </span>
        <span className="dash-progress-cta">View progress →</span>
      </Link>

      <div className="dash-quick-grid">
        <Link className="dash-quick" href="/dashboard/session">
          <span className="dash-quick-icon" aria-hidden="true">⚡</span>
          <span className="dash-quick-title">Practice session</span>
          <span className="dash-quick-sub">Targeted drills, misses first</span>
        </Link>
        <Link className="dash-quick" href="/dashboard/diagnostic">
          <span className="dash-quick-icon" aria-hidden="true">◎</span>
          <span className="dash-quick-title">Diagnostic</span>
          <span className="dash-quick-sub">Find your weak spots</span>
        </Link>
        <Link className="dash-quick" href="/dashboard/question-bank">
          <span className="dash-quick-icon" aria-hidden="true">▦</span>
          <span className="dash-quick-title">Question bank</span>
          <span className="dash-quick-sub">Browse by skill and type</span>
        </Link>
        <Link className="dash-quick" href="/dashboard/writing">
          <span className="dash-quick-icon" aria-hidden="true">✍</span>
          <span className="dash-quick-title">Writing</span>
          <span className="dash-quick-sub">Timed tasks and model answers</span>
        </Link>
        <Link className="dash-quick" href="/dashboard/speaking">
          <span className="dash-quick-icon" aria-hidden="true">🎤</span>
          <span className="dash-quick-title">Speaking</span>
          <span className="dash-quick-sub">Cue cards and self-rating</span>
        </Link>
      </div>

      <div className="dash-card">
        <div className="dash-card-head">
          <h2 className="dash-section-title">Skill breakdown</h2>
          <Link className="auth-link" href="/dashboard/analytics">Full analytics →</Link>
        </div>
        {attempts.length === 0 ? (
          <p className="dash-empty">
            No attempts yet. Take the diagnostic to see where each skill stands.
          </p>
        ) : (
          <div className="skill-bars">
            {bestBySkill.map(({ skill, band, percent }) => (
              <div className="priority-row" key={skill}>
                <span>{SKILL_LABEL[skill]}</span>
                <span className="priority-bar">
                  <span style={{ ["--w" as string]: `${percent}%` }} />
                </span>
                <span className="priority-val">
                  {band != null ? band.toFixed(1) : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dash-card">
        <div className="dash-card-head">
          <h2 className="dash-section-title">Recent activity</h2>
          <Link className="auth-link" href="/dashboard/test/review">Review last test →</Link>
        </div>
        {attempts.length === 0 ? (
          <div className="dash-empty">
            <p>Your first diagnostic takes about 10 minutes.</p>
            <Link className="btn btn-primary" href="/dashboard/diagnostic" style={{ marginTop: "1rem" }}>
              Start diagnostic →
            </Link>
          </div>
        ) : (
          <ul className="attempt-list">
            {attempts.slice(0, 4).map((attempt) => (
              <li className="attempt-row" key={attempt.id}>
                <div>
                  <strong>{attempt.testTitle}</strong>
                  <span className="attempt-meta">
                    {new Date(attempt.finishedAt).toLocaleDateString()} ·{" "}
                    {attempt.correct}/{attempt.total} correct
                  </span>
                </div>
                <span className="chip">
                  {attempt.total > 0 ? `Band ${attempt.overallBand.toFixed(1)}` : "Not scored"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
