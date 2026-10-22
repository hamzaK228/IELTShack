"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { QuestionEntry } from "@/lib/content";
import { SKILL_LABEL } from "@/lib/types";

const ROUNDS = 5;
const SECONDS = 15;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function DuelArena({ entries }: { entries: QuestionEntry[] }) {
  const pool = useMemo(
    () => entries.filter((entry) => entry.question.options?.length && entry.question.graded !== false),
    [entries]
  );

  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle");
  const [round, setRound] = useState(0);
  const [questions, setQuestions] = useState<QuestionEntry[]>([]);
  const [botAnswers, setBotAnswers] = useState<boolean[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(SECONDS);
  const [you, setYou] = useState(0);
  const [bot, setBot] = useState(0);
  const advance = useRef<number | null>(null);

  const current = questions[round];

  useEffect(() => () => {
    if (advance.current) window.clearTimeout(advance.current);
  }, []);

  useEffect(() => {
    if (phase !== "playing" || revealed) return;
    if (timeLeft <= 0) {
      setRevealed(true);
      return;
    }
    const timer = window.setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, revealed, timeLeft]);

  useEffect(() => {
    if (!revealed) return;
    if (botAnswers[round]) setBot((v) => v + 1);
    const timer = window.setTimeout(() => {
      if (round >= ROUNDS - 1) {
        setPhase("done");
      } else {
        setRound((r) => r + 1);
        setPicked(null);
        setRevealed(false);
        setTimeLeft(SECONDS);
      }
    }, 1100);
    advance.current = timer;
    return () => window.clearTimeout(timer);
  }, [revealed, round, botAnswers]);

  function start() {
    const pickedQuestions = shuffle(pool).slice(0, ROUNDS);
    setQuestions(pickedQuestions);
    setBotAnswers(pickedQuestions.map(() => Math.random() < 0.68));
    setRound(0);
    setPicked(null);
    setRevealed(false);
    setTimeLeft(SECONDS);
    setYou(0);
    setBot(0);
    setPhase("playing");
  }

  function choose(optionId: string) {
    if (!current || revealed) return;
    setPicked(optionId);
    setRevealed(true);
    const correct = String(current.question.answer) === optionId;
    if (correct) setYou((v) => v + 1);
  }

  if (phase === "idle") {
    return (
      <div className="dash-page">
        <div className="dash-head">
          <div>
            <h1 className="dash-title">Duel</h1>
            <p className="dash-sub">Five questions. Fifteen seconds each. One rival. Winner takes the XP.</p>
          </div>
          <span className="chip">1v1</span>
        </div>
        <div className="dash-card duel-intro">
          <div className="duel-vs">
            <div className="duel-player">
              <span className="duel-avatar">🧑‍🎓</span>
              <strong>You</strong>
            </div>
            <span className="duel-vs-label">VS</span>
            <div className="duel-player">
              <span className="duel-avatar rival">🤖</span>
              <strong>Rival · 1180</strong>
            </div>
          </div>
          <p className="attempt-meta">
            {pool.length} questions available · mixed skills · the rival answers correctly about
            two-thirds of the time.
          </p>
          <button className="btn btn-primary" onClick={start} disabled={pool.length === 0}>
            Enter the arena →
          </button>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    const won = you > bot;
    const tie = you === bot;
    return (
      <div className="dash-page">
        <div className="dash-head">
          <div>
            <h1 className="dash-title">{won ? "Victory." : tie ? "Draw." : "Defeat."}</h1>
            <p className="dash-sub">You {you} — {bot} Rival</p>
          </div>
          <span className={`chip ${won ? "good" : tie ? "" : "bad"}`}>
            {won ? "+180 XP" : tie ? "+60 XP" : "+20 XP"}
          </span>
        </div>
        <div className="dash-card">
          <div className="duel-result">
            <div><span className="dash-stat-label">You</span><span className="dash-stat-value accent">{you}</span></div>
            <div><span className="dash-stat-label">Rival</span><span className="dash-stat-value">{bot}</span></div>
          </div>
          <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <button className="btn btn-primary" onClick={start}>Rematch →</button>
            <button className="btn btn-ghost" onClick={() => setPhase("idle")}>Back</button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) return null;
  const { question, skill } = current;
  const correctId = String(question.answer);

  return (
    <div className="dash-page">
      <div className="duel-scoreboard">
        <div className="duel-side">
          <span className="attempt-meta">You</span>
          <strong>{you}</strong>
        </div>
        <div className="duel-center">
          <span className="attempt-meta">Round {round + 1} / {ROUNDS}</span>
          <span className={`duel-clock${timeLeft <= 5 ? " danger" : ""}`}>{timeLeft}s</span>
        </div>
        <div className="duel-side right">
          <span className="attempt-meta">Rival</span>
          <strong>{bot}</strong>
        </div>
      </div>

      <div className="session-progress-bar" aria-hidden="true">
        <span style={{ width: `${((round + 1) / ROUNDS) * 100}%` }} />
      </div>

      <div className="dash-card">
        <div className="review-item-head">
          <span className="session-chip">{SKILL_LABEL[skill]}</span>
          <span className="session-chip">{question.type.toUpperCase()}</span>
        </div>
        <p className="session-question">{question.prompt}</p>
        <div className="session-choices">
          {question.options?.map((option) => {
            const cls = [
              "session-choice",
              picked === option.id ? "selected" : "",
              revealed && option.id === correctId ? "right" : "",
              revealed && picked === option.id && option.id !== correctId ? "wrong" : "",
            ].filter(Boolean).join(" ");
            return (
              <button
                key={option.id}
                type="button"
                className={cls}
                onClick={() => choose(option.id)}
                disabled={revealed}
              >
                <span className="session-choice-label">{option.id}</span>
                <span className="session-choice-text">{option.text}</span>
              </button>
            );
          })}
        </div>
        {revealed && (
          <p className="attempt-meta" style={{ marginTop: ".8rem" }}>
            {botAnswers[round] ? "Rival answered correctly." : "Rival missed this one."}
            {question.explanation ? ` ${question.explanation}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
