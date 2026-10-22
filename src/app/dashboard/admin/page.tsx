"use client";

import { useState } from "react";

type Problem = { path: string; message: string };

const SKILLS = ["listening", "reading", "writing", "speaking"];
const TYPES = ["mcq", "multi", "gap", "tfng", "matching", "short", "writing", "speaking"];

function validateTest(test: unknown): Problem[] {
  const problems: Problem[] = [];
  const add = (path: string, message: string) => problems.push({ path, message });

  if (!test || typeof test !== "object") {
    return [{ path: "root", message: "The file must contain a JSON object." }];
  }
  const t = test as Record<string, unknown>;
  if (typeof t.id !== "string" || !t.id) add("id", "Missing id (kebab-case, unique).");
  if (typeof t.title !== "string" || !t.title) add("title", "Missing title.");
  if (!["diagnostic", "practice", "mock"].includes(String(t.kind))) {
    add("kind", "kind must be diagnostic | practice | mock.");
  }
  if (typeof t.durationMinutes !== "number") add("durationMinutes", "Must be a number.");
  if (!Array.isArray(t.sections) || t.sections.length === 0) {
    add("sections", "Needs at least one section.");
    return problems;
  }

  const seen = new Set<string>();
  (t.sections as Array<Record<string, unknown>>).forEach((section, si) => {
    const sp = `sections[${si}]`;
    if (typeof section.id !== "string") add(sp + ".id", "Missing section id.");
    if (!SKILLS.includes(String(section.skill))) add(sp + ".skill", "Invalid skill.");
    if (!Array.isArray(section.questions) || section.questions.length === 0) {
      add(sp + ".questions", "Needs questions.");
      return;
    }
    (section.questions as Array<Record<string, unknown>>).forEach((q, qi) => {
      const qp = `${sp}.questions[${qi}]`;
      if (typeof q.id !== "string" || !q.id) add(qp + ".id", "Missing question id.");
      else if (seen.has(String(q.id))) add(qp + ".id", `Duplicate question id "${q.id}".`);
      else seen.add(String(q.id));
      if (q.skill !== section.skill) add(qp + ".skill", "Must match the section skill.");
      if (!TYPES.includes(String(q.type))) add(qp + ".type", "Invalid type.");
      if (typeof q.prompt !== "string" || !q.prompt) add(qp + ".prompt", "Missing prompt.");

      const options = q.options as Array<Record<string, unknown>> | undefined;
      if (["mcq", "tfng", "matching"].includes(String(q.type))) {
        if (!Array.isArray(options) || options.length < 2) {
          add(qp + ".options", "Needs at least two options.");
        } else {
          const ids = new Set(options.map((o) => String(o.id)));
          const answers = Array.isArray(q.answer) ? q.answer : [q.answer];
          answers.forEach((answer) => {
            if (!ids.has(String(answer))) add(qp + ".answer", `"${answer}" is not an option id.`);
          });
        }
      }
      if (q.graded !== false) {
        const empty =
          q.answer == null ||
          (Array.isArray(q.answer) && q.answer.length === 0) ||
          (typeof q.answer === "string" && !q.answer.trim());
        if (empty) add(qp + ".answer", "Graded questions need an answer.");
      }
    });
  });

  return problems;
}

export default function ImportPage() {
  const [raw, setRaw] = useState("");
  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [summary, setSummary] = useState<{ id: string; title: string; questions: number; sections: number } | null>(null);
  const [fileName, setFileName] = useState("test.json");
  const [copied, setCopied] = useState(false);

  function check(text: string) {
    setCopied(false);
    try {
      const parsed = JSON.parse(text);
      const found = validateTest(parsed);
      setProblems(found);
      if (found.length) {
        setSummary(null);
      } else {
        const sections = parsed.sections as Array<{ questions: unknown[] }>;
        setSummary({
          id: parsed.id,
          title: parsed.title,
          sections: sections.length,
          questions: sections.reduce((sum, s) => sum + s.questions.length, 0),
        });
        setFileName(`${parsed.id}.json`);
      }
    } catch (error) {
      setProblems([{ path: "JSON", message: (error as Error).message }]);
      setSummary(null);
    }
  }

  function download() {
    if (!raw) return;
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyPath() {
    try {
      await navigator.clipboard.writeText(`content/tests/${fileName}`);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Content import</h1>
          <p className="dash-sub">
            Paste or upload a test JSON, validate it, then drop the downloaded file into{" "}
            <code>content/tests</code>.
          </p>
        </div>
        <span className="chip">author tool</span>
      </div>

      <div className="dash-card">
        <div className="dash-card-head">
          <h2 className="dash-section-title">1. Load the test</h2>
          <span className="attempt-meta">schema in CONTENT_GUIDE.md</span>
        </div>
        <input
          type="file"
          accept="application/json,.json"
          className="import-file"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const text = await file.text();
            setRaw(text);
            setFileName(file.name);
            check(text);
          }}
        />
        <textarea
          className="field-input session-textarea import-textarea"
          rows={12}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={'{\n  "id": "reading-set-2",\n  "title": "Academic Reading — Set 2",\n  "kind": "practice",\n  "durationMinutes": 20,\n  "sections": [ ... ]\n}'}
        />
        <div style={{ display: "flex", gap: ".7rem", flexWrap: "wrap", marginTop: ".8rem" }}>
          <button className="btn btn-primary" onClick={() => check(raw)} disabled={!raw.trim()}>
            Validate
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setRaw("");
              setProblems(null);
              setSummary(null);
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {problems && (
        <div className={`dash-card${problems.length ? " import-invalid" : " import-valid"}`}>
          <h2 className="dash-section-title">
            {problems.length ? `✗ ${problems.length} problem${problems.length === 1 ? "" : "s"}` : "✓ Valid test"}
          </h2>
          {problems.length > 0 ? (
            <ul className="plain-list">
              {problems.map((problem, i) => (
                <li key={i}><code>{problem.path}</code> — {problem.message}</li>
              ))}
            </ul>
          ) : summary ? (
            <>
              <p className="attempt-meta">
                {summary.title} · {summary.sections} sections · {summary.questions} questions
              </p>
              <div style={{ display: "flex", gap: ".7rem", flexWrap: "wrap", marginTop: "1rem" }}>
                <button className="btn btn-primary" onClick={download}>Download {fileName}</button>
                <button className="btn btn-ghost" onClick={copyPath}>
                  {copied ? "Path copied ✓" : "Copy target path"}
                </button>
              </div>
              <p className="attempt-meta" style={{ marginTop: ".8rem" }}>
                2. Move the file to <code>content/tests/{fileName}</code> · 3. Run{" "}
                <code>npm run validate:content</code> · 4. Restart the dev server only if you
                changed the file while it was running.
              </p>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
