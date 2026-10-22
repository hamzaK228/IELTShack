"use client";

import { useEffect, useMemo, useState } from "react";
import { getVocabState, setVocabState, type VocabState } from "@/lib/storage";

const WORDS = [
  { word: "mitigate", pos: "verb", def: "to make something less severe or harmful", example: "Planting trees can mitigate the effects of urban heat." },
  { word: "substantiate", pos: "verb", def: "to provide evidence to support a claim", example: "The report failed to substantiate its central argument." },
  { word: "prevalent", pos: "adjective", def: "common or widespread in a particular place or time", example: "Remote work is more prevalent than it was a decade ago." },
  { word: "adverse", pos: "adjective", def: "unfavourable or harmful", example: "The new policy had an adverse effect on small businesses." },
  { word: "coherent", pos: "adjective", def: "logical and consistent; easy to follow", example: "A band 7 essay needs a coherent line of argument." },
  { word: "derive", pos: "verb", def: "to obtain something from a source", example: "Many English words derive from Latin." },
  { word: "constrain", pos: "verb", def: "to limit or restrict", example: "Budget constraints constrained the scope of the project." },
  { word: "phenomenon", pos: "noun", def: "a fact or situation that is observed, especially one that is unusual", example: "The urban heat island is a well-documented phenomenon." },
  { word: "allocate", pos: "verb", def: "to distribute resources for a particular purpose", example: "Governments must allocate funding carefully." },
  { word: "compelling", pos: "adjective", def: "convincing and persuasive", example: "She presented a compelling case for change." },
  { word: "irrespective", pos: "adverb", def: "without regard to; regardless of", example: "All applicants are treated equally, irrespective of background." },
  { word: "subsequent", pos: "adjective", def: "coming after something in time", example: "Subsequent studies confirmed the original findings." },
];

export default function VocabPage() {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [state, setState] = useState<VocabState>({});

  useEffect(() => setState(getVocabState()), []);

  const current = WORDS[index % WORDS.length];
  const known = useMemo(
    () => WORDS.filter((w) => state[w.word]?.known).length,
    [state]
  );

  function mark(knownFlag: boolean) {
    const next = {
      ...state,
      [current.word]: { known: knownFlag, seen: (state[current.word]?.seen ?? 0) + 1 },
    };
    setState(next);
    setVocabState(next, current.word);
    setRevealed(false);
    setIndex((i) => (i + 1) % WORDS.length);
  }

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">Vocabulary</h1>
          <p className="dash-sub">
            Academic words for Writing and Reading. {known}/{WORDS.length} marked as known.
          </p>
        </div>
      </div>

      <div className="vocab-card app-flashcard">
        <span className="session-chip">{current.pos}</span>
        <h2 className="app-flashcard-word">{current.word}</h2>

        {revealed ? (
          <>
            <p className="vocab-def">{current.def}</p>
            <p className="vocab-example">“{current.example}”</p>
          </>
        ) : (
          <button className="btn btn-ghost" onClick={() => setRevealed(true)}>
            Reveal meaning
          </button>
        )}

        {revealed && (
          <div className="app-flashcard-actions">
            <button className="btn btn-primary" onClick={() => mark(true)}>✓ I know it</button>
            <button className="btn btn-ghost" onClick={() => mark(false)}>Still learning</button>
          </div>
        )}
      </div>

      <div className="dash-card">
        <h2 className="dash-section-title">Word list</h2>
        <ul className="attempt-list">
          {WORDS.map((word, i) => (
            <li className="attempt-row" key={word.word}>
              <div>
                <strong>{word.word}</strong>
                <span className="attempt-meta">{word.pos} · {word.def}</span>
              </div>
              <button
                className="session-chip session-ref-btn"
                onClick={() => { setIndex(i); setRevealed(false); }}
              >
                {state[word.word]?.known ? "✓ known" : "review"}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
