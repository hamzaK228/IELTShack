"use client";

import { useEffect, useMemo, useState } from "react";
import QuestionRow from "./QuestionRow";
import type { QuestionEntry } from "@/lib/content";
import { getSaved, subscribe, toggleSaved } from "@/lib/storage";
import { SKILL_LABEL, SKILLS, type QuestionType, type Skill } from "@/lib/types";

const TYPES: Array<{ id: QuestionType | "all"; label: string }> = [
  { id: "all", label: "All types" },
  { id: "mcq", label: "Multiple choice" },
  { id: "tfng", label: "True / False / Not Given" },
  { id: "gap", label: "Gap fill" },
  { id: "matching", label: "Matching" },
  { id: "short", label: "Short answer" },
  { id: "writing", label: "Writing" },
  { id: "speaking", label: "Speaking" },
];

const PAGE_SIZE = 20;

export default function BankExplorer() {
  const [skill, setSkill] = useState<Skill | "all">("all");
  const [type, setType] = useState<QuestionType | "all">("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<QuestionEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setSaved(getSaved());
    sync();
    return subscribe(sync);
  }, []);

  useEffect(() => {
    setPage(0);
  }, [skill, type, query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({
        skill,
        type,
        q: query,
        offset: String(page * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      });
      try {
        const res = await fetch(`/api/questions?${params.toString()}`);
        const data = (await res.json()) as { total: number; items: QuestionEntry[] };
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [skill, type, query, page]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const range = useMemo(() => {
    if (!total) return "No questions";
    const from = page * PAGE_SIZE + 1;
    const to = Math.min(total, from + items.length - 1);
    return `Showing ${from}–${to} of ${total.toLocaleString()}`;
  }, [total, page, items.length]);

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Question bank</h1>
          <p className="dash-sub">{total.toLocaleString()} questions across the four IELTS skills.</p>
        </div>
      </div>

      <div className="qb-controls">
        <select
          className="qb-select"
          value={skill}
          onChange={(e) => setSkill(e.target.value as Skill | "all")}
          aria-label="Filter by skill"
        >
          <option value="all">All skills</option>
          {SKILLS.map((s) => (
            <option key={s} value={s}>{SKILL_LABEL[s]}</option>
          ))}
        </select>

        <select
          className="qb-select"
          value={type}
          onChange={(e) => setType(e.target.value as QuestionType | "all")}
          aria-label="Filter by type"
        >
          {TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>

        <input
          className="qb-select qb-search"
          placeholder="Search questions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search questions"
        />

        <span className="qb-count">{range}</span>
      </div>

      <div className="dash-card">
        {loading ? (
          <p className="dash-empty">Loading questions…</p>
        ) : items.length === 0 ? (
          <p className="dash-empty">No questions match those filters.</p>
        ) : (
          <div className="review-list">
            {items.map((entry) => (
              <QuestionRow
                key={`${entry.testId}-${entry.question.id}`}
                entry={entry}
                saved={saved.includes(entry.question.id)}
                onToggleSave={() => setSaved(toggleSaved(entry.question.id))}
              />
            ))}
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="pager">
          <button className="btn btn-ghost" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            ← Prev
          </button>
          <span className="attempt-meta">Page {page + 1} of {pages}</span>
          <button
            className="btn btn-ghost"
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page >= pages - 1}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
