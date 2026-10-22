"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/lib/useAppData";
import { cleanPrompt } from "@/lib/prompt";
import type { QuestionEntry } from "@/lib/content";
import { SKILL_LABEL } from "@/lib/types";

export default function AttemptReview() {
  const { loaded, attempts } = useAppData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entries, setEntries] = useState<QuestionEntry[]>([]);
  const [fetching, setFetching] = useState(false);

  const attempt = useMemo(() => {
    if (!attempts.length) return null;
    return attempts.find((a) => a.id === selectedId) ?? attempts[0];
  }, [attempts, selectedId]);

  useEffect(() => {
    if (!attempt) return;
    let cancelled = false;
    setFetching(true);
    const params = new URLSearchParams({ testId: attempt.testId, limit: "200" });
    fetch(`/api/questions?${params.toString()}`)
      .then((res) => res.json())
      .then((data: { items: QuestionEntry[] }) => {
        if (!cancelled) setEntries(data.items ?? []);
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (!loaded) return null;

  if (!attempt) {
    return (
      <div className="dash-page">
        <div className="dash-head">
          <h1 className="dash-title">Review</h1>
        </div>
        <div className="dash-card dash-empty">
          No attempts yet. Finish a practice set or diagnostic and your answers appear here.
        </div>
      </div>
    );
  }

  const skills = Object.keys(attempt.perSkill) as Array<keyof typeof attempt.perSkill>;

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Review — {attempt.testTitle}</h1>
          <p className="dash-sub">
            {new Date(attempt.finishedAt).toLocaleString()} · {attempt.correct}/{attempt.total} correct
          </p>
        </div>
        <div className="dash-head-actions">
          {attempts.length > 1 && (
            <select
              className="qb-select"
              value={attempt.id}
              onChange={(e) => setSelectedId(e.target.value)}
              aria-label="Choose attempt"
            >
              {attempts.slice(0, 30).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.testTitle} — {new Date(item.finishedAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          )}
          <span className="chip">Band {attempt.overallBand.toFixed(1)}</span>
        </div>
      </div>

      <div className="dash-stat-grid">
        {skills.map((skill) => {
          const bucket = attempt.perSkill[skill]!;
          return (
            <div className="dash-stat-card" key={skill}>
              <span className="dash-stat-label">{SKILL_LABEL[skill]}</span>
              <span className="dash-stat-value accent">{bucket.band.toFixed(1)}</span>
              <span className="attempt-meta">{bucket.correct}/{bucket.total} correct</span>
            </div>
          );
        })}
      </div>

      <div className="dash-card">
        <h2 className="dash-section-title">Every question</h2>
        {fetching ? (
          <p className="dash-empty">Loading questions…</p>
        ) : (
          <div className="review-list">
            {entries.map(({ question, skill }) => {
              const given = attempt.answers[question.id];
              const missed = attempt.missed.includes(question.id) || (question.graded === false && !given);
              const answeredText = Array.isArray(given) ? given.join(", ") : given;
              return (
                <div className="review-item" key={question.id}>
                  <div className="review-item-head">
                    <span className="session-chip">{SKILL_LABEL[skill]}</span>
                    <span className="session-chip">{question.type.toUpperCase()}</span>
                    {question.graded === false ? (
                      <span className="chip">Not auto-scored</span>
                    ) : (
                      <span className={`chip ${missed ? "bad" : "good"}`}>
                        {missed ? "Missed" : "Correct"}
                      </span>
                    )}
                  </div>
                  <p className="session-question">{cleanPrompt(question.prompt)}</p>
                  <p className="review-answer">
                    Your answer: <strong>{answeredText || "—"}</strong>
                    {question.graded !== false && (
                      <> · Correct: <strong>{String(question.answer)}</strong></>
                    )}
                  </p>
                  {question.explanation && (
                    <p className="session-explanation">{question.explanation}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
