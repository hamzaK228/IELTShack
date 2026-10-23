"use client";

import { useState } from "react";
import { authHeaders } from "@/lib/client-auth";

type Evaluation = {
  overall: number;
  criteria: Record<string, number>;
  summary: string;
  strengths: string[];
  improvements: string[];
  source: "ai" | "heuristic";
};

const LABELS: Record<string, string> = {
  taskResponse: "Task response",
  coherence: "Coherence & cohesion",
  lexicalResource: "Lexical resource",
  grammaticalRange: "Grammatical range",
  fluency: "Fluency & coherence",
  pronunciation: "Pronunciation (estimated)",
};

export default function AiFeedback({
  mode,
  prompt,
  text,
  compact = false,
}: {
  mode: "writing" | "speaking";
  prompt: string;
  text: string;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Evaluation | null>(null);

  async function evaluate() {
    setLoading(true);
    setError(null);
    try {
      const authorization = await authHeaders();
      const res = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json", ...authorization },
        body: JSON.stringify({ mode, prompt, text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not evaluate the answer.");
        return;
      }
      setResult(data as Evaluation);
    } catch {
      setError("Could not reach the evaluator. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className={`ai-feedback${compact ? " compact" : ""}`}>
      <div className="ai-feedback-head">
        <div>
          <strong>AI examiner</strong>
          <span className="attempt-meta">
            {mode === "writing" ? "Task response · coherence · vocabulary · grammar" : "Fluency · vocabulary · grammar · pronunciation"}
          </span>
        </div>
        <button className="btn btn-ghost" onClick={evaluate} disabled={loading || words < 15} aria-busy={loading}>
          {loading ? "Evaluating…" : result ? "Re-check" : "Check with AI →"}
        </button>
      </div>

      {words < 15 && (
        <p className="attempt-meta">Write at least a few sentences (15+ words) to get feedback.</p>
      )}
      {error && <p className="field-error">{error}</p>}

      {result && (
        <div className="ai-result" role="status" aria-live="polite">
          <div className="ai-result-top">
            <div>
              <span className="dash-stat-label">Estimated band</span>
              <span className="ai-band">{result.overall.toFixed(1)}</span>
            </div>
            <span className={`chip ${result.source === "ai" ? "good" : ""}`}>
              {result.source === "ai" ? "AI examiner" : "local estimate"}
            </span>
          </div>

          <div className="ai-criteria">
            {Object.entries(result.criteria).map(([key, value]) => (
              <div className="ai-criterion" key={key}>
                <span>{LABELS[key] ?? key}</span>
                <span className="ai-criterion-band">{Number(value).toFixed(1)}</span>
              </div>
            ))}
          </div>

          <p className="ai-summary">{result.summary}</p>

          {result.strengths.length > 0 && (
            <div className="ai-list">
              <strong>What worked</strong>
              <ul>{result.strengths.map((item, i) => <li key={i}>{item}</li>)}</ul>
            </div>
          )}
          {result.improvements.length > 0 && (
            <div className="ai-list">
              <strong>Next steps</strong>
              <ul>{result.improvements.map((item, i) => <li key={i}>{item}</li>)}</ul>
            </div>
          )}
          {result.source === "heuristic" && (
            <p className="attempt-meta">
              Heuristic estimate only — set OPENAI_API_KEY (or AI_API_KEY) on the server for a real examiner-style band.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
