"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import SectionRunner, { type RunnerResults } from "./SectionRunner";
import SpeakingPractice from "./SpeakingPractice";
import type { SpeakingPrompt } from "@/lib/prompts";
import { overallBand } from "@/lib/bands";
import { saveAttempt } from "@/lib/storage";
import type { Answers, Skill, SkillScore, Test } from "@/lib/types";

type Props = {
  listening: Test;
  reading: Test;
  writing: Test;
  speaking: SpeakingPrompt;
};

const MOCK_STATE_KEY = "ieltshack:mock-state";

type MockState = {
  mockId: string;
  mockStartedAt: string;
  index: number;
  results: Partial<Record<Skill, RunnerResults>>;
  answers: Answers;
  speakingDone: boolean;
  saved: boolean;
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
  const [answers, setAnswers] = useState<Answers>({});
  const [mockStartedAt, setMockStartedAt] = useState("");
  const [saved, setSaved] = useState(false);
  const [speakingDone, setSpeakingDone] = useState(false);
  const mockId = useRef(`mock-${Date.now()}`);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!started) return;
      const state: MockState = {
        mockId: mockId.current,
        mockStartedAt,
        index,
        results,
        answers,
        speakingDone,
        saved,
      };
      window.sessionStorage.setItem(MOCK_STATE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable in private modes.
    }
  }, [started, mockStartedAt, index, results, answers, speakingDone, saved]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(MOCK_STATE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw) as MockState;
      if (!state.mockStartedAt) return;
      mockId.current = state.mockId || mockId.current;
      setMockStartedAt(state.mockStartedAt);
      setIndex(Math.max(0, Math.min(phases.length - 1, state.index)));
      setResults(state.results ?? {});
      setAnswers(state.answers ?? {});
      setSpeakingDone(Boolean(state.speakingDone));
      setSaved(Boolean(state.saved));
      setStarted(true);
    } catch {
      // Ignore corrupt mock state.
    }
  }, [phases.length]);

  const phase = phases[index];

  const summary = useMemo(() => {
    const perSkill: Partial<Record<Skill, SkillScore>> = {};
    const missed = new Set<string>();
    let correct = 0;
    let total = 0;
    for (const value of Object.values(results)) {
      if (!value) continue;
      Object.assign(perSkill, value.perSkill);
      value.missed.forEach((entry) => missed.add(entry.question.id));
      correct += value.correct;
      total += value.total;
    }
    return {
      perSkill,
      missed: Array.from(missed),
      correct,
      total,
      overall: overallBand(Object.values(perSkill).map((score) => score.band)),
    };
  }, [results]);

  useEffect(() => {
    if (!started || saved || phase.kind !== "summary" || !mockStartedAt) return;
    setSaved(true);
    const finishedAt = new Date().toISOString();
    saveAttempt({
      id: `attempt-${Date.now()}`,
      testId: mockId.current,
      testTitle: "Full mock exam",
      mode: "exam",
      startedAt: mockStartedAt,
      finishedAt,
      durationSeconds: Math.max(
        0,
        Math.round((new Date(finishedAt).getTime() - new Date(mockStartedAt).getTime()) / 1000)
      ),
      answers,
      perSkill: summary.perSkill,
      overallBand: summary.overall,
      correct: summary.correct,
      total: summary.total,
      missed: summary.missed,
    });
  }, [started, saved, phase.kind, mockStartedAt, answers, summary]);

  useEffect(() => {
    if (!started || phase.kind === "summary") return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [started, phase.kind]);

  function begin() {
    const now = new Date().toISOString();
    mockId.current = `mock-${Date.now()}`;
    setMockStartedAt(now);
    setAnswers({});
    setResults({});
    setSaved(false);
    setSpeakingDone(false);
    setIndex(0);
    if (typeof window !== "undefined") window.sessionStorage.removeItem(MOCK_STATE_KEY);
    setStarted(true);
  }

  function next() {
    if (phase.kind === "speaking") setSpeakingDone(true);
    setIndex((value) => Math.min(value + 1, phases.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function restart() {
    begin();
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
            Breaks are included between sections. Leaving this tab pauses the mock; return to this page to resume. The attempt is saved at the results screen.
          </p>
          <div className="mock-actions">
            <button className="btn btn-primary" onClick={begin}>Start mock exam →</button>
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
            <div><span className="dash-stat-label">Writing</span><strong className="dash-stat-value">{writing.sections.some((section) => section.questions.some((question) => String(answers[question.id] ?? "").trim().length > 0)) ? "Done" : "—"}</strong></div>
            <div><span className="dash-stat-label">Speaking</span><strong className="dash-stat-value">{speakingDone ? "Done" : "—"}</strong></div>
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
          <Link className="btn btn-ghost" href="/dashboard" onClick={(event) => { if (!window.confirm("Leave the mock? You can resume from this tab.")) event.preventDefault(); }}>Exit</Link>
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
            sessionKey={`ieltshack:mock:${mockId.current}:${phase.skill}`}
            onFinished={(value) => {
              setResults((prev) => ({ ...prev, [phase.skill]: value }));
              setAnswers((prev) => ({ ...prev, ...value.answers }));
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
