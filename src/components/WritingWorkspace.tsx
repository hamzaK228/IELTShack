"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WritingPrompt } from "@/lib/prompts";
import { fetchWritingDraft, remoteEnabled, saveWritingDraft } from "@/lib/remote";
import AiFeedback from "./AiFeedback";

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export default function WritingWorkspace({ prompts }: { prompts: WritingPrompt[] }) {
  const [selectedId, setSelectedId] = useState(prompts[0]?.id ?? "");
  const [text, setText] = useState("");
  const [checks, setChecks] = useState<Record<number, boolean>>({});
  const [remaining, setRemaining] = useState((prompts[0]?.timeMinutes ?? 20) * 60);
  const [running, setRunning] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const loaded = useRef<string>("");
  const typed = useRef(false);

  const prompt = useMemo(
    () => prompts.find((item) => item.id === selectedId) ?? prompts[0],
    [prompts, selectedId]
  );

  // Load the draft whenever the selected prompt changes.
  useEffect(() => {
    if (!prompt) return;
    try {
      const raw = window.localStorage.getItem(`ieltshack:draft:${prompt.id}`);
      if (raw) {
        const draft = JSON.parse(raw) as { text: string; checks: Record<number, boolean> };
        setText(draft.text ?? "");
        setChecks(draft.checks ?? {});
        setSavedAt("draft restored");
      } else {
        setText("");
        setChecks({});
        setSavedAt(null);
      }
    } catch {
      setText("");
    }
    setRemaining(prompt.timeMinutes * 60);
    setRunning(false);
    setShowModel(false);
    loaded.current = prompt.id;
    typed.current = false;

    if (remoteEnabled()) {
      const targetId = prompt.id;
      void fetchWritingDraft(targetId).then((draft) => {
        if (!draft || loaded.current !== targetId || typed.current) return;
        setText(draft.text);
        setChecks(draft.checks ?? {});
        setSavedAt("synced");
      });
    }
  }, [prompt]);

  // Autosave.
  useEffect(() => {
    if (!prompt || loaded.current !== prompt.id) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          `ieltshack:draft:${prompt.id}`,
          JSON.stringify({ text, checks })
        );
        if (remoteEnabled()) void saveWritingDraft(prompt.id, text, checks);
        setSavedAt("saved");
      } catch {
        // ignore storage failures
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [text, checks, prompt]);

  // Countdown.
  useEffect(() => {
    if (!running || remaining <= 0) return;
    const timer = window.setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running, remaining]);

  if (!prompt) {
    return (
      <div className="dash-page">
        <div className="dash-card dash-empty">No writing prompts yet. Add JSON to content/prompts.</div>
      </div>
    );
  }

  const words = countWords(text);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const doneChecks = prompt.checklist.filter((_, i) => checks[i]).length;

  function reset() {
    setText("");
    setChecks({});
    setRemaining(prompt.timeMinutes * 60);
    setRunning(false);
    window.localStorage.removeItem(`ieltshack:draft:${prompt.id}`);
    if (remoteEnabled()) void saveWritingDraft(prompt.id, "", {});
    setSavedAt(null);
  }

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Writing practice</h1>
          <p className="dash-sub">
            Timed tasks with band-descriptor checklists. Drafts save automatically in this browser.
          </p>
        </div>
        <div className="dash-head-actions">
          <span className={`session-timer${remaining === 0 ? " time-up" : ""}`}>
            ⏱ {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => setRunning((r) => !r)}
            disabled={remaining === 0}
          >
            {running ? "Pause" : "Start"}
          </button>
          <button className="btn btn-ghost" onClick={reset}>Reset</button>
        </div>
      </div>

      {prompts.length > 1 && (
        <div className="app-tabs">
          {prompts.map((item) => (
            <button
              key={item.id}
              className={`chip${item.id === prompt.id ? " active" : ""}`}
              onClick={() => setSelectedId(item.id)}
            >
              Task {item.taskNumber}
            </button>
          ))}
        </div>
      )}

      <div className="writing-grid">
        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-section-title">{prompt.title}</h2>
            <span className="attempt-meta">{prompt.minWords}+ words · {prompt.timeMinutes} min</span>
          </div>
          <p className="writing-prompt">{prompt.prompt}</p>
          <div className="writing-checklist">
            <h3>Band checklist</h3>
            {prompt.checklist.map((item, i) => (
              <label className="check-row" key={item}>
                <input
                  type="checkbox"
                  checked={!!checks[i]}
                  onChange={(e) => setChecks({ ...checks, [i]: e.target.checked })}
                />
                <span>{item}</span>
              </label>
            ))}
            <p className="attempt-meta">{doneChecks}/{prompt.checklist.length} checked</p>
          </div>
        </div>

        <div className="dash-card writing-editor">
          <div className="dash-card-head">
            <h2 className="dash-section-title">Your answer</h2>
            <span className={`attempt-meta${words >= prompt.minWords ? " ok-text" : ""}`}>
              {words} words · {savedAt ?? "not saved"}
            </span>
          </div>
          <textarea
            className="field-input writing-textarea"
            value={text}
            onChange={(e) => {
              typed.current = true;
              setText(e.target.value);
            }}
            placeholder="Write your answer here…"
            rows={18}
          />
          <AiFeedback mode="writing" prompt={prompt.prompt} text={text} />

          <div className="writing-footer">
            <button className="btn btn-ghost" onClick={() => setShowModel((v) => !v)}>
              {showModel ? "Hide model answer" : "Show model answer"}
            </button>
            {remaining === 0 && <span className="chip bad">Time is up</span>}
          </div>
          {showModel && (
            <div className="review-reveal">
              <p className="attempt-meta">Model answer — compare structure, not wording.</p>
              <p className="writing-model">{prompt.modelAnswer}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
