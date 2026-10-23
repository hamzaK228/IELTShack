"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { bandForSkill, formatDuration, overallBand } from "@/lib/bands";
import { diagnoseAnswer, isAnswered, isCorrect } from "@/lib/answers";
import { cleanPrompt, groupQuestions, hasInlineBlank, inlineSegments } from "@/lib/prompt";
import AiFeedback from "./AiFeedback";
import { QuestionImage } from "./QuestionImage";
import { saveAttempt } from "@/lib/storage";
import {
  SKILL_LABEL,
  type AnswerValue,
  type Answers,
  type Question,
  type Section,
  type Skill,
  type SkillScore,
  type Test,
} from "@/lib/types";

function optionLetter(optionId: string, index: number) {
  return optionId.length <= 2 ? optionId : String.fromCharCode(65 + index);
}

function formatAnswer(question: Question) {
  if (Array.isArray(question.answer)) return question.answer.join(", ");
  const option = question.options?.find((item) => item.id === String(question.answer));
  return option ? `${option.id} — ${option.text}` : String(question.answer);
}

function QuestionBlock({
  section,
  question,
  number,
  value,
  onChange,
  reveal,
}: {
  section: Section;
  question: Question;
  number: number;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  reveal: boolean;
}) {
  const multiple = question.type === "multi";
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const correct = isCorrect(question, value);
  const display = cleanPrompt(question.prompt);
  const inline = (question.type === "gap" || question.type === "short") && hasInlineBlank(question.prompt);
  const segments = inline ? inlineSegments(question.prompt) : [];
  const inlineOptions = inline && question.options?.length ? question.options : null;

  function toggle(optionId: string) {
    if (multiple) {
      const next = selected.includes(optionId)
        ? selected.filter((v) => v !== optionId)
        : [...selected, optionId];
      onChange(next);
    } else {
      onChange(optionId);
    }
  }

  return (
    <div className={`q-block${reveal ? (correct ? " q-correct" : " q-wrong") : ""}`} id={`q-${question.id}`}>
      <div className="q-head">
        <span className="q-num">{number}</span>
        {inline ? (
          <p className="q-prompt">
            {segments.map((segment, index) => {
              if (segment.kind === "text") {
                return <Fragment key={index}>{segment.text}</Fragment>;
              }
              if (!segment.target) {
                return (
                  <span className="q-inline-static" key={index}>
                    {segment.number ? `(${segment.number})` : ""} ______
                  </span>
                );
              }
              if (inlineOptions) {
                return (
                  <select
                    key={index}
                    className={`q-inline q-inline-select${reveal ? (correct ? " ok" : " bad") : ""}`}
                    value={typeof value === "string" ? value : ""}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={reveal}
                    aria-label={`Question ${number}`}
                  >
                    <option value="">— choose —</option>
                    {inlineOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.id} — {option.text}
                      </option>
                    ))}
                  </select>
                );
              }
              return (
                <input
                  key={index}
                  className={`q-inline${reveal ? (correct ? " ok" : " bad") : ""}`}
                  value={typeof value === "string" ? value : ""}
                  onChange={(e) => onChange(e.target.value)}
                  disabled={reveal}
                  aria-label={`Question ${number}`}
                />
              );
            })}
          </p>
        ) : (
          <p className="q-prompt">{display}</p>
        )}
      </div>

      {question.image && <QuestionImage src={question.image} alt={display || "Question diagram or table"} />}

      {inline ? null : question.options?.length ? (
        <div className="q-choices">
          {question.options.map((option, index) => {
            const isSelected = selected.includes(option.id);
            return (
              <label
                key={option.id}
                className={[
                  "q-choice",
                  isSelected ? "selected" : "",
                  reveal && option.id === question.answer ? "right" : "",
                  reveal && isSelected && option.id !== question.answer ? "wrong" : "",
                ].filter(Boolean).join(" ")}
              >
                <input
                  type={multiple ? "checkbox" : "radio"}
                  name={`q-${question.id}`}
                  checked={isSelected}
                  onChange={() => toggle(option.id)}
                  disabled={reveal}
                />
                <span className="q-letter">{optionLetter(option.id, index)}</span>
                <span className="q-text">{option.text}</span>
              </label>
            );
          })}
        </div>
      ) : question.type === "writing" || question.type === "speaking" || question.graded === false ? (
        <div className="q-writing">
        <textarea
          className="field-input q-textarea"
          rows={question.type === "writing" ? 12 : 5}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            question.type === "writing"
              ? "Write your answer here (not auto-scored)…"
              : "Notes / voice-transcript placeholder…"
          }
          disabled={reveal}
        />
        {question.type === "writing" && (
          <span className="attempt-meta">
            {typeof value === "string" ? value.trim().split(/\s+/).filter(Boolean).length : 0} words
          </span>
        )}
        {question.type === "writing" && (
          <AiFeedback
            mode="writing"
            prompt={display}
            text={typeof value === "string" ? value : ""}
            compact
          />
        )}
        </div>
      ) : (
        <input
          className="field-input q-input"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your answer"
          disabled={reveal}
        />
      )}

      {reveal && (
        <div className={`q-reveal ${question.graded === false ? "" : correct ? "ok" : "bad"}`}>
          {question.graded === false ? (
            <strong>Saved for review.</strong>
          ) : (
            <>
              <strong>{correct ? "Correct" : "Incorrect"}</strong>
              <span> Answer: <strong>{formatAnswer(question)}</strong></span>
            </>
          )}
          {question.explanation && <p className="session-explanation">{question.explanation}</p>}
        </div>
      )}
    </div>
  );
}

function groupInstruction(type: string) {
  switch (type) {
    case "options":
      return "Choose the correct heading for each paragraph from the list of headings below.";
    case "tfng":
      return "Do the following statements agree with the information given in the passage? Write TRUE, FALSE or NOT GIVEN.";
    case "gap":
      return "Complete the notes below. Write ONE WORD ONLY for each answer.";
    case "short":
      return "Answer the questions below with a word or short phrase.";
    case "matching":
      return "Match each item with the correct option.";
    case "mcq":
      return "Choose the correct letter, A, B, C or D.";
    case "multi":
      return "Choose the correct letters.";
    default:
      return "";
  }
}

function OptionsGroup({
  options,
  questions,
  offset,
  answers,
  onAnswer,
  reveal,
  sharedPrompt,
}: {
  options: Array<{ id: string; text: string }>;
  questions: Question[];
  offset: number;
  answers: Answers;
  onAnswer: (questionId: string, value: AnswerValue) => void;
  reveal: boolean;
  sharedPrompt?: string | null;
}) {
  return (
    <div className="match-group">
      <div className="match-options">
        <strong>Options</strong>
        <ul>
          {options.map((option) => (
            <li key={option.id}>
              <span className="match-letter">{option.id}</span>
              {option.text}
            </li>
          ))}
        </ul>
      </div>

      {sharedPrompt && <p className="match-shared">{sharedPrompt}</p>}
      {questions.map((question, i) => {
        const value = typeof answers[question.id] === "string" ? (answers[question.id] as string) : "";
        const ok = isCorrect(question, value);
        return (
          <div
            className={`match-row${reveal ? (ok ? " ok" : " bad") : ""}`}
            key={question.id}
            id={`q-${question.id}`}
          >
            <span className="q-num">{offset + i + 1}</span>
            <span className="match-prompt">
              {sharedPrompt ? `Answer ${i + 1}` : cleanPrompt(question.prompt)}
            </span>
            <select
              className="qb-select match-select"
              value={value}
              onChange={(e) => onAnswer(question.id, e.target.value)}
              disabled={reveal}
              aria-label={`Question ${offset + i + 1}`}
            >
              <option value="">—</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>{option.id}</option>
              ))}
            </select>
            {reveal && (
              <span className={`match-result ${ok ? "ok" : "bad"}`}>
                {ok ? "✓" : `✗ ${formatAnswer(question)}`}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function readableParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).flatMap((block) => {
    const trimmed = block.trim();
    if (trimmed.length <= 650) return trimmed ? [trimmed] : [];
    const sentences = trimmed.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) ?? [trimmed];
    const out: string[] = [];
    let current = "";
    for (const sentence of sentences) {
      if (current && current.length + sentence.length > 480) {
        out.push(current.trim());
        current = sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim()) out.push(current.trim());
    return out;
  });
}

export type RunnerResults = {
  perSkill: Partial<Record<Skill, SkillScore>>;
  missed: Array<{ section: Section; question: Question }>;
  overall: number;
  correct: number;
  total: number;
  answers: Answers;
  startedAt: string;
  durationSeconds: number;
};

export default function SectionRunner({
  test,
  mode,
  introTitle,
  embedded = false,
  sessionKey,
  onFinished,
}: {
  test: Test;
  mode: "exam" | "practice";
  introTitle?: string;
  embedded?: boolean;
  sessionKey?: string;
  onFinished?: (results: RunnerResults) => void;
}) {
  const [started, setStarted] = useState(embedded);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [submittedSections, setSubmittedSections] = useState<Record<string, boolean>>({});
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [savedAttempt, setSavedAttempt] = useState(false);
  const [startedAt, setStartedAt] = useState(embedded ? new Date().toISOString() : "");
  const reported = useRef(false);
  const [focus, setFocus] = useState(false);
  const [runMode, setRunMode] = useState<"exam" | "practice">(
    (test.durationMinutes ?? 0) >= 30 ? "exam" : mode
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!started || finished) return;
    const parsedStart = startedAt ? new Date(startedAt).getTime() : Date.now();
    const start = Number.isFinite(parsedStart) ? parsedStart : Date.now();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [started, finished, startedAt]);

  const totalSeconds = runMode === "exam" && test.durationMinutes ? test.durationMinutes * 60 : 0;
  const remaining = totalSeconds ? Math.max(0, totalSeconds - elapsed) : 0;

  useEffect(() => {
    if (totalSeconds && started && !finished && elapsed >= totalSeconds) setFinished(true);
  }, [elapsed, totalSeconds, started, finished]);

  const restored = useRef(false);
  const storageKey = sessionKey ?? `ieltshack:runner:${test.id}`;
  const shouldPersist = Boolean(sessionKey) || !embedded;

  useEffect(() => {
    if (!shouldPersist || typeof window === "undefined" || restored.current) return;
    restored.current = true;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        answers?: Answers;
        sectionIndex?: number;
        submittedSections?: Record<string, boolean>;
        startedAt?: string;
        runMode?: "exam" | "practice";
      };
      if (!saved.startedAt || !Number.isFinite(new Date(saved.startedAt).getTime())) return;
      setAnswers(saved.answers ?? {});
      setSectionIndex(Math.max(0, Math.min(test.sections.length - 1, saved.sectionIndex ?? 0)));
      setSubmittedSections(saved.submittedSections ?? {});
      setStartedAt(saved.startedAt);
      setRunMode(saved.runMode === "practice" ? "practice" : "exam");
      setStarted(true);
    } catch {
      // Ignore corrupt session state.
    }
  }, [shouldPersist, storageKey, test.sections.length]);

  useEffect(() => {
    if (!shouldPersist || typeof window === "undefined") return;
    if (!started || finished) {
      if (finished) window.sessionStorage.removeItem(storageKey);
      return;
    }
    try {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({ answers, sectionIndex, submittedSections, startedAt, runMode })
      );
    } catch {
      // Storage can be unavailable in private modes.
    }
  }, [shouldPersist, storageKey, started, finished, answers, sectionIndex, submittedSections, startedAt, runMode]);

  useEffect(() => {
    const onChange = () => setFocus(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const section = test.sections[sectionIndex];
  const sectionSubmitted = Boolean(section && submittedSections[section.id]);
  const reveal = runMode === "practice" && sectionSubmitted;
  const isLast = sectionIndex === test.sections.length - 1;

  const offsets = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;
    for (const s of test.sections) {
      map[s.id] = total;
      total += s.questions.length;
    }
    return map;
  }, [test]);

  const graded = useMemo(
    () => test.sections.flatMap((s) => s.questions.filter((q) => q.graded !== false).map((q) => ({ section: s, question: q }))),
    [test]
  );

  const results = useMemo(() => {
    if (!finished) return null;
    const perSkill: Partial<Record<Skill, SkillScore>> = {};
    const missed: Array<{ section: Section; question: Question }> = [];
    for (const entry of graded) {
      const ok = isCorrect(entry.question, answers[entry.question.id]);
      const bucket = (perSkill[entry.section.skill] ??= { correct: 0, total: 0, band: 0 });
      bucket.total += 1;
      if (ok) bucket.correct += 1;
      else missed.push(entry);

      const typeBucket = (bucket.byType ??= {});
      const typed = (typeBucket[entry.question.type] ??= { correct: 0, total: 0 });
      typed.total += 1;
      if (ok) typed.correct += 1;
    }
    for (const skill of Object.keys(perSkill) as Skill[]) {
      const bucket = perSkill[skill]!;
      bucket.band = bandForSkill(skill, bucket.correct, bucket.total);
    }
    const bands = Object.values(perSkill)
      .map((score) => score!.band)
      .filter((band) => Number.isFinite(band));
    return {
      perSkill,
      missed,
      overall: overallBand(bands),
      correct: graded.length - missed.length,
      total: graded.length,
      answers,
      startedAt: startedAt || new Date().toISOString(),
      durationSeconds: elapsed,
    };
  }, [finished, graded, answers, startedAt, elapsed]);

  useEffect(() => {
    if (!embedded || !finished || !results || reported.current) return;
    reported.current = true;
    onFinished?.(results);
  }, [embedded, finished, results, onFinished]);

  useEffect(() => {
    if (embedded) return;
    if (!finished || !results || savedAttempt) return;
    setSavedAttempt(true);
    const finishedAt = new Date().toISOString();
    saveAttempt({
      id: `attempt-${Date.now()}`,
      testId: test.id,
      testTitle: test.title,
      mode: runMode,
      startedAt: results.startedAt || finishedAt,
      finishedAt,
      durationSeconds: results.durationSeconds,
      answers: results.answers,
      perSkill: results.perSkill,
      overallBand: results.overall,
      correct: results.correct,
      total: results.total,
      missed: results.missed.map((m) => m.question.id),
    });
  }, [embedded, finished, results, savedAttempt, test, runMode]);

  function begin(nextMode: "exam" | "practice" = runMode) {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(storageKey);
    }
    setRunMode(nextMode);
    setStartedAt(new Date().toISOString());
    setStarted(true);
  }

  function setAnswer(questionId: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function submitSection() {
    if (!section) return;
    setSubmittedSections((prev) => ({ ...prev, [section.id]: true }));
  }

  function submitTest() {
    if (embedded) {
      const message = isLast
        ? "Finish this phase and continue?"
        : "Finish this phase now? Remaining sections in this phase will be skipped.";
      if (window.confirm(message)) setFinished(true);
      return;
    }
    if (window.confirm("Submit the whole test and see your score?")) setFinished(true);
  }

  function goToSection(index: number) {
    setSectionIndex(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("session-shell")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleFocus() {
    const shell = document.getElementById("session-shell");
    if (!focus) {
      try {
        await shell?.requestFullscreen();
        setFocus(true);
      } catch {
        setFocus(true);
      }
      return;
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } finally {
      setFocus(false);
    }
  }

  function advance() {
    if (isLast) {
      setFinished(true);
      return;
    }
    goToSection(sectionIndex + 1);
  }

  if (!started && !embedded) {
    return (
      <div className="dash-page">
        <div className="dash-head">
          <div>
            <h1 className="dash-title">{introTitle ?? test.title}</h1>
            <p className="dash-sub">{test.description ?? "A timed IELTS practice set."}</p>
          </div>
        </div>
        <div className="dash-card">
          <div className="dash-stat-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
            <div>
              <span className="dash-stat-label">Sections</span>
              <span className="dash-stat-value">{test.sections.length}</span>
            </div>
            <div>
              <span className="dash-stat-label">Auto-scored</span>
              <span className="dash-stat-value">{graded.length}</span>
            </div>
            <div>
              <span className="dash-stat-label">Time guide</span>
              <span className="dash-stat-value">{test.durationMinutes} min</span>
            </div>
          </div>
        </div>
        <div className="dash-card">
          <h2 className="dash-section-title">Sections</h2>
          <ul className="attempt-list">
            {test.sections.map((s) => (
              <li className="attempt-row" key={s.id}>
                <div>
                  <strong>{s.title}</strong>
                  <span className="attempt-meta">
                    {SKILL_LABEL[s.skill]} · {s.questions.length} question
                    {s.questions.length === 1 ? "" : "s"}
                  </span>
                </div>
                <span className="chip">{SKILL_LABEL[s.skill]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={() => begin(runMode)}>
            {runMode === "exam" ? "Start exam →" : "Begin →"}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => begin(runMode === "exam" ? "practice" : "exam")}
          >
            {runMode === "exam" ? "Practice mode" : "Exam mode"}
          </button>
          <Link className="btn btn-ghost" href="/dashboard">Back to dashboard</Link>
        </div>
        <p className="attempt-meta" style={{ marginTop: ".6rem" }}>
          {runMode === "exam"
            ? `Exam mode: ${test.durationMinutes ?? 0}-minute timer for the whole test, switch sections freely, one submission.`
            : "Practice mode: check answers after each section without a countdown."}
        </p>
      </div>
    );
  }

  if (finished && results && !embedded) {
    const entries = graded;
    return (
      <div className="dash-page">
        <div className="dash-head">
          <div>
            <h1 className="dash-title">
              {results.total > 0 ? "Test complete." : "Submitted for review."}
            </h1>
            <p className="dash-sub">
              {results.total > 0
                ? `${results.correct}/${results.total} correct · ${formatDuration(elapsed)}`
                : `Writing and speaking prompts saved · ${formatDuration(elapsed)}`}
            </p>
          </div>
          {results.total > 0 && <span className="chip">Band {results.overall.toFixed(1)}</span>}
        </div>

        <div className="dash-stat-grid">
          {(Object.keys(results.perSkill) as Skill[]).map((skill) => {
            const bucket = results.perSkill[skill]!;
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
          <h2 className="dash-section-title">Answer sheet</h2>
          <div className="result-table-wrap">
            <table className="result-table">
              <thead>
                <tr><th>#</th><th>Question</th><th>Your answer</th><th>Correct</th><th>Result</th></tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => {
                  const given = answers[entry.question.id];
                  const ok = isCorrect(entry.question, given);
                  const diagnosis = diagnoseAnswer(entry.question, given);
                  const resultLabel = ok
                    ? "✓"
                    : diagnosis === "spelling"
                      ? "Spelling"
                      : diagnosis === "format"
                        ? "Format"
                        : "✗";
                  return (
                    <tr key={entry.question.id}>
                      <td>{i + 1}</td>
                      <td className="result-q">{cleanPrompt(entry.question.prompt)}</td>
                      <td>{Array.isArray(given) ? given.join(", ") : given || "—"}</td>
                      <td>{formatAnswer(entry.question)}</td>
                      <td><span className={`chip ${ok ? "good" : "bad"}`}>{resultLabel}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {results.missed.length > 0 && (
          <div className="dash-card">
            <h2 className="dash-section-title">Review your misses</h2>
            <div className="review-list">
              {results.missed.map(({ section: s, question }) => (
                <div className="review-item" key={question.id}>
                  <span className="session-chip">{SKILL_LABEL[s.skill]}</span>
                  <p className="session-question">{cleanPrompt(question.prompt)}</p>
                  <p className="review-answer">
                    Your answer: <strong>{String(answers[question.id] ?? "—")}</strong> · Correct:{" "}
                    <strong>{formatAnswer(question)}</strong>
                  </p>
                  {["spelling", "format"].includes(diagnoseAnswer(question, answers[question.id])) && (
                    <p className="attempt-meta">
                      Close: this is a {diagnoseAnswer(question, answers[question.id]) === "spelling" ? "spelling" : "format"} issue, not a different answer.
                    </p>
                  )}
                  {question.explanation && <p className="session-explanation">{question.explanation}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap" }}>
          <Link className="btn btn-primary" href="/dashboard/test/review">Full review →</Link>
          <button
            className="btn btn-ghost"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.sessionStorage.removeItem(storageKey);
              }
              setAnswers({});
              setSubmittedSections({});
              setSectionIndex(0);
              setElapsed(0);
              setFinished(false);
              setSavedAttempt(false);
              setStarted(false);
            }}
          >
            Retake
          </button>
          <Link className="btn btn-ghost" href="/dashboard">Dashboard</Link>
        </div>
      </div>
    );
  }

  if (embedded && finished) return null;
  if (!section) return null;

  const offset = offsets[section.id] ?? 0;
  const answeredCount = section.questions.filter((q) => isAnswered(q, answers[q.id])).length;
  const hasPassage = Boolean(section.passage?.text?.trim());
  const hasLayout = Boolean(section.layout?.template);
  const showTranscript = section.skill === "listening" && !section.audio && section.passage;

  return (
    <div className={`session-shell${focus ? " focus-mode" : ""}`} id="session-shell">
      <div className="session-top">
        <div className="session-meta">
          <span className="session-qnum">Section {sectionIndex + 1} / {test.sections.length}</span>
          <span className="session-chip skill-chip">{SKILL_LABEL[section.skill]}</span>
          <span className="session-chip">{answeredCount}/{section.questions.length} answered</span>
          <span className="session-spacer" />
          {totalSeconds ? (
            <span className={`session-timer${remaining <= 300 ? " low" : ""}`} aria-label="Time remaining">
              ⏱ {formatDuration(remaining)} left
            </span>
          ) : (
            <span className="session-timer">⏱ {formatDuration(elapsed)}</span>
          )}
          <button
            type="button"
            className="btn btn-ghost focus-toggle"
            onClick={toggleFocus}
            aria-pressed={focus}
          >
            {focus ? "Exit focus" : "Focus mode"}
          </button>
        </div>
        <div className="session-progress-bar" aria-hidden="true">
          <span style={{ width: `${((sectionIndex + 1) / test.sections.length) * 100}%` }} />
        </div>
        {test.sections.length > 1 && (
          <nav className="section-tabs" aria-label="Test sections">
            {test.sections.map((s, i) => {
              const answered = s.questions.filter((q) => isAnswered(q, answers[q.id])).length;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`section-tab${i === sectionIndex ? " active" : ""}`}
                  onClick={() => goToSection(i)}
                  aria-current={i === sectionIndex ? "step" : undefined}
                >
                  <strong>Section {i + 1}</strong>
                  <small>{answered}/{s.questions.length}</small>
                </button>
              );
            })}
          </nav>
        )}
      </div>

      <div className="section-header">
        <h1 className="section-title">{section.title}</h1>
        {section.instructions && <p className="section-instructions">{section.instructions}</p>}
      </div>

      {section.audio && (
        <div className="listener-bar">
          <audio ref={audioRef} controls src={section.audio} preload="metadata">
            Your browser does not support audio playback.
          </audio>
          <div className="listener-tools">
            <span className="attempt-meta">
              {answeredCount}/{section.questions.length} answered
            </span>
            <label className="listener-rate">
              <span className="attempt-meta">Speed</span>
              <select
                className="qb-select"
                defaultValue="1"
                onChange={(e) => {
                  if (audioRef.current) audioRef.current.playbackRate = Number(e.target.value);
                }}
                aria-label="Playback speed"
              >
                <option value="0.75">0.75×</option>
                <option value="1">1×</option>
                <option value="1.25">1.25×</option>
              </select>
            </label>
          </div>
          {section.questions.length > 10 && (
            <nav className="part-tabs" aria-label="Listening parts">
              {Array.from({ length: Math.ceil(section.questions.length / 10) }).map((_, i) => (
                <a key={i} className="part-tab" href={`#part-${i + 1}`}>
                  Part {i + 1}
                </a>
              ))}
            </nav>
          )}
        </div>
      )}

      <div
        className={`section-grid${hasPassage || showTranscript ? " with-passage" : ""}${
          section.questions.some((q) => q.image) ? " has-images" : ""
        }`}
      >
        {(hasPassage || showTranscript) && (
          <aside className="section-passage">
            <span className="session-pane-label">{section.passage?.title ?? "Passage"}</span>
            <div className="section-passage-text">
              {readableParagraphs(section.passage?.text ?? "").map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
            {showTranscript && (
              <p className="attempt-meta">Transcript shown as a practice aid — no audio in this sample.</p>
            )}
          </aside>
        )}

        <div className="section-questions">
          {hasLayout ? (
            <div className="form-layout">
              {section.layout?.title && <h2 className="form-title">{section.layout.title}</h2>}
              {section.layout!.template.split("\n").map((line, lineIndex) => (
                <p className="form-line" key={lineIndex}>
                  {line.split(/(\{\{[^}]+\}\})/g).map((part, partIndex) => {
                    const match = part.match(/^\{\{\s*([\w-]+)\s*\}\}$/);
                    if (!match) return <span key={partIndex}>{part}</span>;
                    const question = section.questions.find((q) => q.id === match[1]);
                    if (!question) return <span key={partIndex}>{part}</span>;
                    const number =
                      offset + section.questions.findIndex((q) => q.id === question.id) + 1;
                    const ok = isCorrect(question, answers[question.id]);
                    return (
                      <span className="form-blank" key={partIndex}>
                        <span className="form-blank-num">{number}</span>
                        <input
                          className={`q-inline${reveal ? (ok ? " ok" : " bad") : ""}`}
                          value={typeof answers[question.id] === "string" ? (answers[question.id] as string) : ""}
                          onChange={(e) => setAnswer(question.id, e.target.value)}
                          disabled={reveal}
                          aria-label={`Question ${number}`}
                        />
                      </span>
                    );
                  })}
                </p>
              ))}

              {reveal && (
                <div className="form-answers">
                  <strong>Answers</strong>
                  <ul>
                    {section.questions.map((q, i) => (
                      <li key={q.id}>
                        <span>{offset + i + 1}.</span> {String(q.answer)}
                        {q.explanation && <em> — {q.explanation}</em>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            (() => {
              const groups = groupQuestions(section.questions);
              let cursor = 0;
              let lastType: string | null = null;
              return groups.map((group, gi) => {
                const start = cursor;
                const count = group.kind === "single" ? 1 : group.questions.length;
                cursor += count;
                const type = group.kind === "options" ? "options" : group.question.type;
                const showHeader = type !== lastType;
                lastType = type;
                let runCount = count;
                if (group.kind === "single") {
                  let k = gi + 1;
                  while (
                    k < groups.length &&
                    groups[k].kind === "single" &&
                    (groups[k] as { kind: "single"; question: Question }).question.type === type
                  ) {
                    runCount += 1;
                    k += 1;
                  }
                }
                const range =
                  runCount > 1
                    ? `Questions ${offset + start + 1}–${offset + start + runCount}`
                    : `Question ${offset + start + 1}`;
                const sharedPrompt =
                  group.kind === "options" &&
                  group.questions.every(
                    (q) => cleanPrompt(q.prompt) === cleanPrompt(group.questions[0].prompt)
                  )
                    ? cleanPrompt(group.questions[0].prompt)
                    : null;
                const headerText =
                  group.kind === "options" && sharedPrompt
                    ? `Choose ${group.questions.length} letter${group.questions.length === 1 ? "" : "s"} from the options below.`
                    : groupInstruction(type);
                const header = showHeader && headerText ? (
                  <div className="q-group-head" key={`head-${start}`}>
                    <div className="q-group-range">{range}</div>
                    <p className="q-group-text">{headerText}</p>
                  </div>
                ) : null;
                const divider =
                  section.skill === "listening" && section.questions.length > 10 && start % 10 === 0 ? (
                    <div className="part-divider" key={`part-${start}`} id={`part-${start / 10 + 1}`}>
                      Part {start / 10 + 1}
                    </div>
                  ) : null;
                return (
                  <Fragment key={group.kind === "single" ? group.question.id : `group-${gi}`}>
                    {divider}
                    {header}
                    {group.kind === "single" ? (
                  <QuestionBlock
                    key={group.question.id}
                    section={section}
                    question={group.question}
                    number={offset + start + 1}
                    value={answers[group.question.id]}
                    onChange={(value) => setAnswer(group.question.id, value)}
                    reveal={reveal}
                  />
                    ) : (
                  <OptionsGroup
                    options={group.options}
                    questions={group.questions}
                    offset={offset + start}
                    answers={answers}
                    onAnswer={setAnswer}
                    reveal={reveal}
                    sharedPrompt={sharedPrompt}
                  />
                    )}
                  </Fragment>
                );
              });
            })()
          )}

          <nav className="q-nav" aria-label="Questions in this section">
            <span className="q-nav-label">{section.skill === "reading" ? "Questions" : "Part"}:</span>
            {section.questions.map((question, i) => {
              const answered = isAnswered(question, answers[question.id]);
              return (
                <a
                  key={question.id}
                  href={`#q-${question.id}`}
                  className={`q-nav-link${answered ? " answered" : ""}`}
                >
                  {offset + i + 1}
                </a>
              );
            })}
          </nav>

          <div className="session-actions">
            {runMode === "practice" ? (
              sectionSubmitted ? (
                <button className="btn btn-primary" onClick={advance}>
                  {isLast ? "See results →" : "Next section →"}
                </button>
              ) : (
                <button className="btn btn-primary" onClick={submitSection} disabled={sectionSubmitted}>
                  Submit section
                </button>
              )
            ) : (
              <>
                {!isLast && (
                  <button className="btn btn-ghost" onClick={advance}>
                    Next section →
                  </button>
                )}
                <button className="btn btn-primary" onClick={submitTest}>
                  {embedded ? "Finish phase" : isLast ? "Submit test" : "Submit test early"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
