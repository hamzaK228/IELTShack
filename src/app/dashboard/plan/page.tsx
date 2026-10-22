"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/lib/useAppData";
import { fetchPlanTasks, remoteEnabled, setPlanTask } from "@/lib/remote";
import { SKILL_LABEL, SKILLS, type Skill } from "@/lib/types";

type PlanTask = {
  key: string;
  title: string;
  meta: string;
  href: string;
  skill?: Skill | "vocab";
};

const DAY = 86_400_000;

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function focusTask(skill: Skill): PlanTask {
  switch (skill) {
    case "listening":
      return { key: "", skill, title: "Listening drill with audio", meta: "25 min · one full part", href: "/dashboard/test" };
    case "writing":
      return { key: "", skill, title: "Write one Task 2 essay", meta: "40 min · AI feedback", href: "/dashboard/mock" };
    case "speaking":
      return { key: "", skill, title: "Record a Part 2 answer", meta: "15 min · cue card + playback", href: "/dashboard/mock" };
    default:
      return { key: "", skill, title: "One timed reading passage", meta: "20 min · 13–14 questions", href: "/dashboard/test" };
  }
}

function secondTask(skill: Skill, dayIndex: number): PlanTask {
  if (dayIndex === 5) {
    return { key: "", skill: "writing", title: "Plan a Task 1 report", meta: "20 min · structure only", href: "/dashboard/mock" };
  }
  if (dayIndex === 4) {
    return { key: "", skill: "speaking", title: "Two-minute speaking sprint", meta: "10 min · fluency focus", href: "/dashboard/mock" };
  }
  if (dayIndex === 3) {
    return { key: "", skill: "vocab", title: "Review 20 vocabulary items", meta: "10 min · spaced repetition", href: "/dashboard/vocab" };
  }
  return focusTask(skill);
}

export default function PlanPage() {
  const { loaded, profile, attempts } = useAppData();
  const [done, setDone] = useState<string[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("ieltshack:plan-done");
      if (raw) setDone(JSON.parse(raw));
      setGeneratedAt(window.localStorage.getItem("ieltshack:plan-generated") ?? new Date().toISOString());
    } catch {
      setGeneratedAt(new Date().toISOString());
    }
    if (remoteEnabled()) {
      void fetchPlanTasks().then((tasks) => {
        if (!tasks) return;
        setDone(Object.entries(tasks).filter(([, value]) => value).map(([key]) => key));
      });
    }
  }, []);

  const accuracy = useMemo(() => {
    return SKILLS.map((skill) => {
      let correct = 0;
      let total = 0;
      attempts.forEach((attempt) => {
        const bucket = attempt.perSkill[skill];
        if (!bucket) return;
        correct += bucket.correct;
        total += bucket.total;
      });
      return { skill, percent: total ? Math.round((correct / total) * 100) : 0, total };
    });
  }, [attempts]);

  const order = useMemo(() => {
    const known = accuracy.filter((entry) => entry.total > 0).sort((a, b) => a.percent - b.percent);
    const rest = accuracy.filter((entry) => entry.total === 0);
    return [...known, ...rest].map((entry) => entry.skill);
  }, [accuracy]);

  const weakest = order[0] ?? "reading";

  const days = useMemo(() => {
    const today = startOfToday();
    const hours = profile?.hoursPerWeek ?? 4;
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today.getTime() + index * DAY);
      const key = dayKey(date);
      const primary = order[(index + 1) % order.length] ?? weakest;
      const tasks: PlanTask[] = [
        {
          key: `${key}:review`,
          title: "Clear the review queue",
          meta: "15 min · every miss, revisited",
          href: "/dashboard/review",
        },
        { ...focusTask(index < 2 ? weakest : primary), key: `${key}:focus` },
      ];
      if (hours >= 4) {
        tasks.push({ ...secondTask(order[(index + 2) % order.length] ?? primary, index), key: `${key}:second` });
      }
      if (index === 6) {
        tasks.push({
          key: `${key}:mock`,
          title: "Full four-skill mock exam",
          meta: "About 3 hours · exam conditions",
          href: "/dashboard/mock",
        });
      }
      return { key, date, tasks };
    });
  }, [order, profile?.hoursPerWeek, weakest]);

  const weekDone = done.filter((key) => days.some((day) => day.tasks.some((task) => task.key === key))).length;
  const weekTotal = days.reduce((sum, day) => sum + day.tasks.length, 0);
  const progress = weekTotal ? Math.round((weekDone / weekTotal) * 100) : 0;
  const daysLeft = profile?.testDate
    ? Math.max(0, Math.ceil((new Date(profile.testDate).getTime() - Date.now()) / DAY))
    : null;

  if (!loaded || !profile) return null;

  function toggle(key: string) {
    const next = done.includes(key) ? done.filter((item) => item !== key) : [...done, key];
    setDone(next);
    window.localStorage.setItem("ieltshack:plan-done", JSON.stringify(next));
    if (remoteEnabled()) void setPlanTask(key, next.includes(key));
  }

  function regenerate() {
    const keys = days.flatMap((day) => day.tasks.map((task) => task.key));
    setDone([]);
    window.localStorage.setItem("ieltshack:plan-done", "[]");
    window.localStorage.setItem("ieltshack:plan-generated", new Date().toISOString());
    setGeneratedAt(new Date().toISOString());
    if (remoteEnabled()) keys.forEach((key) => void setPlanTask(key, false));
  }

  const today = days[0];
  const todayDone = today.tasks.filter((task) => done.includes(task.key)).length;

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Study plan</h1>
          <p className="dash-sub">
            Adaptive week to Band {profile.targetBand.toFixed(1)} · {profile.hoursPerWeek} hours per week
            {daysLeft !== null
              ? ` · ${daysLeft === 0 ? "test day" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} to your test`}`
              : " · add a test date in Settings for a countdown"}.
          </p>
        </div>
        <div className="dash-head-actions">
          <button className="btn btn-ghost" onClick={regenerate}>↻ Regenerate</button>
          <Link className="btn btn-primary" href={today.tasks.find((task) => !done.includes(task.key))?.href ?? "/dashboard/mock"}>
            Start today&apos;s session →
          </Link>
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-head">
          <h2 className="dash-section-title">Today</h2>
          <span className="attempt-meta">{todayDone}/{today.tasks.length} done</span>
        </div>
        <div className="session-progress-bar" aria-hidden="true">
          <span style={{ width: `${today.tasks.length ? (todayDone / today.tasks.length) * 100 : 0}%` }} />
        </div>
        <ul className="plan-task-list">
          {today.tasks.map((task) => {
            const isDone = done.includes(task.key);
            return (
              <li key={task.key} className={`plan-task${isDone ? " done" : ""}`}>
                <button
                  className="plan-check"
                  onClick={() => toggle(task.key)}
                  aria-pressed={isDone}
                  aria-label={isDone ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
                >
                  {isDone ? "✓" : ""}
                </button>
                <div>
                  <strong>{task.title}</strong>
                  <span className="attempt-meta">{task.meta}</span>
                </div>
                <Link className="auth-link plan-task-link" href={task.href}>Open →</Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="dash-card">
        <div className="dash-card-head">
          <h2 className="dash-section-title">Next six days</h2>
          <span className="attempt-meta">{weekDone}/{weekTotal} this week</span>
        </div>
        <div className="session-progress-bar" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="plan-days">
          {days.slice(1).map((day) => (
            <div className="plan-day" key={day.key}>
              <div className="plan-day-head">
                <strong>
                  {day.date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                </strong>
                <span className="attempt-meta">
                  {day.tasks.filter((task) => done.includes(task.key)).length}/{day.tasks.length}
                </span>
              </div>
              <ul className="plan-task-list">
                {day.tasks.map((task) => {
                  const isDone = done.includes(task.key);
                  return (
                    <li key={task.key} className={`plan-task compact${isDone ? " done" : ""}`}>
                      <button
                        className="plan-check"
                        onClick={() => toggle(task.key)}
                        aria-pressed={isDone}
                        aria-label={isDone ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
                      >
                        {isDone ? "✓" : ""}
                      </button>
                      <div>
                        <strong>{task.title}</strong>
                        <span className="attempt-meta">{task.meta}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="dash-card">
        <h2 className="dash-section-title">Skill priority</h2>
        <div className="skill-bars">
          {accuracy.map(({ skill, percent, total }) => (
            <div className="priority-row" key={skill}>
              <span>
                {SKILL_LABEL[skill]}
                {skill === weakest ? " · priority" : ""}
              </span>
              <span className="priority-bar">
                <span style={{ ["--w" as string]: `${percent}%` }} />
              </span>
              <span className="priority-val">{total ? `${percent}%` : "—"}</span>
            </div>
          ))}
        </div>
        <p className="attempt-meta" style={{ marginTop: ".8rem" }}>
          Priorities follow your accuracy from saved attempts. Weakest right now:{" "}
          <strong>{SKILL_LABEL[weakest]}</strong>. The plan shifts automatically as your scores change.
        </p>
      </div>

      <p className="attempt-meta">
        Plan generated {new Date(generatedAt || Date.now()).toLocaleString()}. Tasks are saved to your account.
      </p>
    </div>
  );
}
