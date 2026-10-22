"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SpeakingPrompt } from "@/lib/prompts";
import { fetchSpeakingRatings, remoteEnabled, saveSpeakingRating } from "@/lib/remote";
import AiFeedback from "./AiFeedback";

type Phase = "ready" | "prep" | "speak" | "review";

declare global {
  interface Window {
    SpeechRecognition?: new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      start: () => void;
      stop: () => void;
      onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
      onerror: ((event: { error: string }) => void) | null;
    };
    webkitSpeechRecognition?: Window["SpeechRecognition"];
  }
}

type Rating = {
  overall: number;
  fluency: number;
  vocabulary: number;
  grammar: number;
  pronunciation: number;
};

/** Above this many prompts the chip row becomes a select. */
const MANY_PROMPTS = 12;

const CRITERIA: Array<{ key: keyof Rating; label: string; hint: string }> = [
  { key: "fluency", label: "Fluency & coherence", hint: "Keeps going, ideas connected" },
  { key: "vocabulary", label: "Lexical resource", hint: "Range and precision" },
  { key: "grammar", label: "Grammatical range", hint: "Variety and accuracy" },
  { key: "pronunciation", label: "Pronunciation", hint: "Clarity and stress" },
];

function readHistory(): Array<{ promptId: string; at: string; rating: Rating }> {
  try {
    return JSON.parse(window.localStorage.getItem("ieltshack:speaking") ?? "[]");
  } catch {
    return [];
  }
}

export default function SpeakingPractice({ prompts }: { prompts: SpeakingPrompt[] }) {
  const [selectedId, setSelectedId] = useState(prompts[0]?.id ?? "");
  const [phase, setPhase] = useState<Phase>("ready");
  const [remaining, setRemaining] = useState(prompts[0]?.prepSeconds ?? 60);
  const [notes, setNotes] = useState("");
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<InstanceType<NonNullable<Window["SpeechRecognition"]>> | null>(null);

  async function startRecording() {
    setMicError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError("Recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      mediaRef.current = recorder;
      setRecording(true);

      const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      if (Recognition) {
        const recognition = new Recognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        let finalText = "";
        recognition.onresult = (event) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const result = event.results[i];
            if (result.isFinal) finalText += `${result[0].transcript} `;
            else interim += result[0].transcript;
          }
          setTranscript(`${finalText}${interim}`.trim());
        };
        recognition.onerror = () => {
          // Recording still works; transcription is optional.
        };
        recognition.start();
        recognitionRef.current = recognition;
      }
    } catch (error) {
      setMicError(
        (error as Error).name === "NotAllowedError"
          ? "Microphone permission was denied. Allow it in the browser, or type your transcript."
          : "Could not start recording. Check your microphone and try again."
      );
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    mediaRef.current = null;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
  }

  useEffect(() => () => {
    mediaRef.current?.stop();
    recognitionRef.current?.stop();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [scores, setScores] = useState<Rating>({
    fluency: 6.5,
    vocabulary: 6.5,
    grammar: 6.5,
    pronunciation: 6.5,
    overall: 6.5,
  });
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<Array<{ promptId: string; at: string; rating: Rating }>>([]);

  const prompt = useMemo(
    () => prompts.find((item) => item.id === selectedId) ?? prompts[0],
    [prompts, selectedId]
  );

  useEffect(() => {
    setHistory(readHistory());
    if (remoteEnabled()) {
      void fetchSpeakingRatings().then((remote) => {
        if (!remote) return;
        setHistory(
          remote.map((entry) => ({
            promptId: entry.promptId,
            at: entry.at,
            rating: {
              overall: entry.overall,
              fluency: entry.scores.fluency ?? entry.overall,
              vocabulary: entry.scores.vocabulary ?? entry.overall,
              grammar: entry.scores.grammar ?? entry.overall,
              pronunciation: entry.scores.pronunciation ?? entry.overall,
            },
          }))
        );
      });
    }
  }, []);

  useEffect(() => {
    if (phase !== "prep" && phase !== "speak") return;
    if (remaining <= 0) {
      if (phase === "prep") {
        setPhase("speak");
        setRemaining(prompt.speakSeconds);
      } else {
        if (recording) stopRecording();
        setPhase("review");
      }
      return;
    }
    const timer = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, remaining, prompt, recording]);

  function start() {
    setNotes("");
    setTranscript("");
    setAudioUrl(null);
    setMicError(null);
    setSaved(false);
    setPhase("prep");
    setRemaining(prompt.prepSeconds);
  }

  function skipToSpeak() {
    setPhase("speak");
    setRemaining(prompt.speakSeconds);
  }

  function stop() {
    if (recording) stopRecording();
    setPhase("review");
  }

  function updateScore(key: keyof Rating, value: number) {
    const next = { ...scores, [key]: value };
    const parts = [next.fluency, next.vocabulary, next.grammar, next.pronunciation];
    next.overall = Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 2) / 2;
    setScores(next);
  }

  function saveRating() {
    const entry = { promptId: prompt.id, at: new Date().toISOString(), rating: scores };
    const next = [entry, ...readHistory()].slice(0, 50);
    window.localStorage.setItem("ieltshack:speaking", JSON.stringify(next));
    if (remoteEnabled()) {
      void saveSpeakingRating(prompt.id, scores as unknown as Record<string, number>, scores.overall);
    }
    setHistory(next);
    setSaved(true);
  }

  if (!prompt) {
    return (
      <div className="dash-page">
        <div className="dash-card dash-empty">No speaking prompts yet. Add JSON to content/prompts.</div>
      </div>
    );
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Speaking practice</h1>
          <p className="dash-sub">
            Look, prepare, speak. Record on your phone if you can, then rate yourself against the
            four criteria.
          </p>
        </div>
        <div className="dash-head-actions">
          <span className="chip">Part {prompt.part}</span>
        </div>
      </div>

      {prompts.length > MANY_PROMPTS ? (
        <div className="speaking-picker">
          <label className="speaking-picker-label" htmlFor="speaking-prompt-select">
            Cue card
          </label>
          <select
            id="speaking-prompt-select"
            className="field-input"
            value={prompt.id}
            onChange={(event) => {
              setSelectedId(event.target.value);
              setPhase("ready");
              setRemaining(prompts.find((item) => item.id === event.target.value)?.prepSeconds ?? 60);
            }}
            disabled={phase !== "ready" && phase !== "review"}
          >
            {prompts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <span className="attempt-meta">{prompts.length} cards</span>
        </div>
      ) : (
        prompts.length > 1 && (
          <div className="app-tabs">
            {prompts.map((item) => (
              <button
                key={item.id}
                className={`chip${item.id === prompt.id && phase === "ready" ? " active" : ""}`}
                onClick={() => {
                  setSelectedId(item.id);
                  setPhase("ready");
                  setRemaining(item.prepSeconds);
                }}
                disabled={phase !== "ready" && phase !== "review"}
              >
                {item.title}
              </button>
            ))}
          </div>
        )
      )}

      <div className="dash-card speaking-card">
        <span className="attempt-meta">Cue card</span>
        <h2 className="speaking-cue">{prompt.cueCard}</h2>
        <p className="attempt-meta">You should say:</p>
        <ul className="plain-list">
          {prompt.bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>

        <div className={`speaking-timer phase-${phase}`}>
          <span className="speaking-timer-label">
            {phase === "ready" && "Ready when you are"}
            {phase === "prep" && "Preparation time"}
            {phase === "speak" && "Speak now"}
            {phase === "review" && "Rate your answer"}
          </span>
          {phase !== "ready" && phase !== "review" && (
            <span className="speaking-timer-num">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
          )}
        </div>

        <div className="speaking-actions">
          {phase === "ready" && (
            <button className="btn btn-primary" onClick={start}>Start preparation →</button>
          )}
          {phase === "prep" && (
            <>
              <button className="btn btn-primary" onClick={skipToSpeak}>I&apos;m ready — speak →</button>
              <button className="btn btn-ghost" onClick={stop}>Stop</button>
            </>
          )}
          {phase === "speak" && (
            <>
              {!recording ? (
                <button className="btn btn-primary" onClick={startRecording} type="button">
                  ● Start recording
                </button>
              ) : (
                <button className="btn btn-primary record-live" onClick={stopRecording} type="button">
                  ■ Stop recording
                </button>
              )}
              <button className="btn btn-ghost" onClick={stop}>Finish speaking →</button>
            </>
          )}
          {phase === "review" && (
            <button className="btn btn-ghost" onClick={start}>Try again</button>
          )}
        </div>

        {micError && <p className="field-error">{micError}</p>}

        {phase === "speak" && (
          <p className="attempt-meta">
            {recording
              ? "Recording… speak naturally; the transcript builds automatically in Chrome/Edge."
              : "Record your answer (stays on this device), or type the transcript after you finish."}
          </p>
        )}

        {(phase === "prep" || phase === "speak") && (
          <label className="field" style={{ marginTop: "1rem" }}>
            <span className="field-label">Notes</span>
            <textarea
              className="field-input session-textarea"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Four keywords, one example…"
            />
          </label>
        )}
      </div>

      {phase === "review" && (
        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-section-title">Self-assessment</h2>
            <span className="chip">Band {scores.overall.toFixed(1)}</span>
          </div>
          {CRITERIA.map((criterion) => (
            <div className="rating-row" key={criterion.key}>
              <div>
                <strong>{criterion.label}</strong>
                <span className="attempt-meta">{criterion.hint}</span>
              </div>
              <input
                type="range"
                min={4}
                max={9}
                step={0.5}
                value={scores[criterion.key]}
                onChange={(e) => updateScore(criterion.key, Number(e.target.value))}
                aria-label={criterion.label}
              />
              <span className="rating-value">{scores[criterion.key].toFixed(1)}</span>
            </div>
          ))}
          <div className="speaking-actions">
            <button className="btn btn-primary" onClick={saveRating} disabled={saved}>
              {saved ? "Saved ✓" : "Save rating"}
            </button>
            <span className="attempt-meta">
              Follow-up questions: {prompt.followUps.join(" · ")}
            </span>
          </div>

          {audioUrl && (
            <div className="speaking-recording">
              <span className="attempt-meta">Your recording</span>
              <audio controls src={audioUrl} />
            </div>
          )}

          <label className="field" style={{ marginTop: "1rem" }}>
            <span className="field-label">Your answer (transcript)</span>
            <textarea
              className="field-input session-textarea"
              rows={6}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Type or paste what you said. The AI examiner evaluates the transcript; pronunciation is only estimated."
            />
          </label>
          <AiFeedback mode="speaking" prompt={prompt.cueCard} text={transcript} />
        </div>
      )}

      {history.length > 0 && (
        <div className="dash-card">
          <h2 className="dash-section-title">Past ratings</h2>
          <ul className="attempt-list">
            {history.slice(0, 5).map((entry) => (
              <li className="attempt-row" key={entry.at}>
                <div>
                  <strong>{prompts.find((p) => p.id === entry.promptId)?.title ?? entry.promptId}</strong>
                  <span className="attempt-meta">{new Date(entry.at).toLocaleString()}</span>
                </div>
                <span className="chip">Band {entry.rating.overall.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
