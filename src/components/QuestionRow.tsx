"use client";

import { useState } from "react";
import type { QuestionEntry } from "@/lib/content";
import { cleanPrompt } from "@/lib/prompt";
import { reportQuestion } from "@/lib/remote";
import { SKILL_LABEL } from "@/lib/types";

export default function QuestionRow({
  entry,
  saved,
  onToggleSave,
  onMarkReviewed,
}: {
  entry: QuestionEntry;
  saved: boolean;
  onToggleSave: () => void;
  onMarkReviewed?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const { question } = entry;
  const answer = Array.isArray(question.answer)
    ? question.answer.join(", ")
    : question.options?.find((option) => option.id === String(question.answer))
      ? `${question.answer} — ${question.options.find((option) => option.id === String(question.answer))!.text}`
      : String(question.answer);

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

      <p className="session-question">{cleanPrompt(question.prompt)}</p>

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
        {onMarkReviewed && (
          <button className="session-chip session-ref-btn" onClick={onMarkReviewed}>
            ✓ Got it
          </button>
        )}
        <button
          className="session-chip session-ref-btn"
          disabled={reported}
          onClick={async () => {
            if (reported) return;
            const reason = window.prompt("What is wrong with this question?");
            if (!reason?.trim()) return;
            setReported(await reportQuestion(entry.testId, question.id, reason));
          }}
        >
          {reported ? "Reported" : "⚑ Report"}
        </button>
      </div>

      {open && (
        <div className="review-reveal">
          <p className="review-answer">
            Answer: <strong>{answer}</strong>
          </p>
          {question.explanation && (
            <p className="session-explanation">{question.explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
