"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SKILL_LABEL, type Skill } from "@/lib/types";

export type TestSummary = {
  id: string;
  title: string;
  kind: "diagnostic" | "practice" | "mock";
  durationMinutes: number;
  questions: number;
  skills: Skill[];
};

const PAGE_SIZE = 20;

export default function TestLibrary({ tests, hidden }: { tests: TestSummary[]; hidden: number }) {
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState<Skill | "all">("all");
  const [kind, setKind] = useState<"all" | "diagnostic" | "practice" | "mock">("all");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tests.filter((test) => {
      if (kind !== "all" && test.kind !== kind) return false;
      if (skill !== "all" && !test.skills.includes(skill)) return false;
      if (q && !`${test.title} ${test.id}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tests, query, skill, kind]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const items = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  function update(setter: () => void) {
    setter();
    setPage(0);
  }

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Practice tests</h1>
          <p className="dash-sub">
            {tests.length.toLocaleString()} tests ready. Start with a diagnostic if you are new.
            {hidden > 0 && (
              <>
                {" "}
                <Link className="auth-link" href="/dashboard/admin/reading-qa">
                  {hidden} incomplete reading tests
                </Link>{" "}
                are hidden pending repair.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="qb-controls">
        <select
          className="qb-select"
          value={kind}
          onChange={(e) => update(() => setKind(e.target.value as typeof kind))}
          aria-label="Filter by type"
        >
          <option value="all">All types</option>
          <option value="diagnostic">Diagnostic</option>
          <option value="practice">Practice</option>
          <option value="mock">Mock</option>
        </select>
        <select
          className="qb-select"
          value={skill}
          onChange={(e) => update(() => setSkill(e.target.value as typeof skill))}
          aria-label="Filter by skill"
        >
          <option value="all">All skills</option>
          {(["listening", "reading", "writing", "speaking"] as Skill[]).map((s) => (
            <option key={s} value={s}>{SKILL_LABEL[s]}</option>
          ))}
        </select>
        <input
          className="qb-select qb-search"
          placeholder="Search tests…"
          value={query}
          onChange={(e) => update(() => setQuery(e.target.value))}
          aria-label="Search tests"
        />
        <span className="qb-count">{filtered.length.toLocaleString()} shown</span>
      </div>

      <div className="dash-card">
        {items.length === 0 ? (
          <p className="dash-empty">No tests match those filters.</p>
        ) : (
          <ul className="attempt-list">
            {items.map((test) => (
              <li className="attempt-row" key={test.id}>
                <div>
                  <strong>{test.title}</strong>
                  <span className="attempt-meta">
                    {test.kind} · {test.durationMinutes} min · {test.questions} questions ·{" "}
                    {test.skills.map((s) => SKILL_LABEL[s]).join(" · ")}
                  </span>
                </div>
                <Link className="btn btn-primary" href={`/dashboard/test/${test.id}`}>
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pages > 1 && (
        <div className="pager">
          <button className="btn btn-ghost" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={current === 0}>
            ← Prev
          </button>
          <span className="attempt-meta">Page {current + 1} of {pages}</span>
          <button
            className="btn btn-ghost"
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={current >= pages - 1}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
