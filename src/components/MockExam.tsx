"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SectionRunner, { type RunnerResults } from "./SectionRunner";
import SpeakingPractice from "./SpeakingPractice";
import type { SpeakingPrompt } from "@/lib/prompts";
import type { Skill, Test } from "@/lib/types";

type Props = {
  listening: Test;
  reading: Test;
  writing: Test;
  speaking: SpeakingPrompt;
};

type Phase =
  | { kind: "runner"; skill: Skill; test: Test; label: string; note: string }
  | { kind: "break"; minutes: number; label: string }
  | { kind: "speaking"; label: string }
  | { kind: "summary"; label: string };

function BreakScreen({ minutes, label, onDone }: { minutes: number; label: string; onDone: () => void }) {
  const [left, setLeft] = useState(minutes * 60);
  useEffect(() => {
    if (left <= 0) {
      onDone();
      return;
    }
    const timer = window.setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [left, onDone]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div className="mock-break">
      <span className="dash-stat-label">{label}</span>
      <strong className="mock-break-time">{mm}:{ss}</strong>
      <p className="dash-sub">Stand up, drink water, and come back. The next section starts automatically.</p>
      <button className="btn btn-primary" onClick={onDone}>Continue now →</button>
    </div>
  );
}

export default function MockExam({ listening, reading, writing, speaking }: Props) {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Partial<Record<Skill, RunnerResults>>>({});

  const phases = useMemo<Phase[]>(() => {
    return [
      {
        kind: "runner",
        skill: "listening",
        test: { ...listening, durationMinutes: 30 },
        label: "Listening",
        note: "30 minutes · four parts · audio plays once",
      },
      { kind: "break", minutes: 5, label: "Break after listening" },
      {
        kind: "runner",
        skill: "reading",
        test: { ...reading, durationMinutes: 60 },
        label: "Reading",
        note: "60 minutes · three passages · switch sections freely",
      },
      { kind: "break", minutes: 10, label: "Break after reading" },
      {
        kind: "runner",
        skill: "writing",
        test: { ...writing, durationMinutes: 60 },
        label: "Writing",
        note: "60 minutes · Task 1 and Task 2 · AI feedback",
      },
      { kind: "break", minutes: 5, label: "Break before speaking" },
      { kind: "speaking", label: "Speaking" },
      { kind: "summary", label: "Results" },
    ];
  }, [listening, reading, writing]);

  const phase = phases[index];

  function next() {
    setIndex((value) => Math.min(value + 1, phases.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function restart() {
    setResults({});
    setIndex(0);
    setStarted(true);
  }

  if (!started) {
    return (
      <div className="dash-page mock-page">
        <div className="dash-head">
          <div>
            <h1 className="dash-title">Full mock exam</h1>
            <p className="dash-sub">
              Four skills in one sitting, in exam order, with real section timers and breaks.
            </p>
          </div>
        </div>
        <div className="dash-card">
          <h2 className="dash-section-title">What you will do</h2>
          <ol className="mock-steps">
            <li><strong>Listening</strong><span>30 minutes · one full recording, four parts</span></li>
            <li><strong>Reading</strong><span>60 minutes · three passages, 40 questions, free section switching</span></li>
            <li><strong>Writing</strong><span>60 minutes · Task 1 and Task 2 with AI feedback</span></li>
            <li><strong>Speaking</strong><span>One full cue card · prep, record, transcript and AI feedback</span></li>
          </ol>
          <p className="attempt-meta">
            Breaks are included between sections. You can leave and return, but the phase timers keep running.
          </p>
          <div className="mock-actions">
            <button className="btn btn-primary" onClick={() => setStarted(true)}>Start mock exam →</button>
            <Link className="btn btn-ghost" href="/dashboard">Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase.kind === "summary") {
    const listeningBand = results.listening?.perSkill.listening?.band;
    const readingBand = results.reading?.perSkill.reading?.band;
    const academic =
      listeningBand !== undefined && readingBand !== undefined
        ? Math.round(((listeningBand + readingBand) / 2) * 2) / 2
        : undefined;
    return (
      <div className="dash-page mock-page">
        <div className="dash-head">
          <div>
            <h1 className="dash-title">Mock exam complete</h1>
            <p className="dash-sub">Listening and reading are scored; writing and speaking feedback is in their sections.</p>
          </div>
        </div>
        <div className="dash-card">
          <div className="mock-result-grid">
            <div><span className="dash-stat-label">Listening</span><strong className="dash-stat-value">{listeningBand ?? "—"}</strong></div>
            <div><span className="dash-stat-label">Reading</span><strong className="dash-stat-value">{readingBand ?? "—"}</strong></div>
            <div><span className="dash-stat-label">Writing</span><strong className="dash-stat-value">{results.writing ? "Done" : "—"}</strong></div>
            <div><span className="dash-stat-label">Speaking</span><strong className="dash-stat-value">Done</strong></div>
          </div>
          <p className="attempt-meta">
            Listening + reading estimate: <strong>{academic ?? "—"}</strong>. Writing and speaking are assessed by the AI examiner inside their sections; read the band and next steps there.
          </p>
          <div className="mock-actions">
            <button className="btn btn-primary" onClick={restart}>Retake mock →</button>
            <Link className="btn btn-ghost" href="/dashboard/analytics">Analytics</Link>
            <Link className="btn btn-ghost" href="/dashboard">Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-page mock-page">
      <div className="mock-topbar">
        <div>
          <span className="dash-stat-label">Mock exam</span>
          <strong>{phase.label}</strong>
        </div>
        <div className="mock-topbar-actions">
          <span className="attempt-meta">{index + 1} / {phases.length}</span>
          <Link className="btn btn-ghost" href="/dashboard">Exit</Link>
        </div>
      </div>

      {phase.kind === "break" && (
        <BreakScreen minutes={phase.minutes} label={phase.label} onDone={next} />
      )}

      {phase.kind === "runner" && (
        <>
          <p className="attempt-meta mock-note">{phase.note}</p>
          <SectionRunner
            key={phase.skill}
            test={phase.test}
            mode="exam"
            embedded
            onFinished={(value) => {
              setResults((prev) => ({ ...prev, [phase.skill]: value }));
              next();
            }}
          />
        </>
      )}

      {phase.kind === "speaking" && (
        <>
          <p className="attempt-meta mock-note">
            One cue card. Prepare, record, check the transcript, then finish.
          </p>
          <SpeakingPractice prompts={[speaking]} />
          <div className="mock-actions">
            <button className="btn btn-primary" onClick={next}>Finish speaking section →</button>
          </div>
        </>
      )}
    </div>
  );
}
