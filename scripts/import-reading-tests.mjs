#!/usr/bin/env node
/**
 * Imports the IELTS reading sets from practicepteonline.com into content/tests/*.json.
 *
 * Two tracks: --track=academic (default) and --track=general (General Training).
 * Raw pages are cached under scripts/.cache/<track>/ so re-parsing never re-fetches.
 *
 *   node scripts/import-reading-tests.mjs --list                  # only refresh the index
 *   node scripts/import-reading-tests.mjs --from=1 --to=6         # small batch
 *   node scripts/import-reading-tests.mjs --parse-only            # re-parse from cache
 *   node scripts/import-reading-tests.mjs --track=general         # GT library
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "content", "tests");
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

const TRACKS = {
  academic: {
    index: "https://practicepteonline.com/ielts-academic-reading-tests/",
    url: (n) => `https://practicepteonline.com/ielts-reading-test-${n}/`,
    link: /(?:^|\/)(?:ielts-)?reading-test-(\d+)/,
    id: (n) => `pte-reading-${n}`,
    title: (n) => `Academic Reading — Practice Test ${n}`,
    cache: "reading",
    sectionLabel: "Passage",
  },
  general: {
    index: "https://practicepteonline.com/ielts-gt-reading-tests/",
    url: (n) => `https://practicepteonline.com/ielts-general-reading-test-${n}/`,
    link: /ielts-general-reading-test-(\d+)/,
    id: (n) => `pte-gt-reading-${n}`,
    title: (n) => `General Training Reading — Practice Test ${n}`,
    cache: "gt-reading",
    sectionLabel: "Text",
  },
  writing: {
    index: "https://practicepteonline.com/ielts-academic-writing-tests/",
    url: (n) => `https://practicepteonline.com/ielts-writing-test-${n}/`,
    link: /(?:^|\/)ielts-writing-test-(\d+)/,
    id: (n) => `pte-writing-${n}`,
    title: (n) => `Academic Writing — Practice Test ${n}`,
    cache: "writing",
    sectionLabel: "Task",
    skill: "writing",
    durationMinutes: 60,
  },
  listening: {
    index: "https://practicepteonline.com/listening-ielts-tests/",
    url: (n) => `https://practicepteonline.com/ielts-listening-test-${n}/`,
    link: /(?:^|\/)(?:ielts-)?listening-(?:test-)?(\d+)/,
    id: (n) => `pte-listening-${n}`,
    title: (n) => `Listening — Practice Test ${n}`,
    cache: "listening",
    sectionLabel: "Part",
    skill: "listening",
    durationMinutes: 30,
  },
};

const TRACK = TRACKS[args.track] ?? TRACKS.academic;
const CACHE = path.join(ROOT, "scripts", ".cache", TRACK.cache);
const CONCURRENCY = Number(args.concurrency ?? 3);

/* ------------------------------------------------------------------ fetch */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, tries = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": UA, accept: "text/html" },
        redirect: "follow",
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (error) {
      lastErr = error;
      await sleep(600 * attempt * attempt);
    }
  }
  throw lastErr;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

/* ------------------------------------------------------------------- html */

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  middot: "·",
  bull: "•",
  deg: "°",
  times: "×",
};

function decode(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Linearise the article body into plain lines, tagging headings. */
function toLines(html) {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<ins\b[\s\S]*?<\/ins>/gi, " ");
  s = s.replace(/<img\b[^>]*>/gi, " ");

  // A paragraph whose entire text is one bold run is a passage title. Many
  // tests use <p style="text-align:center"><strong>Title</strong></p> instead
  // of a heading element.
  s = s.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (match, inner) => {
    const strong = /<strong\b[^>]*>([\s\S]*?)<\/strong>/i.exec(inner);
    if (!strong) return match;
    const strip = (t) => decode(t.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
    const whole = strip(inner);
    const bold = strip(strong[1]);
    if (whole && whole === bold && whole.length < 160) return `\n@@H@@${whole}\n`;
    return match;
  });

  s = s.replace(/<h1\b[^>]*>/gi, "\n@@H@@");
  s = s.replace(/<h[2-6]\b[^>]*>/gi, "\n@@H@@");
  s = s.replace(/<\/h[1-6]>/gi, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|li|tr)>/gi, "\n");
  s = s.replace(/<(p|div|li|tr)\b[^>]*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = decode(s);

  const lines = [];
  for (const raw of s.split("\n")) {
    const line = raw.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
    if (!line) continue;
    if (/^(Hide Answers|Advertisement)$/i.test(line)) continue;
    lines.push(line);
  }
  return lines;
}

/* ---------------------------------------------------------------- parsing */

/** Recognise every "Questions 1-8", "Questions 11 and 12", "Question 13" form. */
function matchHeader(line) {
  // Headers occasionally print a spaced range ("Questions 32—3 6" for 32–36).
  line = line.replace(/([–—-])\s*(\d)\s+(\d)/g, "$1$2$3");
  const stripped = line.replace(/^(?:part|section)\s*\d+\s*[:.\-–—]?\s*/i, "");
  if (stripped !== line) {
    const inner = matchHeader(stripped);
    if (inner) return inner;
  }
  let m = /^Questions?\s*(\d{1,2})\s*[–—-]\s*(\d{1,2})/i.exec(line);
  if (m) return { start: Number(m[1]), end: Number(m[2]) };
  m = /^Questions?\s*(\d{1,2})\s*(?:and|&|to)\s*(\d{1,2})/i.exec(line);
  if (m) return { start: Number(m[1]), end: Number(m[2]) };
  m = /^Question\s*(\d{1,2})\b/i.exec(line);
  if (m) return { start: Number(m[1]), end: Number(m[1]) };
  return null;
}

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx"];
const ROMAN_UPPER = ROMAN.map((r) => r.toUpperCase());

const NUMBERED = /^(\d{1,2})(?:\s*[\.\):]\s*|\s+)(\S.*)$/;
const BLANK_LINE = /^(\d{1,2})\s*[\.\)]?\s*[\s._…·•（）()]{3,}(.*)$/;
const LETTER_OPTION = /^([A-J])\s*[\.\):]?\s+(.{3,})$/;
const PARAGRAPH_LABEL = /^([A-I])[\.\)]?\s+((?:[A-Z][^.]{2,70})|(?:.{40,}))$/;

function clean(text) {
  return decode(text)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Split lines into [headline, ...items] where items are lettered options. */
function extractOptions(rawLines) {
  // Many pages print the letter on its own line and the text on the next.
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const bare = /^([A-J]|[ivx]{1,4})[.)]?$/.exec(rawLines[i].trim());
    const next = rawLines[i + 1];
    const nextIsOption = next && /^(?:[A-J]|[ivx]{1,4})[.)]?\s+/.test(next);
    if (bare && next && !nextIsOption && next.length <= 240) {
      lines.push(`${bare[1]} ${next}`);
      i += 1;
    } else {
      lines.push(rawLines[i]);
    }
  }
  const options = [];
  const rest = [];
  for (const [index, line] of lines.entries()) {
    const m = LETTER_OPTION.exec(line);
    const roman = m ? null : /^(x{0,3}(?:ix|iv|v?i{1,3})|v|x)[\s\.\)]\s*(\S.*)$/i.exec(line);
    // A lone capital followed by a short label is an option; long prose is a paragraph.
    if (m && m[2].length <= 240 && !/^\d/.test(m[2])) {
      options.push({ id: m[1], text: clean(m[2]) });
    } else if (roman && ROMAN.includes(roman[1].toLowerCase()) && roman[2].length <= 160) {
      const id = roman[1].toLowerCase();
      if (!options.some((option) => option.id === id)) options.push({ id, text: clean(roman[2]) });
    } else {
      rest.push(line);
    }
  }

  // The same heading is occasionally printed twice; keep the first.
  const seenText = new Set();
  return {
    options: options.filter((option) => {
      const key = option.text.toLowerCase().replace(/\s+/g, " ").trim();
      if (seenText.has(key)) return false;
      seenText.add(key);
      return true;
    }),
    rest,
  };
}

/** Normalise an answer-key value onto an option id / text. */
function normaliseAnswer(raw, options, type) {
  const value = clean(raw)
    // "C - answer" prefixes are formatting; do not eat "e-book" or "C-card".
    .replace(/^[A-J]\s+[-–—]\s+/, "")
    .replace(/\.$/, "")
    .trim();
  if (!value) return "";

  const key = value.toLowerCase().replace(/\s+/g, " ");
  if (type === "tfng") {
    if (/^(yes|true|ture|y|t)\b/.test(key)) return options.find((o) => /^(yes|true)$/i.test(o.id))?.id ?? "Yes";
    if (/^(no|false|fasle|flase|n|f)\b/.test(key)) return options.find((o) => /^(no|false)$/i.test(o.id))?.id ?? "No";
    if (/^not given/.test(key)) return "Not Given";
    if (/^ng$/.test(key)) return "Not Given";
  }
  const exact = options.find((o) => o.id.toLowerCase() === key);
  if (exact) return exact.id;
  const upper = value.toUpperCase();
  if (/^[A-J]$/.test(upper) && options.some((o) => o.id === upper)) return upper;
  // "C" or "C, E" / "C and E"
  const letters = upper.match(/\b[A-J]\b/g);
  if (letters && letters.every((l) => options.some((o) => o.id === l))) {
    return letters;
  }
  return value;
}

/** Options often share the stem's paragraph: "…morning? A 6.04 B 7.00 C 7.22 D 7.30". */
function splitInlineOptions(text) {
  const marks = [];
  let cursor = 0;
  for (const letter of "ABCDEFGHIJ") {
    const m = new RegExp(`(?:^|\\s)${letter}[.)]?\\s+\\S`).exec(text.slice(cursor));
    if (!m) break;
    const at = cursor + m.index + (m[0].startsWith(letter) ? 0 : 1);
    marks.push({ id: letter, at });
    cursor = at + 1;
  }
  if (marks.length < 2) return null;
  const stem = text.slice(0, marks[0].at).trim();
  const options = marks
    .map((mark, i) => ({
      id: mark.id,
      text: text
        .slice(mark.at + 1, i + 1 < marks.length ? marks[i + 1].at : text.length)
        .replace(/^[.)]\s*/, "")
        .trim(),
    }))
    .filter((option) => option.text);
  return stem && options.length >= 2 ? { stem, options } : null;
}

/** The largest run of consecutive option lines in a region — the "box below". */
function findOptionBox(regionLines) {
  let best = [];
  let run = [];
  for (const line of regionLines) {
    const isOption =
      line.length <= 160 &&
      (LETTER_OPTION.test(line) ||
        /^(?:x{0,3}(?:ix|iv|v?i{1,3})|v|x)[\s\.\)]+\S/i.test(line));
    if (isOption) {
      run.push(line);
      continue;
    }
    if (run.length > best.length) best = run;
    run = [];
  }
  if (run.length > best.length) best = run;
  if (best.length < 3) return [];
  const seen = new Set();
  return extractOptions(best).options.filter((option) => {
    if (seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
}

function inferType(instruction, items, options) {
  const t = instruction.toLowerCase();
  if (/which\s+(two|three|four|five|six|seven|eight|nine|ten)\b/.test(t) || /choose\s+(five|four|three|two)\s+letters/.test(t))
    return "mcq";
  if (/\b(true|false)\b/.test(t) && /not given/.test(t)) return "tfng";
  if (/\byes\b/.test(t) && /\bno\b/.test(t) && /not given/.test(t)) return "tfng";
  if (/choose the correct letter|choose the correct answer|correct letter a|choose the letter/.test(t)) return "mcq";
  if (/match/.test(t) || /which paragraph|which section/.test(t)) return "matching";
  if (/comp?lete\b|label the|choose no more than|one word|two words|three words|from the passage|summary|notes|steps/.test(t))
    return "gap";
  if (options.length >= 3) return "mcq";
  if (items.some((i) => /…{3,}|\.{4,}|_{3,}/.test(i.text))) return "gap";
  return "short";
}

function optionsFor(type, instruction, rawOptions) {
  if (type === "tfng") {
    const yesNo = /\byes\b/.test(instruction.toLowerCase());
    const yes = yesNo ? "Yes" : "True";
    const no = yesNo ? "No" : "False";
    return [
      { id: yes, text: yes },
      { id: no, text: no },
      { id: "Not Given", text: "Not Given" },
    ];
  }
  return rawOptions;
}

/** Turn "… (9) ……… there is" into a fillable prompt. */
function blankPrompt(text, number) {
  let prompt = clean(text);
  // This question's own blank, with or without parentheses.
  prompt = prompt.replace(new RegExp(`\\(\\s*${number}\\s*\\)\\s*(?:[£$€]\\s*)?[.…_·•]{2,}`, "g"), "______");
  // Remaining blanks keep their label so each prompt stays distinguishable.
  prompt = prompt.replace(/\(\s*(\d{1,2})\s*\)\s*[.…_·•]{2,}/g, (_, n) => `(${n}) ______`);
  prompt = prompt.replace(new RegExp("(^|[^.0-9])" + number + "\\s*[.…_·•]{2,}", "g"), "$1______");
  prompt = prompt.replace(/[.…_·•]{3,}/g, "______");
  prompt = prompt.replace(new RegExp(`\\(\\s*${number}\\s*\\)(?!\\d)`, "g"), "______");
  prompt = prompt.replace(/^______\s*/, "").trim();
  if (!prompt) prompt = `(Question ${number})`;
  if (!prompt.includes("______")) prompt = `${prompt} ______`;
  return prompt;
}

function parseQuestionSection(header, body) {
  const range = header.match;
  const instructionLines = [];
  const itemLines = [];

  let started = false;
  for (const line of body) {
    const numbered = NUMBERED.exec(line) || BLANK_LINE.exec(line);
    const inRange = numbered && Number(numbered[1]) >= range.start && Number(numbered[1]) <= range.end;
    if (!started && inRange) started = true;
    if (line.startsWith("@@H@@")) {
      instructionLines.push(line);
      continue;
    }
    if (started) itemLines.push(line);
    else instructionLines.push(line);
  }

  const headingLines = body.filter((line) => line.startsWith("@@H@@"));
  const bodyLines = body.filter((line) => !line.startsWith("@@H@@")).map(clean);
  let instruction = clean([...instructionLines, ...headingLines.map((l) => l.slice(5))].join(" "));

  // Options that appear before the first numbered item belong to every question.
  const shared = extractOptions(instructionLines);
  const questionLines = itemLines;

  // Group numbered lines; a following unnumbered line continues the current item.
  const items = [];
  let current = null;
  for (const line of questionLines) {
    const numbered = BLANK_LINE.exec(line) || NUMBERED.exec(line);
    if (numbered && Number(numbered[1]) >= range.start && Number(numbered[1]) <= range.end) {
      current = { number: Number(numbered[1]), text: (numbered[2] ?? "").trim() };
      items.push(current);
    } else if (current) {
      if (/^SECTION\s+\d+/i.test(line) || /^Read the text below/i.test(line)) current = null;
      else current.text = `${current.text} ${line}`.trim();
    }
  }

  // Groups can carry no numbered lines at all: a lone "Question 13" whose stem
  // sits below, or "Choose FIVE letters A–J" where every box is a letter. Use
  // the stem line for each number in the range.
  const hasBlankMarkers = /\(\s*\d{1,2}\s*\)(?!\d)/.test(body.join(" "));
  if (!items.length && !hasBlankMarkers) {
    const all = extractOptions(bodyLines);
    const stemLine =
      [...all.rest].reverse().find((line) => !/^(choose|write|in boxes|nb\b)/i.test(line)) ?? all.rest.at(-1) ?? "";
    if (stemLine) {
      for (let n = range.start; n <= range.end && n - range.start < 10; n++) {
        items.push({ number: n, text: stemLine, synthetic: true });
      }
      instruction = instruction || clean(all.rest[0] ?? "");
      if (all.options.length) shared.options = all.options;
    }
  }

  return { instruction, sharedOptions: shared.options, items, body: bodyLines.join(" "), lines: bodyLines };
}

function parseAnswers(lines) {
  const answers = new Map();
  const valueLike = (line) =>
    line.length <= 60 &&
    line.split(/\s+/).length <= 6 &&
    !/^(show|hide)\s+answers/i.test(line) &&
    !/^explanations?\b/i.test(line) &&
    !/^\d{1,2}\s*[\.\)]/.test(line);

  // A bare list ("False", "Bulbs", "C"…) is positional and must be read before
  // the numbered scan: explanation paragraphs are numbered 1., 2., … and would
  // otherwise overwrite the real key.
  const bare = lines.filter(valueLike);
  // Unnumbered keys ("Red", "True", "not given"…) are positional. When there
  // are at least 20 short values, trust them even if footer lines are present.
  if (bare.length >= 20) {
    bare.slice(0, 40).forEach((value, index) => answers.set(index + 1, clean(value)));
    return answers;
  }
  if (bare.length >= 10 && bare.length >= lines.length * 0.6) {
    bare.forEach((value, index) => answers.set(index + 1, clean(value)));
    return answers;
  }

  // Otherwise the key is "N. value", either one per line or one wrapped line.
  const joined = lines.join(" ");
  for (const match of joined.matchAll(/(\d{1,2})\s*[\.\)]\s*(.*?)(?=\s+\d{1,2}\s*[\.\)]|$)/g)) {
    const n = Number(match[1]);
    const value = clean(match[2]).replace(/\s+\d{1,2}$/, "");
    if (n >= 1 && n <= 40 && value && !answers.has(n)) answers.set(n, value);
  }

  for (const line of lines) {
    const m = /^(\d{1,2})\s+(\S.*)$/.exec(line);
    if (!m) continue;
    const n = Number(m[1]);
    if (n >= 1 && n <= 40 && !answers.has(n)) answers.set(n, clean(m[2]));
  }

  if (answers.size < 5 && bare.length >= 10) {
    bare.forEach((value, index) => answers.set(index + 1, clean(value)));
  }
  return answers;
}

/** Locate the hidden "Show Answers" block and return its numbers. */
function splitAnswerKey(lines) {
  const body = [];
  let inKey = false;
  for (const line of lines) {
    if (/^show\s+an\w*ers$/i.test(line)) {
      inKey = true;
      continue;
    }
    if (inKey) body.push(line);
  }
  return body;
}


/** Article body -> plain lines + answer key + the test's audio source. */
function splitDocument(body) {
  const allLines = toLines(body);
  const keyAt = allLines.findIndex((l) => /^show\s+an\w*ers$/i.test(l));
  // Question headers are often whole-bold paragraphs, so they arrive tagged as
  // headings. Untag them before anything looks for question ranges.
  const lines = (keyAt === -1 ? allLines : allLines.slice(0, keyAt)).map((line) =>
    line.startsWith("@@H@@") && matchHeader(clean(line.slice(5))) ? clean(line.slice(5)) : line
  );
  // A header is sometimes glued to the end of the previous line
  // ("…on clothing labels. Questions 23 and 24"); give it its own line.
  const split = lines.flatMap((line) =>
    line
      .replace(
        /\.\s+(?=Questions?\s*\d{1,2}\s*(?:[-–—]|to|and)\s*\d{1,2})/g,
        ".\n"
      )
      .split("\n")
      .map((part) => part.trim())
      .filter(Boolean)
  );

  let answerLines = keyAt === -1 ? [] : allLines.slice(keyAt + 1, keyAt + 80);
  const explainAt = answerLines.findIndex((line) => /^explanations?\b/i.test(line));
  if (explainAt !== -1) answerLines = answerLines.slice(0, explainAt);
  return { lines: split, answers: parseAnswers(answerLines), audio: extractAudio(body) };
}

/** First audio file the page embeds, as an absolute URL. */
function extractAudio(body) {
  const m =
    /<audio\b[^>]*\bsrc="([^"]+)"/i.exec(body) ?? /<source\b[^>]*\bsrc="([^"]+)"/i.exec(body);
  if (!m) return null;
  let url = m[1].split("?")[0].replace(/([^:])\/{2,}/g, "$1/");
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://practicepteonline.com${url}`;
  return url;
}

/** Every question header in the document, including implicit ranges. */
function collectHeaders(lines) {
  const headers = [];
  const implicit = [];
  const EMBEDDED_RANGE = /answer\s+(?:the\s+)?questions?\s*(\d{1,2})\s*(?:[-–—]|to|and)\s*(\d{1,2})/i;
  lines.forEach((line, index) => {
    const range = matchHeader(line);
    if (range) {
      headers.push({ index, ...range });
      return;
    }
    // "Read the text below and answer Questions 1-7." carries the range but the
    // numbered items come later; anchor the group at the first of them.
    const embedded = EMBEDDED_RANGE.exec(line);
    if (!embedded) return;
    const start = Number(embedded[1]);
    const end = Number(embedded[2]);
    for (let j = index + 1; j < Math.min(lines.length, index + 90); j++) {
      const numbered = NUMBERED.exec(lines[j]) ?? BLANK_LINE.exec(lines[j]);
      if (numbered && Number(numbered[1]) === start) {
        implicit.push({ index: j - 1, start, end });
        return;
      }
    }
  });

  // An implicit range is only needed when the page never printed a real header.
  for (const candidate of implicit) {
    if (headers.some((header) => header.start === candidate.start && header.end === candidate.end)) continue;
    if (headers.some((header) => header.index === candidate.index)) continue;
    headers.push(candidate);
  }
  headers.sort((a, b) => a.index - b.index);
  return headers;
}

/** Parse every question group once, independent of passages. */
function collectGroups(lines, headers, stopAt = []) {
  const groups = [];
  for (const header of headers) {
    const nextHeader = headers.find((other) => other.index > header.index);
    // A passage heading also ends the block: the next passage's lettered
    // paragraphs would otherwise be read as this question's options.
    const nextStop = stopAt.filter((index) => index > header.index).sort((a, b) => a - b)[0];
    // Only stop at a passage heading when the group has already started —
    // many pages print the "Questions 1–7" header *before* the passage title.
    let endIndex = nextHeader ? nextHeader.index : lines.length;
    if (nextStop && nextStop > header.index) {
      const range = header;
      const startedBeforeStop = lines
        .slice(header.index + 1, nextStop)
        .some((line) => {
          const numbered = NUMBERED.exec(line) ?? BLANK_LINE.exec(line);
          if (!numbered) return false;
          const n = Number(numbered[1]);
          return n >= range.start && n <= range.end;
        });
      if (startedBeforeStop) endIndex = Math.min(endIndex, nextStop);
    }
    const parsed = parseQuestionSection({ match: header }, lines.slice(header.index + 1, endIndex));
    groups.push({ ...header, ...parsed });
  }

  // A section sometimes repeats its range as a label above the text and again
  // above the actual questions; keep the one that carries the items.
  const withItems = groups.filter((group) => group.items.length);
  const cleaned = groups.filter(
    (group) =>
      group.items.length ||
      !withItems.some((other) => other.start === group.start && other.end === group.end)
  );

  // "Questions 6-13" often titles a block that is then split into "Questions 6
  // and 7", "8 and 9"… — the container itself must not synthesise items.
  for (const group of cleaned) {
    if (!group.items.length || !group.items.every((item) => item.synthetic)) continue;
    const splitBelow = cleaned.some(
      (other) =>
        other.index > group.index &&
        other.start >= group.start &&
        other.end <= group.end &&
        other.start !== group.start
    );
    if (splitBelow) group.items = [];
  }
  const realRanges = new Set(
    cleaned
      .filter((group) => group.items.some((item) => !item.synthetic))
      .map((group) => `${group.start}-${group.end}`)
  );
  const final = cleaned.filter((group) => {
    const key = `${group.start}-${group.end}`;
    if (!realRanges.has(key)) return true;
    return !(group.items.length && group.items.every((item) => item.synthetic));
  });
  return final;
}

/**
 * Listening pages have no passages: one audio file covers all four parts, so the
 * whole test becomes a single section that owns every question.
 */
function parseListeningPage(html, meta) {
  const open = /<div[^>]*class="[^"]*\bentry-content\b[^"]*"[^>]*>/i.exec(html);
  const start = open ? open.index : 0;
  const articleEnd = html.indexOf("</article>", start);
  const body = html.slice(start, articleEnd === -1 ? undefined : articleEnd);

  const { lines, answers, audio } = splitDocument(body);
  const headers = collectHeaders(lines);
  const groups = collectGroups(lines, headers);

  if (args.debug) {
    console.log(
      `[debug ${meta.number}] audio=${audio} lines=${lines.length} groups=${groups.length}`
    );
  }

  return {
    sections: [
      {
        title: "Listening",
        paragraphs: [],
        groups,
        start: -1,
        end: lines.length,
        optionBox: findOptionBox(lines),
        blankContext: tableContext(body),
        audio,
      },
    ],
    answers,
    audio,
  };
}


/**
 * Writing pages hold one chart image and two prompts (Task 1 / Task 2). Task 1 is
 * useless without its chart, so the image is downloaded next to the content and
 * referenced root-relatively.
 */
async function parseWritingPage(html, meta) {
  const open = /<div[^>]*class="[^"]*\bentry-content\b[^"]*"[^>]*>/i.exec(html);
  const start = open ? open.index : 0;
  const articleEnd = html.indexOf("</article>", start);
  const body = html.slice(start, articleEnd === -1 ? undefined : articleEnd);

  const text = clean(
    decode(body.replace(/<[^>]+>/g, " "))
      .replace(/Cambridge IELTS Tests?\s*\d+\s*to\s*\d+/i, " ")
      .replace(/\s+/g, " ")
  );

  // The site occasionally labels the second prompt "Test 2".
  const MARK = "(?:task|test)";
  const task1At = new RegExp(`\\b${MARK}\\s*1\\s*[:.]`, "i").exec(text);
  if (!task1At) return { error: "could not locate Task 1" };
  const rest = text.slice(task1At.index + task1At[0].length);
  const task2At = new RegExp(`\\b${MARK}\\s*2\\s*[:.]`, "i").exec(rest);
  if (!task2At) return { error: "could not locate Task 2" };

  const task1 = rest.slice(0, task2At.index).trim();
  const task2 = rest.slice(task2At.index + task2At[0].length).trim();
  if (task1.length < 40 || task2.length < 40) return { error: "task prompts too short" };

  const image = await downloadImage(body, meta);
  const tableText = image ? null : tableToText(body);

  return {
    sections: [
      {
        title: "Tasks",
        paragraphs: [],
        groups: [
          {
            start: 1,
            end: 1,
            instruction: "Academic Writing Task 1",
            sharedOptions: [],
            items: [
              {
                number: 1,
                text: tableText ? `${task1}\n\n${tableText}` : task1,
              },
            ],
            body: task1,
            lines: [task1],
          },
          {
            start: 2,
            end: 2,
            instruction: "Academic Writing Task 2",
            sharedOptions: [],
            items: [{ number: 2, text: task2 }],
            body: task2,
            lines: [task2],
          },
        ],
        start: -1,
        end: 0,
        image,
        taskNumbers: [1, 2],
      },
    ],
    answers: new Map(),
  };
}

/** Turn the first HTML table into aligned plain text (some Task 1 pages use one). */
function tableToText(body) {
  const table = /<table[\s\S]*?<\/table>/i.exec(body);
  if (!table) return null;
  const rows = [...table[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((row) =>
    [...row[0].matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
      .map((cell) => clean(decode(cell[1].replace(/<[^>]+>/g, " "))))
      .filter((cell) => cell.length > 0)
  );
  const kept = rows.filter((cells) => cells.length >= 2);
  if (kept.length < 2) return null;
  return kept.map((cells) => cells.join(" | ")).join("\n");
}

/** Save the task-1 chart under public/assets/writing and return its path. */
async function downloadImage(body, meta) {
  const found = [...body.matchAll(/<img[^>]*\bsrc="([^"]+)"/gi)].map((m) => m[1]);
  let src = found.find((url) => /\/uploads\//i.test(url));
  if (!src) return null;
  if (src.startsWith("//")) src = `https:${src}`;
  else if (src.startsWith("/")) src = `https://practicepteonline.com${src}`;

  const ext = (/\.(png|jpe?g|gif|webp|svg)(?:\?|$)/i.exec(src)?.[1] ?? "png").toLowerCase();
  const dir = path.join(ROOT, "public", "assets", "writing");
  const file = `pte-writing-${meta.number}.${ext}`;
  const target = path.join(dir, file);
  mkdirSync(dir, { recursive: true });

  if (!existsSync(target) || args.force) {
    try {
      const res = await fetch(src, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(45_000) });
      if (!res.ok) throw new Error(`image HTTP ${res.status}`);
      writeFileSync(target, Buffer.from(await res.arrayBuffer()));
    } catch (error) {
      // Node's fetch occasionally times out against this host; curl is reliable.
      const { execFileSync } = await import("node:child_process");
      execFileSync("curl", ["-sSfL", "-A", UA, "-o", target, src], { timeout: 60_000 });
    }
    await sleep(150);
  }
  return `/assets/writing/${file}`;
}


/**
 * Table completion loses its row labels when cells are flattened to lines:
 * "Poetry | warm clothes | (15)…… | (16)……". Map each numbered blank to the row
 * it sits in so a cell-only blank still has context.
 */
function tableContext(body) {
  const map = new Map();
  const blankAt = /\(\s*(\d{1,2})\s*\)\s*(?:[£$€]\s*)?[.…_·•]{2,}|\(\s*(\d{1,2})\s*\)(?!\d)|(?:^|\s)(\d{1,2})\s*[.…_·•]{3,}/g;

  for (const table of body.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    for (const row of table[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
      const cells = [...row[0].matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((cell) =>
        clean(
          decode(cell[1].replace(/<br\s*\/?>/gi, " / ").replace(/<[^>]+>/g, " "))
        )
      );
      const kept = cells.filter(Boolean);
      if (kept.length < 2) continue;
      const rowText = kept.join(" | ");
      for (const match of rowText.matchAll(blankAt)) {
        const n = Number(match[1] ?? match[2] ?? match[3]);
        if (n >= 1 && n <= 40 && !map.has(n)) map.set(n, rowText);
      }
    }
  }
  return map;
}

function parsePage(html, meta) {
  const open = /<div[^>]*class="[^"]*\bentry-content\b[^"]*"[^>]*>/i.exec(html);
  const start = open ? open.index : 0;
  const articleEnd = html.indexOf("</article>", start);
  const body = html.slice(start, articleEnd === -1 ? undefined : articleEnd);

  const { lines, answers } = splitDocument(body);

  // The key can sit outside the article boundary the body was sliced at; parse
  // it from the whole page and merge anything missing.
  const fullLines = toLines(html);
  const fullKeyAt = fullLines.findIndex((line) => /^show\s+an\w*ers$/i.test(line));
  if (fullKeyAt !== -1) {
    const fullAnswers = parseAnswers(fullLines.slice(fullKeyAt + 1, fullKeyAt + 120));
    for (const [number, value] of fullAnswers) {
      if (!answers.has(number)) answers.set(number, value);
    }
  }

  // Passages are headings (h1–h5, inconsistently marked). The page title is the
  // first heading and is always "IELTS Reading Test N".
  const headings = [];
  const offsets = [];
  let cursorOffset = 0;
  lines.forEach((line, index) => {
    offsets[index] = cursorOffset;
    cursorOffset += line.length;
    if (!line.startsWith("@@H@@")) return;
    const title = clean(line.slice(5));
    if (!title || /^IELTS\s+(academic\s+|general\s+)?reading\s+test\b/i.test(title)) return;
    if (/^reading\s+test\s+\d+$/i.test(title)) return;
    headings.push({ index, title, offset: offsets[index] });
  });

  const firstQuestionAfter = (from) => {
    for (let i = from; i < lines.length; i++) {
      if (matchHeader(lines[i])) return i;
      if (lines[i].startsWith("@@H@@")) return i;
    }
    return lines.length;
  };

  const scored = headings.map((head) => {
    const last = firstQuestionAfter(head.index + 1);
    const prose = lines
      .slice(head.index + 1, last)
      .reduce((n, l) => n + l.length, 0);
    return { ...head, prose };
  });

  const headers = collectHeaders(lines);

  // General Training pages rarely title their texts with headings: each text is
  // introduced by a lead-in ("Now, read the information below…") and sections
  // carry "Section 1/2/3" markers. Build boundaries from both, then keep every
  // segment that actually carries prose.
  const pickGeneral = () => {
    const boundaries = [];
    lines.forEach((line, index) => {
      if (line.startsWith("@@H@@")) {
        const title = clean(line.slice(5));
        if (!title || /^IELTS\s+(academic\s+|general\s+)?reading\s+test\b/i.test(title)) return;
        if (/^sections?\s*\d+\s*$/i.test(title)) return;
        if (/^(list of|questions?\b|cambridge ielts|ielts\b|recent posts|advertisement)/i.test(title)) return;
        boundaries.push({ index, title });
        return;
      }
      if (/^(now,?\s*read|you are advised to spend|read the (text|passage|information))/i.test(line)) {
        boundaries.push({ index, title: "" });
      }
    });

    const texts = [];
    for (const [i, boundary] of boundaries.entries()) {
      const end = boundaries[i + 1]?.index ?? lines.length;
      const firstHeader = headers.find((h) => h.index > boundary.index && h.index < end);
      const proseEnd = firstHeader ? firstHeader.index : end;
      const prose = lines.slice(boundary.index + 1, proseEnd).reduce((n, l) => n + l.length, 0);
      // A lead-in followed straight by a heading is the same text: the heading wins.
      const nextIsHeading = boundaries[i + 1] && lines[boundaries[i + 1].index].startsWith("@@H@@");
      if (!boundary.title && nextIsHeading) continue;
      if (prose < 150) continue;
      texts.push({ ...boundary, prose, end });
    }

    // A text with no question group of its own is a continuation of the previous
    // one (sub-heading, second advert) — fold it in so nothing is orphaned.
    const kept = [];
    for (const text of texts) {
      const hasQuestions = headers.some((h) => h.index > text.index && h.index < text.end);
      const previous = kept.at(-1);
      if (!hasQuestions && previous) {
        previous.end = text.end;
        continue;
      }
      kept.push({ ...text });
    }
    return kept.map((text, i) => ({ ...text, title: text.title || `Text ${i + 1}` }));
  };

  // Walk the headings in order and keep the ones that actually start a passage:
  // its first question must come after every question we have already placed,
  // and the heading must be followed by prose before that question.
  const IGNORE_TITLE =
    /^(list of headings|list of words|questions?\b|cambridge ielts|ielts\b|recent posts|advertisement)/i;

  const pickAcademic = () => {
    const picked = [];
    let placedUpTo = 0;
    for (const head of scored) {
      if (IGNORE_TITLE.test(head.title)) continue;
      // A title followed by almost no text is a label for an image-based table.
      if (head.prose < 400) continue;
      const next = scored.find((other) => other.index > head.index)?.index ?? lines.length;
      const inRegion = headers.filter((h) => h.index > head.index && h.index < next);
      const first = inRegion[0];
      if (!first) continue;
      if (first.start <= placedUpTo) continue;
      const owned = inRegion.reduce((sum, h) => sum + (h.end - h.start + 1), 0);
      if (owned < 3) continue;
      const lastEnd = Math.max(...inRegion.map((h) => h.end));
      // "Reading Passage 2" is used as a placeholder title when the article has none.
      const placeholder = /^(?:reading\s+)?passage\s*(\d+)$/i.exec(head.title);
      picked.push(placeholder ? { ...head, title: `Passage ${placeholder[1]}` } : head);
      placedUpTo = lastEnd;
      if (picked.length === 3) break;
    }
    if (picked.length < 2) picked = scored.filter((h) => h.prose >= 600).slice(0, 3);
    return picked;
  };

  let picked = TRACK === TRACKS.general ? pickGeneral() : pickAcademic();
  picked.sort((a, b) => a.index - b.index);

  if (args.debug) {
    console.log(
      `[debug ${meta.number}] lines=${lines.length} headers=${headers.length} groups=${headers.length} answers=${answers.size}`
    );
    console.log(
      `[debug ${meta.number}] headings:`,
      scored.map((h) => `${JSON.stringify(h.title).slice(0, 40)} prose=${h.prose}`)
    );
    console.log(
      `[debug ${meta.number}] picked:`,
      picked.map((h) => h.title)
    );
  }

  const groups = collectGroups(lines, headers, picked.map((head) => head.index));

  if (args.debug) {
    console.log(
      `[debug ${meta.number}] group items:`,
      groups.map((g) => `${g.start}-${g.end}:${g.items.length}`).join(" ")
    );
  }

  const blankContext = tableContext(body);

  const sections = picked.map((head, i) => {
    const end = picked[i + 1]?.index ?? lines.length;
    const region = lines.slice(head.index + 1, end);
    const qAt = region.findIndex((l) => matchHeader(l));
    const passageLines = qAt === -1 ? region : region.slice(0, qAt);

    // Passage paragraphs: a lettered label starts a new paragraph.
    const paragraphs = [];
    for (const line of passageLines) {
      if (line.startsWith("@@H@@") || line.startsWith("@@S@@")) continue;
      if (/^sections?\s*\d+\s*$/i.test(line)) continue;
      const label = PARAGRAPH_LABEL.exec(line);
      if (label) paragraphs.push(`(${label[1]}) ${clean(label[2])}`);
      else if (!paragraphs.length) paragraphs.push(clean(line));
      else if (line.length < 120 && !/[.!?]$/.test(line)) paragraphs.push(clean(line));
      else paragraphs[paragraphs.length - 1] += ` ${clean(line)}`;
    }

    // A group belongs to the passage whose region contains its header. Groups
    // that fall outside a picked region still attach to the nearest visible one
    // so no question is silently dropped.
    const mine = groups.filter((group) => group.index > head.index && group.index < end);
    return {
      title: head.title,
      paragraphs,
      groups: mine,
      start: head.index,
      end,
      optionBox: findOptionBox(region),
      blankContext,
    };
  });

  const placed = new Set(sections.flatMap((section) => section.groups.map((g) => g.index)));
  for (const group of groups) {
    if (placed.has(group.index)) continue;
    const owner = [...sections].reverse().find((section) => section.start < group.index) ?? sections[0];
    owner?.groups.push(group);
  }
  for (const section of sections) section.groups.sort((a, b) => a.index - b.index);

  return { sections, answers, headingCount: headings.length, lines };
}

/* --------------------------------------------------------------- assemble */

function buildTest(parsed, meta) {
  const skill = TRACK.skill ?? "reading";
  const problems = [];
  const seenNumbers = new Set();
  const builtSections = [];

  for (const [si, section] of parsed.sections.entries()) {
    const sectionQuestions = [];

    for (const group of section.groups) {
      const type = inferType(group.instruction, group.items, group.sharedOptions);
      let options = optionsFor(type, group.instruction, group.sharedOptions);

      // Paragraph-matching groups sometimes label paragraphs I–VII; the key is
      // Roman numerals, so build Roman options instead of A–J letters.
      const groupKeys = group.items
        .map((item) => clean(parsed.answers.get(item.number) ?? ""))
        .filter(Boolean);
      const romanKey = (value) => ROMAN_UPPER.includes(value.toUpperCase());
      const romanMode =
        groupKeys.length > 0 &&
        groupKeys.filter(romanKey).length >= Math.max(1, Math.ceil(groupKeys.length * 0.6));
      if ((type === "matching" || type === "mcq") && romanMode) {
        const missing = groupKeys.some(
          (value) => !options.some((option) => option.id.toUpperCase() === value.toUpperCase())
        );
        if (!options.length || missing) {
          const range = /(?:paragraphs?|sections?)[^.]{0,60}?\bI\s*[-–—]\s*([IVX]+)\b/i.exec(group.instruction);
          let last = range ? ROMAN_UPPER.indexOf(range[1].toUpperCase()) : -1;
          for (const value of groupKeys) {
            last = Math.max(last, ROMAN_UPPER.indexOf(value.toUpperCase()));
          }
          if (last >= 0) {
            options = ROMAN_UPPER.slice(0, last + 1).map((id) => ({ id, text: `Paragraph ${id}` }));
          }
        }
      }

      if (!options.length && /box|below|list of/i.test(group.instruction)) {
        const localBox = findOptionBox(group.lines ?? []);
        options = localBox.length ? localBox : section.optionBox ?? [];
      }

      // "Which paragraph contains…" answers are paragraph letters, which the
      // page never lists separately.
      if (!options.length && (type === "matching" || type === "mcq") && /paragraph|section/i.test(group.instruction)) {
        const span = /(?:paragraphs?|sections?)[^.]{0,40}?\bA\s*[-–—]\s*([A-Jl])\b/i.exec(group.instruction)
          ?? /\bA\s*[-–—]\s*([A-Jl])\b(?![^.]*boxes)/i.exec(group.instruction);
        let last = span ? span[1].toUpperCase() : "";
        if (last === "L") last = "I";

        // Fall back to the paragraph labels actually present in the passage.
        if (!last) {
          const labels = section.paragraphs
            .map((paragraph) => /^\(([A-I])\)/.exec(paragraph)?.[1])
            .filter(Boolean);
          if (labels.length >= 2) last = labels.at(-1);
        }

        if (!last && type === "matching" && section.paragraphs.length >= 3) {
          last = "ABCDEFGHIJ"[Math.min(section.paragraphs.length, 10) - 1];
        }

        if (last) {
          options = "ABCDEFGHIJ".slice(0, "ABCDEFGHIJ".indexOf(last) + 1)
            .split("")
            .map((id) => ({ id, text: `Paragraph ${id}` }));
        }
      }

      // Summary/notes completions often put the number inside the sentence:
      // "According to (9) ……… there is only one correct form". Recover those.
      if (type === "gap" || type === "matching" || type === "short") {
        const covered = new Set(group.items.map((item) => item.number));
        const sentences = group.body.split(/(?<=[.!?])\s+/);
        for (let n = group.start; n <= group.end; n++) {
          if (covered.has(n)) continue;
          const marker = new RegExp(`\\(\\s*${n}\\s*\\)\\s*(?:[£$€]\\s*)?[.…_·•]{2,}`);
          // Notes-style items mark the gap with a bare "(21)" instead of dots.
          const bare = new RegExp(`\\(\\s*${n}\\s*\\)(?!\\d)`);
          const usable = (line) => line.replace(/<[^>]+>/g, "").length > 4;
          const sourceLine =
            group.lines.find((line) => marker.test(line) && usable(line)) ??
            group.lines.find((line) => bare.test(line) && usable(line));
          const sentence = sourceLine ?? sentences.find((s) => marker.test(s) || bare.test(s));
          if (sentence) group.items.push({ number: n, text: sentence.trim(), synthetic: true });
        }
        group.items.sort((a, b) => a.number - b.number);
      }

      for (const item of group.items) {
        const number = item.number;
        if (number < 1 || number > 40) continue;

        if ((TRACK.skill ?? "reading") === "writing") {
          if (seenNumbers.has(number)) continue;
          seenNumbers.add(number);
          const question = {
            id: `${TRACK.id(meta.number)}-q${number}`,
            skill: "writing",
            type: "writing",
            graded: false,
            // Keep the data-table line breaks; only collapse runs of spaces.
            prompt: item.text
              .replace(/[ \t]+/g, " ")
              .replace(/\n{3,}/g, "\n\n")
              .trim(),
            answer: "",
            difficulty: 2,
          };
          if (number === 1 && section.image) question.image = section.image;
          sectionQuestions.push(question);
          continue;
        }
        if (seenNumbers.has(number)) {
          problems.push(`Q${number}: duplicate number, skipped`);
          continue;
        }
        seenNumbers.add(number);

        let stem = item.text;
        let qType = type;
        let itemOpts = type === "gap" || type === "short" ? [] : options;

        // Options may be written inline after the stem; when they are, the item
        // is a single-answer choice question whatever the group instruction said.
        const inlineChoices = splitInlineOptions(stem);
        if (inlineChoices) {
          // Always drop the option text out of the prompt; only treat the item as
          // a choice question when the key actually points at one of the letters.
          const key = clean(parsed.answers.get(number) ?? "").toUpperCase();
          const isChoice = inlineChoices.options.some((option) => option.id === key);
          stem = inlineChoices.stem;
          if (isChoice) {
            itemOpts = inlineChoices.options;
            qType = "mcq";
          }
        }

        // A matching/multi group can list its options once, before the numbers.
        if (!itemOpts.length && (qType === "mcq" || qType === "matching")) {
          const inline = extractOptions([stem]);
          if (inline.options.length === 1 && inline.options[0].text.length < 120) {
            itemOpts = [{ id: "A", text: inline.options[0].text }];
            stem = "";
          }
        }

        if ((qType === "mcq" || qType === "matching") && itemOpts.length < 2) {
          problems.push(`Q${number}: no options found, skipped`);
          continue;
        }

        const raw = parsed.answers.get(number) ?? "";
        let answer = normaliseAnswer(raw, itemOpts, qType);
        // Some keys give one letter set for a whole "choose FOUR letters" block
        // (36-39 all keyed "B, C, E, G"): keep the set and ask for a multi-select.
        if (Array.isArray(answer)) {
          if (answer.length >= 2 && itemOpts.length) qType = "multi";
          else answer = answer[0] ?? "";
        }
        const expected = Array.isArray(answer) ? answer : [answer];
        if (!expected.length || !expected[0]) {
          problems.push(`Q${number}: no answer key, skipped`);
          continue;
        }
        if (itemOpts.length && !expected.every((value) => itemOpts.some((option) => option.id === value))) {
          problems.push(`Q${number}: answer "${expected.join(", ")}" not in options, skipped`);
          continue;
        }

        let prompt =
          qType === "gap" || qType === "short"
            ? blankPrompt(stem || `Question ${number}`, number)
            : clean(stem) || `Question ${number}`;

        // A blank lifted out of a table cell has no wording of its own; restore the
        // row it belongs to so the question is answerable.
        const wordless = (text) =>
          !/[A-Za-z]{2,}/.test(
            String(text)
              .replace(/_+/g, " ")
              .replace(/\bquestions?\b/gi, " ")
              .replace(/\d+/g, " ")
              .replace(/[^A-Za-z ]+/g, " ")
          );
        if (wordless(prompt) && qType !== "writing") {
          const row = section.blankContext?.get(number);
          if (row) prompt = blankPrompt(row, number);
        }
        // Still nothing to ask about (blank sat in an image-based table): shipping it
        // would only ever produce a guaranteed-wrong answer.
        if (wordless(prompt) && qType !== "writing") {
          problems.push(`Q${number}: no question text recoverable, skipped`);
          continue;
        }
        if ((qType === "gap" || qType === "short") && answer.length > 80) {
          problems.push(`Q${number}: answer looks like prose (${answer.length} chars), skipped`);
          continue;
        }

        // Diagram/table questions only exist as images on the source page, so
        // there is no text to ask about — drop rather than ship a blind prompt.
        const imageTask = /label the (diagram|map)|complete the diagram|match the pictures|the diagram below/i.test(
          group.instruction
        );
        if (prompt.includes("@@H@@") || (imageTask && clean(stem) === clean(group.instruction))) {
          problems.push(`Q${number}: image-only, skipped`);
          continue;
        }

        const question = {
          id: `${TRACK.id(meta.number)}-q${number}`,
          skill: TRACK.skill ?? "reading",
          type: qType,
          prompt,
        };
        if (skill === "writing" && section.image && number === 1) question.image = section.image;
        if (itemOpts.length) question.options = itemOpts;
        question.answer = answer;
        question.difficulty = 2;
        sectionQuestions.push(question);
      }
    }

    if (args.debug) console.log(`[debug ${meta.number}] built ${sectionQuestions.length} in ${section.title}`);
    if (!sectionQuestions.length) continue;
    const built = {
      id: `${skill === "listening" ? "audio" : "passage"}-${si + 1}`,
      skill,
      title:
        skill === "listening"
          ? "Listening — Questions 1–40"
          : `Reading — ${TRACK.sectionLabel} ${si + 1}: ${clean(section.title)}`,
      instructions:
        skill === "listening"
          ? "Listen to the recording once and answer the questions as you go."
          : "Read the passage, then answer the questions.",
      questions: sectionQuestions,
    };
    if (section.audio) built.audio = section.audio;
    if (skill !== "listening") {
      built.passage = {
        id: `p${si + 1}`,
        title: clean(section.title),
        text: section.paragraphs.join("\n\n"),
      };
    }
    builtSections.push(built);
  }

  if (args.debug) {
    console.log(
      `[debug ${meta.number}] sections:`,
      parsed.sections.map((s) => `${JSON.stringify(s.title).slice(0, 24)} groups=${s.groups.length}`).join(" | ")
    );
  }
  // Fallback: recover numbered questions the group parser missed, using the
  // page's own numbered lines and the answer key. This is what gets tests from
  // 30-something questions back to 40.
  if (skill === "reading" && Array.isArray(parsed.lines)) {
    const num = (question) => Number(/-q(\d+)$/.exec(question.id)?.[1] ?? 0);
    const have = new Set(builtSections.flatMap((section) => section.questions.map(num)));
    const keyAt = parsed.lines.findIndex((line) => /^show\s+an\w*ers$/i.test(line));
    const search = keyAt === -1 ? parsed.lines : parsed.lines.slice(0, keyAt);
    const letters = "ABCDEFGHIJ";
    let filled = 0;
    if (args.debug) console.log(`[debug ${meta.number}] fallback missing=${[...Array(40)].map((_, i) => i + 1).filter((n) => !have.has(n)).join(",")} answers=${parsed.answers.size}`);
    for (let n = 1; n <= 40; n++) {
      if (have.has(n)) continue;
      let idx = search.findIndex((line) => new RegExp(`^${n}(?:[.)]|\\s)\\s*\\S`).test(line));
      let inlineBlank = false;
      if (idx < 0) {
        idx = search.findIndex(
          (line) =>
            new RegExp(`\\(\\s*${n}\\s*\\)\\s*[.…_·•]{2,}`).test(line) &&
            /[A-Za-z]{3,}/.test(line)
        );
        inlineBlank = idx >= 0;
      }
      if (idx < 0) continue;
      const answer = clean(parsed.answers.get(n) ?? "");
      if (!answer) continue;
      const text = clean(search[idx].replace(new RegExp(`^${n}\\s*[.)]?\\s*`), ""));
      if (text.length < 6) continue;

      let qType;
      let options = [];
      let prompt;
      const lower = answer.toLowerCase();
      if (/^(true|false|not given|yes|no)$/.test(lower)) {
        qType = "tfng";
        options = optionsFor("tfng", /^(yes|no)$/.test(lower) ? "yes" : "true", []);
        prompt = text;
      } else if (/^[A-J]$/i.test(answer)) {
        qType = "matching";
        let nearby = extractOptions(search.slice(Math.max(0, idx - 70), idx)).options;
        if (!nearby.some((option) => option.id.toUpperCase() === answer.toUpperCase())) {
          const forward = extractOptions(search.slice(idx + 1, idx + 70)).options;
          if (forward.some((option) => option.id.toUpperCase() === answer.toUpperCase())) nearby = forward;
        }
        if (nearby.length >= 2) {
          options = nearby;
        } else {
          const wantsParagraph = /paragraph/i.test(search.slice(Math.max(0, idx - 30), idx).join(" "));
          const last = letters.indexOf(answer.toUpperCase());
          options = letters
            .slice(0, Math.max(last, 1) + 1)
            .split("")
            .map((id) => ({ id, text: `${wantsParagraph ? "Paragraph" : "Option"} ${id}` }));
        }
        prompt = text;
      } else {
        qType = "gap";
        prompt = blankPrompt(text, n);
      }
      if (inlineBlank) {
        qType = "gap";
        const marker = new RegExp(`\\(\\s*${n}\\s*\\)`);
        const all = [...text.matchAll(/\\(\\s*\\d{1,2}\\s*\\)/g)];
        const at = text.search(marker);
        const before = all.filter((m) => m.index < at).at(-1);
        const after = all.find((m) => m.index > at);
        const start = before ? before.index + before[0].length : 0;
        const end = after ? after.index : text.length;
        const segment = text.slice(start, end).trim() || text;
        prompt = blankPrompt(segment, n);
      }
      if (!prompt || prompt.length < 6) continue;

      const question = {
        id: `${TRACK.id(meta.number)}-q${n}`,
        skill: "reading",
        type: qType,
        prompt,
        ...(options.length ? { options } : {}),
        answer,
        difficulty: 2,
      };
      const numbered = (section) =>
        section.questions
          .map(num)
          .filter(Boolean)
          .sort((a, b) => a - b);
      let target =
        builtSections.find((section) => {
          const list = numbered(section);
          return list.length && n >= list[0] && n <= list[list.length - 1];
        }) ??
        [...builtSections].reverse().find((section) => {
          const list = numbered(section);
          return list.length && list[list.length - 1] < n;
        }) ??
        builtSections[0];
      if (!target) continue;
      target.questions.push(question);
      target.questions.sort((a, b) => num(a) - num(b));
      have.add(n);
      filled += 1;
    }
  }

  if (args.debug) console.log(`[debug ${meta.number}] fallback filled=${typeof filled !== "undefined" ? filled : 0}`);
  const questions = builtSections.flatMap((s) => s.questions);
  if (!questions.length) return { error: "no questions parsed", problems };
  if (TRACK.skill !== "writing" && parsed.answers.size < 10)
    return { error: `answer key missing (${parsed.answers.size} answers)`, problems };
  if (TRACK.skill !== "writing" && questions.length < 30)
    problems.push(`only ${questions.length} questions parsed`);

  // Any question number present in the answer key but never placed?
  const missing = [...parsed.answers.keys()].filter((n) => !seenNumbers.has(n)).sort((a, b) => a - b);
  if (missing.length) problems.push(`unplaced answers: ${missing.join(",")}`);

  return {
    test: {
      id: TRACK.id(meta.number),
      title: TRACK.title(meta.number),
      kind: "practice",
      description:
        TRACK.skill === "listening"
          ? `One recording, ${questions.length} questions.`
          : `${builtSections.length} texts, ${questions.length} questions.`,
      durationMinutes: TRACK.durationMinutes ?? 60,
      sections: builtSections,
    },
    problems,
  };
}

/* ------------------------------------------------------------------- main */

async function main() {
  mkdirSync(CACHE, { recursive: true });
  mkdirSync(OUT, { recursive: true });

  const indexFile = path.join(CACHE, "index.html");
  let indexHtml;
  if (existsSync(indexFile) && !args.refresh) {
    indexHtml = readFileSync(indexFile, "utf8");
  } else {
    indexHtml = await fetchText(TRACK.index);
    writeFileSync(indexFile, indexHtml);
  }

  const hrefs = [...indexHtml.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
  const urls = [...new Set(hrefs)]
    .filter((h) => TRACK.link.test(h.replace(/([^:])\/{2,}/g, "$1/")))
    .map((h) => (h.startsWith("http") ? h : `https://practicepteonline.com${h}`));

  // Sites occasionally renumber; keep the numeric part as the canonical number.
  const list = urls
    .map((url) => {
      const clean = url.replace(/([^:])\/{2,}/g, "$1/");
      const n = Number(TRACK.link.exec(clean)?.[1] ?? 0);
      return { url: clean, number: n };
    })
    .filter((x) => x.number > 0)
    .filter((x, i, all) => all.findIndex((other) => other.number === x.number) === i)
    .sort((a, b) => a.number - b.number);

  const from = Number(args.from ?? 1);
  const to = Number(args.to ?? 999);
  const targets = list.filter((x) => x.number >= from && x.number <= to);

  console.log(`index: ${list.length} tests (${list[0]?.number}–${list.at(-1)?.number}); importing ${targets.length}`);

  if (args.list) {
    console.log(targets.map((t) => `${t.number} ${t.url}`).join("\n"));
    return;
  }

  const report = [];
  await mapLimit(targets, CONCURRENCY, async (target) => {
    const cacheFile = path.join(CACHE, `test-${target.number}.html`);
    let html;
    try {
      if (existsSync(cacheFile) && !args.force) html = readFileSync(cacheFile, "utf8");
      else {
        html = await fetchText(target.url);
        writeFileSync(cacheFile, html);
        await sleep(400);
      }
    } catch (error) {
      report.push({ number: target.number, status: "fetch-failed", detail: error.message });
      return;
    }

    let parsed;
    let built;
    try {
      if (TRACK.skill === "writing") parsed = await parseWritingPage(html, target);
      else parsed = TRACK.skill === "listening" ? parseListeningPage(html, target) : parsePage(html, target);
      if (parsed?.error) {
        report.push({ number: target.number, status: "rejected", detail: parsed.error });
        return;
      }
      built = buildTest(parsed, target);
    } catch (error) {
      if (args.debug) console.error(error.stack?.split("\n").slice(0, 8).join("\n"));
      report.push({ number: target.number, status: "parse-failed", detail: error.message });
      return;
    }

    if (built.error) {
      report.push({
        number: target.number,
        status: "rejected",
        detail: `${built.error}${built.problems?.length ? " — " + built.problems.slice(0, 4).join("; ") : ""}`,
      });
      return;
    }

    const file = path.join(OUT, `${built.test.id}.json`);
    writeFileSync(file, `${JSON.stringify(built.test, null, 2)}\n`);
    report.push({
      number: target.number,
      status: built.problems.length ? "warn" : "ok",
      questions: built.test.sections.reduce((n, s) => n + s.questions.length, 0),
      passages: built.test.sections.length,
      detail: built.problems.slice(0, 4).join("; "),
    });
  });

  report.sort((a, b) => a.number - b.number);
  const counts = report.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  console.log(counts);
  const bad = report.filter((r) => r.status !== "ok");
  if (bad.length) {
    writeFileSync(path.join(CACHE, "report.json"), JSON.stringify(report, null, 2));
    console.log(`\n${bad.length} tests need attention (see scripts/.cache/reading/report.json):`);
    for (const item of bad.slice(0, 40)) console.log(`  ${item.number} ${item.status}: ${item.detail}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
