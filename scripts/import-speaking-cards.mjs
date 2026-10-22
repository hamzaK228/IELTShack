#!/usr/bin/env node
/**
 * Imports the Makkar cue-card list into content/prompts/speaking-cue-cards.json.
 *
 * The source page is a numbered list of Part 2 topics with no bullet points, so each
 * card gets the standard "you should say" scaffold for its kind of topic. Raw HTML is
 * cached in scripts/.cache/speaking/.
 *
 *   node scripts/import-speaking-cards.mjs
 *   node scripts/import-speaking-cards.mjs --refresh
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CACHE = path.join(ROOT, "scripts", ".cache", "speaking");
const OUT = path.join(ROOT, "content", "prompts", "speaking-cue-cards.json");
const URL = "https://practicepteonline.com/ielts-speaking-latest-makkar-cue-cards/";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

const ENTITIES = {
  nbsp: " ", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’",
  ldquo: "“", rdquo: "”", hellip: "…", amp: "&", apos: "'", quot: '"',
};

function decode(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

function clean(text) {
  return decode(text).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
}

/**
 * The kind of thing a card asks about decides its scaffold. Only the head noun phrase
 * counts, so "a good law in your country" is a law, not a place.
 */
function headPhrase(topic) {
  const after = topic.replace(/^(describe|talk about|tell me about|speak about)\s+/i, "");
  const head = after.split(/\b(?:in|that|which|where|who|whom|whose|when|you|i|with|for|to|of|at|from)\b/i)[0];
  return (head || after).replace(/\b(a|an|the|your|my|some|any)\b/gi, " ").trim();
}

const SCAFFOLDS = [
  {
    kind: "person",
    test: /\b(person|people|someone|friend|teenager|child|kid|actor|actress|teacher|neighbour|neighbors?|colleague|comic|talkative|celebrity|relative|singer|musician|writer|leader|politician|sportsperson|member|manager|boss|customer|stranger)\b/i,
    bullets: [
      "who this person is",
      "how you know or heard about them",
      "what this person is like",
      "and explain why you would like to talk about them",
    ],
  },
  {
    kind: "place",
    test: /\b(place|city|country|town|building|park|library|shop|store|market|restaurant|cafe|street|museum|garden|room|house|home|hotel|village|island|beach|mall|gym|station|airport|tree|plant|school|college|university|office|neighbourhood|area|view|river|lake|mountain)\b/i,
    bullets: [
      "where this place is",
      "when you went there (or why you would like to go)",
      "what it is like there",
      "and explain why it is important to you",
    ],
  },
  {
    kind: "object",
    test: /\b(phone|gift|present|book|bag|clothes|clothing|device|machine|equipment|tool|item|product|toy|painting|photo|picture|computer|laptop|camera|car|vehicle|bike|bicycle|watch|object|money|food|meal|dish|drink|medicine|app|website|game|gadget|furniture)\b/i,
    bullets: [
      "what it is",
      "how you got it",
      "how you use it",
      "and explain why it matters to you",
    ],
  },
  {
    kind: "activity",
    test: /\b(skill|activity|sport|hobby|decision|competition|party|law|rule|talk|speech|lecture|programme|program|festival|trip|journey|holiday|experience|event|ceremony|wedding|course|subject|job|work|project|plan|tradition|custom|habit|time|occasion|moment|situation|story|news|film|movie|song|music|performance|celebration|problem|change|idea|habit)\b/i,
    bullets: [
      "what it was",
      "when and where it happened",
      "who else was involved",
      "and explain how you felt about it",
    ],
  },
];

const FALLBACK = [
  "what it was",
  "when and where it happened",
  "who else was involved",
  "and explain why you remember it",
];

function bulletsFor(topic) {
  const head = headPhrase(topic);
  const match =
    SCAFFOLDS.find((scaffold) => scaffold.test.test(head)) ??
    SCAFFOLDS.find((scaffold) => scaffold.test.test(topic));
  return match ? match.bullets : FALLBACK;
}

/** "Describe a good law in your country" -> "A good law in your country". */
function shortTitle(topic) {
  const trimmed = topic
    .replace(/^(describe|talk about|tell me about|speak about|an?)\s+/i, "")
    .replace(/\s*\(.*?\)\s*$/, "")
    .replace(/\s*\/.*$/, "")
    .trim();
  const titled = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return titled.length > 60 ? `${titled.slice(0, 57).trim()}…` : titled;
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "text/html" },
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 700 * attempt * attempt));
    }
  }
  throw lastError;
}

function topicsFrom(html) {
  const open = /<div[^>]*class="[^"]*\bentry-content\b[^"]*"[^>]*>/i.exec(html);
  const start = open ? open.index : 0;
  const articleEnd = html.indexOf("</article>", start);
  const body = html.slice(start, articleEnd === -1 ? undefined : articleEnd);

  const text = decode(
    body
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, "\n")
  );

  const seen = new Set();
  const topics = [];
  for (const raw of text.split("\n")) {
    const line = clean(raw);
    const match = /^(\d{1,3})\s*[\.\)]\s*(.+)$/.exec(line);
    if (match) {
      const n = Number(match[1]);
      if (seen.has(n)) continue;
      const topic = match[2].replace(/\s*\(For Pdf Version[\s\S]*$/i, "").trim();
      if (topic.length < 10) continue;
      seen.add(n);
      topics.push({ n, topic });
    }
  }
  return topics.sort((a, b) => a.n - b.n);
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  mkdirSync(path.dirname(OUT), { recursive: true });

  const cacheFile = path.join(CACHE, "cue-cards.html");
  let html;
  if (existsSync(cacheFile) && !args.refresh) {
    html = readFileSync(cacheFile, "utf8");
  } else {
    html = await fetchText(URL);
    writeFileSync(cacheFile, html);
  }

  const topics = topicsFrom(html);
  if (topics.length < 50) {
    console.error(`Only ${topics.length} cue cards parsed — refusing to overwrite.`);
    process.exit(1);
  }

  const prompts = topics.map(({ n, topic }) => ({
    id: `cue-${String(n).padStart(3, "0")}`,
    part: 2,
    title: shortTitle(topic),
    cueCard: topic,
    bullets: bulletsFor(topic),
    prepSeconds: 60,
    speakSeconds: 120,
    followUps: [],
  }));

  writeFileSync(OUT, `${JSON.stringify(prompts, null, 2)}\n`);

  const kinds = prompts.reduce((acc, prompt) => {
    const kind = SCAFFOLDS.find((s) => s.bullets === prompt.bullets)?.kind ?? "general";
    acc[kind] = (acc[kind] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`wrote ${prompts.length} cue cards to ${path.relative(ROOT, OUT)}`);
  console.log("scaffold mix:", kinds);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
