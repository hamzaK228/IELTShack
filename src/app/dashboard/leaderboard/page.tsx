"use client";

import { computeStreak, levelFor, useAppData } from "@/lib/useAppData";

const DEMO_PLAYERS = [
  { name: "Aisha", xp: 4820 },
  { name: "Nguyen", xp: 4310 },
  { name: "Miu", xp: 3975 },
  { name: "John", xp: 3540 },
  { name: "Diego", xp: 2985 },
  { name: "Shikhar", xp: 2610 },
  { name: "Trung", xp: 2140 },
  { name: "Tobe", xp: 1720 },
];

export default function ProgressPage() {
  const { loaded, profile, attempts } = useAppData();
  if (!loaded || !profile) return null;

  const xp = attempts.reduce((sum, a) => sum + a.correct * 10 + 20, 0);
  const level = levelFor(xp);
  const streak = computeStreak(attempts);
  const totalCorrect = attempts.reduce((sum, a) => sum + a.correct, 0);
  const bestBand = attempts.length ? Math.max(...attempts.map((a) => a.overallBand)) : 0;
  const accuracy = attempts.length
    ? Math.round((totalCorrect / attempts.reduce((s, a) => s + a.total, 0)) * 100)
    : 0;

  const badges = [
    { id: "first", icon: "🌱", name: "First steps", earned: attempts.length > 0, hint: "Finish your first session" },
    { id: "sharp", icon: "🎯", name: "Sharpshooter", earned: accuracy >= 70, hint: "Reach 70% accuracy" },
    { id: "streak", icon: "🔥", name: "Consistent", earned: streak >= 3, hint: "Practise 3 days in a row" },
    { id: "band", icon: "📈", name: "Band up", earned: bestBand >= 7, hint: "Score Band 7.0 or higher" },
    { id: "grind", icon: "💪", name: "Grinder", earned: totalCorrect >= 50, hint: "Answer 50 questions correctly" },
    { id: "master", icon: "🏆", name: "Mastery", earned: bestBand >= 8, hint: "Score Band 8.0 or higher" },
  ];

  const board = [...DEMO_PLAYERS, { name: `${profile.name} (you)`, xp }]
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 9);

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Your progress</h1>
          <p className="dash-sub">Level {level.level}: {level.title} · {xp.toLocaleString()} XP</p>
        </div>
        <div className="dash-head-actions">
          <span className="chip">🔥 {streak}-day streak</span>
        </div>
      </div>

      <div className="dash-stat-grid">
        <div className="dash-stat-card">
          <span className="dash-stat-label">Level</span>
          <span className="dash-stat-value accent">{level.level}</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-label">XP</span>
          <span className="dash-stat-value">{xp.toLocaleString()}</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-label">Best band</span>
          <span className="dash-stat-value">{bestBand ? bestBand.toFixed(1) : "—"}</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-label">Correct answers</span>
          <span className="dash-stat-value">{totalCorrect}</span>
        </div>
      </div>

      <div className="dash-card">
        <h2 className="dash-section-title">Badges</h2>
        <div className="app-badge-grid">
          {badges.map((badge) => (
            <div className={`app-badge${badge.earned ? " earned" : ""}`} key={badge.id}>
              <span className="app-badge-icon" aria-hidden="true">{badge.earned ? badge.icon : "🔒"}</span>
              <div>
                <strong>{badge.name}</strong>
                <span className="attempt-meta">{badge.earned ? "Unlocked" : badge.hint}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="dash-card">
        <h2 className="dash-section-title">Weekly leaderboard</h2>
        <ul className="attempt-list">
          {board.map((player, index) => (
            <li className={`attempt-row${player.name.includes("(you)") ? " me" : ""}`} key={player.name}>
              <div>
                <strong>#{index + 1} {player.name}</strong>
                <span className="attempt-meta">{Math.floor(player.xp / 250) + 1} · {player.xp.toLocaleString()} XP</span>
              </div>
              {index === 0 && <span className="chip">Top 1%</span>}
            </li>
          ))}
        </ul>
        <p className="attempt-meta" style={{ marginTop: ".8rem" }}>
          Demo board — real multiplayer rankings arrive with the community phase.
        </p>
      </div>
    </div>
  );
}
