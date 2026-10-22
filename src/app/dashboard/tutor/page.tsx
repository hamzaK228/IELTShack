"use client";

import { useRef, useState } from "react";

type Message = { role: "user" | "tutor"; text: string };

const REPLIES: Array<{ match: RegExp; reply: string }> = [
  {
    match: /writing|task 1|task 2|essay/i,
    reply:
      "Writing plan:\n• Task 1 — one clear overview sentence, then 2 body paragraphs grouping the data; never give an opinion.\n• Task 2 — four paragraphs: introduction with a clear position, two developed body paragraphs, conclusion that restates the position.\n• Band 7 needs a clear position throughout, varied linking, and errors that do not reduce clarity. Draft first, then cut repetition.",
  },
  {
    match: /reading|true|false|not given|heading/i,
    reply:
      "Reading tips:\n• True/False/Not Given tests the evidence, not your knowledge. Find the exact sentence, then ask: does it confirm (True), contradict (False), or stay silent (Not Given)?\n• Matching headings: read the first and last sentence of each paragraph, then match the main idea — not repeated words.\n• Spend no more than 20 minutes per passage and flag anything that takes longer than 90 seconds.",
  },
  {
    match: /listening|audio|spelling/i,
    reply:
      "Listening tips:\n• Read the questions before each section and predict the answer type (number, name, noun).\n• Watch spelling and singular/plural — both lose marks.\n• If you miss an answer, move on immediately; the recording only plays once.\n• Section 3 and 4 are where most candidates lose marks: practise signposting words (however, actually, in contrast).",
  },
  {
    match: /speaking|part 2|fluency|cue card/i,
    reply:
      "Speaking tips:\n• Part 2: use the one minute to write 4 keywords, then speak for the full two minutes. A clear structure with one concrete example beats a list of ideas.\n• Fluency is about rhythm, not speed: pause at sentence boundaries instead of filling with 'um'.\n• Part 3 rewards generalisation and examples — practise 'It depends…', 'In my country…', 'The main reason is…'.",
  },
  {
    match: /band|score|7\.0|7\.5|8\.0/i,
    reply:
      "Bands are averaged across the four skills and rounded to the nearest half band.\n• Band 6.5 → 7.0 usually means fixing accuracy in Listening/Reading (about 3–4 more correct answers) and tightening Task 2 structure.\n• Your dashboard shows the exact weak skill — start there. Take the diagnostic if you have not.",
  },
  {
    match: /plan|schedule|study|how long/i,
    reply:
      "A realistic plan for +1.0 band is 8–12 weeks at 6–10 focused hours a week. Split each week: 2 sessions on your weakest skill, 1 timed section, 1 review session. Your Study Plan page builds this from your target and test date.",
  },
];

export default function TutorPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "tutor",
      text: "> ieltshack tutor online.\nAsk me about any skill — writing, reading, listening, speaking, bands, or planning.",
    },
  ]);
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  function send(text: string) {
    const clean = text.trim();
    if (!clean) return;
    const match = REPLIES.find((entry) => entry.match.test(clean));
    const reply =
      match?.reply ??
      "I can help with Writing, Reading, Listening, Speaking, band strategy, or study planning. Try asking about one of those — or paste a question you got wrong.";
    setMessages((prev) => [...prev, { role: "user", text: clean }, { role: "tutor", text: reply }]);
    setInput("");
    requestAnimationFrame(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight }));
  }

  return (
    <div className="dash-page">
      <div className="dash-head">
        <div>
          <h1 className="dash-title">AI tutor</h1>
          <p className="dash-sub">
            Grounded in IELTS strategy. Demo replies are rule-based; a live model connects in Phase 6.
          </p>
        </div>
        <div className="dash-head-actions">
          <span className="chip">beta</span>
        </div>
      </div>

      <div className="dash-card app-chat">
        <div className="app-chat-log" ref={logRef}>
          {messages.map((message, i) => (
            <div className={`app-chat-msg ${message.role}`} key={i}>
              <span className="app-chat-role">{message.role === "user" ? "you" : "tutor"}</span>
              <p>{message.text}</p>
            </div>
          ))}
        </div>

        <div className="app-chat-chips">
          {["How do I improve Task 2?", "True vs Not Given", "Listening spelling", "What band do I need?"].map((chip) => (
            <button className="chip" key={chip} onClick={() => send(chip)}>{chip}</button>
          ))}
        </div>

        <form
          className="app-chat-form"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            className="field-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the tutor…"
            aria-label="Message"
          />
          <button className="btn btn-primary" type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}
