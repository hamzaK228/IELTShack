"use client";

import { useState } from "react";
import type { QuestionEntry } from "@/lib/content";
import { SKILL_LABEL } from "@/lib/types";

export default function QuestionRow({
  entry,
  saved,
  onToggleSave,
}: {
  entry: QuestionEntry;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { question } = entry;

  return (
    <div className="review-item">
      <div className="review-item-head">
        <span className="session-chip">{SKILL_LABEL[entry.skill]}</span>
        <span className="session-chip">{question.type.toUpperCase()}</span>
        {question.difficulty && (
          <span className="session-chip">{"●".repeat(question.difficulty)}</span>
        )}
        <span className="attempt-meta" style={{ marginLeft: "auto" }}>
          {entry.testTitle}
        </span>
      </div>

      <p className="session-question">{question.prompt}</p>

      <div className="review-item-actions">
        <button className="session-chip session-ref-btn" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide answer" : "Show answer"}
        </button>
        <button
          className={`session-chip session-ref-btn${saved ? " active" : ""}`}
          onClick={onToggleSave}
        >
          {saved ? "★ Saved" : "☆ Save"}
        </button>
      </div>

      {open && (
        <div className="review-reveal">
          <p className="review-answer">
            Answer: <strong>{String(question.answer)}</strong>
          </p>
          {question.explanation && (
            <p className="session-explanation">{question.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
