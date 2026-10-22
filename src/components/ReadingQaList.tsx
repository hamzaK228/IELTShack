"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type ReadingQaRow = {
  id: string;
  title: string;
  total: number;
  sections: number;
  general: boolean;
};

const PAGE_SIZE = 30;

export default function ReadingQaList({ rows }: { rows: ReadingQaRow[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "academic" | "general">("all");
  const [page, setPage] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (kind === "academic" && row.general) return false;
      if (kind === "general" && !row.general) return false;
      if (q && !`${row.title} ${row.id}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, kind]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const items = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  async function copy(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Reading QA — under 40 questions</h1>
          <p className="dash-sub">
            {rows.length} reading tests have fewer than 40 questions. Send corrections as{" "}
            <code>&lt;test id&gt; Q&lt;number&gt;: &lt;answer&gt;</code>.
          </p>
        </div>
        <span className="chip">QA</span>
      </div>

      <div className="qb-controls">
        <select
          className="qb-select"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as typeof kind);
            setPage(0);
          }}
          aria-label="Filter by test type"
        >
          <option value="all">All reading</option>
          <option value="academic">Academic</option>
          <option value="general">General Training</option>
        </select>
        <input
          className="qb-select qb-search"
          placeholder="Search by title or id…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          aria-label="Search tests"
        />
        <span className="qb-count">{filtered.length.toLocaleString()} shown</span>
      </div>

      <div className="dash-card">
        <div className="result-table-wrap">
          <table className="result-table qa-table">
            <thead>
              <tr>
                <th>Test</th>
                <th>Questions</th>
                <th>Missing</th>
                <th>Sections</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.title}</strong>
                    <span className="attempt-meta">{row.id}</span>
                  </td>
                  <td>{row.total}</td>
                  <td className="qa-missing">{Math.max(0, 40 - row.total)}</td>
                  <td>{row.sections}</td>
                  <td>
                    <div className="qa-actions">
                      <Link className="session-chip session-ref-btn" href={`/dashboard/test/${row.id}`}>
                        open
                      </Link>
                      <button className="session-chip session-ref-btn" onClick={() => copy(row.id)}>
                        {copied === row.id ? "copied ✓" : "copy id"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
