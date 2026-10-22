"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/lib/useAppData";
import { fetchPlanTasks, remoteEnabled, setPlanTask } from "@/lib/remote";
import { SKILL_LABEL, SKILLS, type Skill } from "@/lib/types";

const WEEK_TASKS = [
  { id: "diagnostic", title: "Complete a diagnostic on your weakest skill", meta: "30 min · all question types" },
  { id: "drill", title: "Drill 15 questions in your priority area", meta: "25 min · light timed" },
  { id: "review", title: "Clear the review queue", meta: "20 min · misses first" },
  { id: "reading", title: "One timed reading passage", meta: "20 min · 13 questions" },
  { id: "writing", title: "Plan and write one Task 2 body paragraph", meta: "25 min · band descriptors" },
];

export default function PlanPage() {
  const { loaded, profile, attempts } = useAppData();
  const [done, setDone] = useState<string[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("ieltshack:plan-done");
      if (raw) setDone(JSON.parse(raw));
      const stamp = window.localStorage.getItem("ieltshack:plan-generated");
      setGeneratedAt(stamp ?? new Date().toISOString());
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

  const weakest = useMemo(() => {
    const stats = SKILLS.map((skill) => {
      let correct = 0;
      let total = 0;
      attempts.forEach((attempt) => {
        const bucket = attempt.perSkill[skill];
        if (!bucket) return;
        correct += bucket.correct;
        total += bucket.total;
      });
      return { skill, percent: total ? (correct / total) * 100 : 0, total };
    }).filter((entry) => entry.total > 0);
    stats.sort((a, b) => a.percent - b.percent);
    return stats[0]?.skill ?? ("reading" as Skill);
  }, [attempts]);

  useEffect(() => {
    if (loaded && profile && !generatedAt) {
      const stamp = new Date().toISOString();
      setGeneratedAt(stamp);
      window.localStorage.setItem("ieltshack:plan-generated", stamp);
    }
  }, [loaded, profile, generatedAt]);

  if (!loaded || !profile) return null;

  const progress = Math.round((done.filter((id) => WEEK_TASKS.some((t) => t.id === id)).length / WEEK_TASKS.length) * 100);
  const weeks =
    profile.testDate
      ? Math.max(
          1,
          Math.ceil((new Date(profile.testDate).getTime() - Date.now()) / (7 * 86_400_000))
        )
      : 8;

  function toggle(id: string) {
    const next = done.includes(id) ? done.filter((d) => d !== id) : [...done, id];
    setDone(next);
    window.localStorage.setItem("ieltshack:plan-done", JSON.stringify(next));
    if (remoteEnabled()) void setPlanTask(id, next.includes(id));
  }

  function regenerate() {
    const stamp = new Date().toISOString();
    setGeneratedAt(stamp);
    window.localStorage.setItem("ieltshack:plan-generated", stamp);
    window.localStorage.removeItem("ieltshack:plan-done");
    setDone([]);
  }

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Study plan</h1>
          <p className="dash-sub">
            {weeks}-week plan to Band {profile.targetBand.toFixed(1)} · {profile.hoursPerWeek} hours per week
            {profile.testDate ? ` · test on ${new Date(profile.testDate).toLocaleDateString()}` : ""}.
          </p>
        </div>
        <div className="dash-head-actions">
          <button className="btn btn-ghost" onClick={regenerate}>↻ Regenerate</button>
          <Link className="btn btn-primary" href="/dashboard/session">Start today&apos;s session →</Link>
        </div>
      </div>

      <div className="dash-card">
        <div className="dash-card-head">
          <h2 className="dash-section-title">This week</h2>
          <span className="attempt-meta">
            {done.filter((id) => WEEK_TASKS.some((t) => t.id === id)).length}/{WEEK_TASKS.length} done
          </span>
        </div>
        <div className="session-progress-bar" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <ul className="plan-task-list">
          {WEEK_TASKS.map((task) => {
            const isDone = done.includes(task.id);
            return (
              <li key={task.id} className={`plan-task${isDone ? " done" : ""}`}>
                <button
                  className="plan-check"
                  onClick={() => toggle(task.id)}
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

      <div className="dash-card">
        <h2 className="dash-section-title">Section priority</h2>
        <div className="skill-bars">
          {SKILLS.map((skill) => {
            const isPriority = skill === weakest;
            const percent = isPriority ? 55 : 15;
            return (
              <div className="priority-row" key={skill}>
                <span>
                  {SKILL_LABEL[skill]}
                  {isPriority ? " · priority" : ""}
                </span>
                <span className="priority-bar">
                  <span style={{ ["--w" as string]: `${percent}%` }} />
                </span>
                <span className="priority-val">{percent}%</span>
              </div>
            );
          })}
        </div>
        <p className="attempt-meta" style={{ marginTop: ".8rem" }}>
          Priorities come from your accuracy by skill. Weakest right now:{" "}
          <strong>{SKILL_LABEL[weakest]}</strong>.
        </p>
      </div>

      <div className="dash-card">
        <h2 className="dash-section-title">Replan triggers</h2>
        <ul className="plain-list">
          <li>Practice test completed</li>
          <li>Two missed study days</li>
          <li>Accuracy below 60% on a priority drill</li>
          <li>Target band or test date changes</li>
        </ul>
        <p className="attempt-meta" style={{ marginTop: ".8rem" }}>
          Plan generated {new Date(generatedAt || Date.now()).toLocaleString()}.
        </p>
      </div>
    </div>
  );
}
