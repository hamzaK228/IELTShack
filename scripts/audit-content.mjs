#!/usr/bin/env node
/**
 * Audits every imported test against its own source page.
 *
 * Three independent passes:
 *  1. shape   — does the answer look like an answer for this question type?
 *  2. prompt  — leftover parser artefacts, duplicated stems, empty text
 *  3. key     — the answer key is re-extracted from the cached HTML with a
 *               separate, simpler parser and compared question by question.
 *
 *   node scripts/audit-content.mjs            # summary + worst files
 *   node scripts/audit-content.mjs --verbose  # every finding
 *   node scripts/audit-content.mjs --json     # machine-readable report
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TESTS = path.join(ROOT, "content", "tests");
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

const CACHE_BY_PREFIX = [
  ["pte-gt-reading-", "gt-reading"],
  ["pte-listening-", "listening"],
  ["pte-writing-", "writing"],
  ["pte-reading-", "reading"],
];

function cacheDirFor(testId) {
  const hit = CACHE_BY_PREFIX.find(([prefix]) => testId.startsWith(prefix));
  if (!hit) return null;
  const number = testId.slice(hit[0].length);
  return { dir: path.join(ROOT, "scripts", ".cache", hit[1]), file: `test-${number}.html` };
}

const ENTITIES = {
  nbsp: " ", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’",
  ldquo: "“", rdquo: "”", hellip: "…", amp: "&", apos: "'", quot: '"',
  pound: "£", euro: "€", times: "×",
};

function decode(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

/** Collapse the ways a True/False/Not-Given answer gets written. */
function answerSynonym(value) {
  const key = normal(value);
  if (/^(yes|true|t|y|ture)$/.test(key)) return "yes";
  if (/^(no|false|f|n|fasle|flase)$/.test(key)) return "no";
  if (/^(not given|notgiven|ng|n\/g)$/.test(key)) return "not given";
  return key;
}

function normal(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[.,;:!?"'()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* --------------------------------------------------- independent key parse */

/**
 * Independent key reader: rebuilds lines straight from the answer block, stops at
 * the explanations, then reads either a positional list or "N. value" pairs.
 */
function keyFromHtml(html) {
  const at = html.search(/Show Answers/i);
  if (at === -1) return new Map();

  let tail = html.slice(at);
  const stop = tail.search(/Explanations?\b/i);
  if (stop !== -1) tail = tail.slice(0, stop);
  const foot = tail.search(/a2a_button|addtoany|related-posts/i);
  if (foot !== -1) tail = tail.slice(0, foot);

  const lines = decode(
    tail
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|td|th)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && !/show answers/i.test(line) && !line.includes("<"));

  const valueLike = (line) =>
    line.length <= 60 &&
    line.split(/\s+/).length <= 6 &&
    !/^\d{1,2}\s*[.)]/.test(line) &&
    !/^explanations?\b/i.test(line);

  const key = new Map();
  const bare = lines.filter(valueLike);
  if (bare.length >= 10) {
    bare.forEach((value, index) => key.set(index + 1, value));
    return key;
  }

  const joined = lines.join(" ");
  for (const match of joined.matchAll(/(\d{1,2})\s*[.)]\s*(.*?)(?=\s+\d{1,2}\s*[.)]|$)/g)) {
    const n = Number(match[1]);
    const value = match[2].trim();
    if (n >= 1 && n <= 40 && value && !key.has(n)) key.set(n, value);
  }
  return key;
}

/* --------------------------------------------------------------- checks */

const OPTION_TYPES = new Set(["mcq", "matching"]);
const JUNK_ANSWER =
  /(questions?\s*\d|show answers|choose the|write the|no more than|in boxes)/i;

function auditTest(test, file) {
  const findings = [];
  const add = (kind, questionId, detail) => findings.push({ kind, questionId, detail });

  if (!Array.isArray(test.sections) || !test.sections.length) {
    add("structure", null, "no sections");
    return { findings, questions: 0 };
  }

  const seenIds = new Set();
  const promptCounts = new Map();
  let questions = 0;

  for (const section of test.sections) {
    if (!section.questions?.length) add("structure", section.id, "section without questions");
    if (!["writing", "speaking"].includes(section.skill) && !section.passage && !section.audio) {
      add("structure", section.id, "no passage or audio");
    }
    if (section.skill === "reading" && section.passage && section.passage.text.trim().length < 400) {
      add("passage", section.id, `passage only ${section.passage.text.trim().length} chars`);
    }

    for (const question of section.questions ?? []) {
      questions++;
      const answer = Array.isArray(question.answer) ? question.answer.join(" / ") : String(question.answer ?? "");

      if (seenIds.has(question.id)) add("id", question.id, "duplicate question id");
      seenIds.add(question.id);

      const promptKey = normal(question.prompt).slice(0, 120);
      const entry = promptCounts.get(promptKey) ?? { count: 0, answers: [] };
      entry.count += 1;
      entry.answers.push(normal(question.answer));
      if (question.type === "multi") entry.multi = true;
      promptCounts.set(promptKey, entry);

      // prompt hygiene
      if (!question.prompt?.trim()) add("prompt", question.id, "empty prompt");
      if (question.prompt?.includes("@@")) add("prompt", question.id, "parser marker in prompt");
      if (/^questions?\s*\d/i.test(question.prompt ?? "")) {
        add("prompt", question.id, "prompt starts with a question header");
      }
      if (/show answers/i.test(question.prompt ?? "")) add("prompt", question.id, "answer-button text in prompt");
      if (/^questions?\s*\d+\s*_+/i.test(question.prompt ?? "")) {
        add("prompt", question.id, "placeholder prompt (no question text recovered)");
      } else if (
        question.type !== "writing" &&
        question.type !== "mcq" &&
        question.type !== "matching" &&
        (question.prompt ?? "").length < (question.type === "gap" || question.type === "short" ? 6 : 12)
      ) {
        add("prompt", question.id, `prompt too short (${question.prompt?.length ?? 0})`);
      }
      if (question.image && !existsSync(path.join(ROOT, "public", question.image))) {
        add("asset", question.id, `missing image ${question.image}`);
      }

      if (question.graded === false) continue;

      // answer shape per type
      if (question.type === "tfng") {
        const ids = new Set((question.options ?? []).map((o) => o.id));
        if (!ids.has(answer)) add("answer", question.id, `TF/NG answer "${answer}" not an option`);
      } else if (OPTION_TYPES.has(question.type)) {
        const ids = new Set((question.options ?? []).map((o) => o.id));
        if (!ids.has(answer)) add("answer", question.id, `"${answer}" not an option id`);
        // Compare loosely, but keep digits' punctuation: "1.5" ≠ "15".
        const texts = (question.options ?? []).map((o) =>
          String(o.text).toLowerCase().replace(/\s+/g, " ").trim()
        );
        if (new Set(texts).size !== texts.length) add("options", question.id, "duplicate option text");
      } else if (question.type === "gap" || question.type === "short") {
        if (!answer.trim()) add("answer", question.id, "empty answer");
        if (answer.length > 80) add("answer", question.id, `answer too long (${answer.length} chars)`);
        if (/[.…_·•]{3,}/.test(answer)) add("answer", question.id, "blank glyph inside answer");
        if (JUNK_ANSWER.test(answer)) add("answer", question.id, `instruction text as answer: "${answer.slice(0, 40)}"`);
        if ((question.options ?? []).length) add("answer", question.id, "gap question still carries options");
      } else if (question.type === "multi") {
        if (!Array.isArray(question.answer) || question.answer.length < 2) {
          add("answer", question.id, "multi answer is not a list");
        }
      } else if (!["writing", "speaking"].includes(question.type)) {
        add("type", question.id, `unexpected type ${question.type}`);
      }

      // a gap answer that is only a letter is fine, but a letter answer with a
      // word list means the option text went missing
      if (question.type === "gap" && /^[A-J]$/.test(answer) && /list of|box below|from the box/i.test(question.prompt)) {
        add("answer", question.id, "letter answer for a word-list task");
      }
    }
  }

  for (const [prompt, entry] of promptCounts) {
    if (entry.count < 4 || prompt.length <= 20) continue;
    const distinct = new Set(entry.answers);
    if (distinct.size <= 1 && !entry.multi) {
      add("prompt", null, `same prompt and answer repeated ${entry.count}×: "${prompt.slice(0, 60)}"`);
    }
  }

  return { findings, questions };
}

/* ------------------------------------------------------ key cross-check */

function checkKey(test, findings) {
  const location = cacheDirFor(test.id);
  if (!location) return { checked: 0, compared: 0 };
  const file = path.join(location.dir, location.file);
  if (!existsSync(file)) return { checked: 0, compared: 0, missing: true };

  const independent = keyFromHtml(readFileSync(file, "utf8"));
  if (!independent.size) return { checked: 0, compared: 0 };

  let compared = 0;
  for (const section of test.sections) {
    for (const question of section.questions ?? []) {
      if (question.graded === false) continue;
      const n = Number(String(question.id).match(/-q(\d+)$/)?.[1]);
      if (!n || !independent.has(n)) continue;
      compared++;
      const asSet = (value) => {
        const compact = normal(value).replace(/\b(and|or)\b/g, " ").replace(/[^a-z]/g, "");
        if (!/^[a-j]{2,}$/.test(compact)) return null;
        return [...new Set(compact.split(""))].sort().join("");
      };
      const mineSet = asSet(question.answer);
      const mine = mineSet ?? answerSynonym(question.answer);
      const theirs = mineSet ? (asSet(independent.get(n)) ?? answerSynonym(independent.get(n))) : answerSynonym(independent.get(n));
      if (mine === theirs) continue;
      // "B,D,E" against "B, D, E (any of these)" is still a match.
      if (mineSet) {
        const pageLetters = new Set((theirs.match(/[a-j]/g) ?? []));
        if (mineSet.split("").every((letter) => pageLetters.has(letter))) continue;
      }
      // Accept when one side is a prefix of the other ("maintenance" vs
      // "maintenance / servicing") — both come from the same line.
      if (mine.startsWith(theirs) || theirs.startsWith(mine)) continue;
      findings.push({
        kind: "key",
        questionId: question.id,
        detail: `json "${String(question.answer).slice(0, 40)}" vs page "${independent.get(n).slice(0, 40)}"`,
      });
    }
  }
  return { checked: independent.size, compared };
}

/* ------------------------------------------------------------------ main */

const files = readdirSync(TESTS).filter((f) => f.endsWith(".json"));
const report = [];
const counts = {};

for (const file of files) {
  const test = JSON.parse(readFileSync(path.join(TESTS, file), "utf8"));
  const { findings, questions } = auditTest(test, file);
  const key = checkKey(test, findings);

  for (const finding of findings) counts[finding.kind] = (counts[finding.kind] ?? 0) + 1;
  report.push({
    testId: test.id,
    file,
    questions,
    keyCompared: key.compared,
    findings,
  });
}

const totalQuestions = report.reduce((sum, r) => sum + r.questions, 0);
const totalFindings = report.reduce((sum, r) => sum + r.findings.length, 0);
const dirty = report.filter((r) => r.findings.length);

const byKind = {};
for (const entry of report) {
  for (const finding of entry.findings) {
    (byKind[finding.kind] ??= []).push({ testId: entry.testId, ...finding });
  }
}

console.log(`audited ${report.length} files, ${totalQuestions} questions — ${totalFindings} findings\n`);
for (const [kind, items] of Object.entries(byKind).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${String(items.length).padStart(5)}  ${kind}`);
  const sample = items.slice(0, args.verbose ? items.length : 3);
  for (const item of sample) console.log(`         ${item.testId} ${item.questionId ?? ""} — ${item.detail}`);
  if (!args.verbose && items.length > 3) console.log(`         … ${items.length - 3} more`);
}

const worst = [...dirty].sort((a, b) => b.findings.length - a.findings.length).slice(0, 10);
console.log("\nworst files:");
for (const entry of worst) console.log(`  ${entry.file}: ${entry.findings.length}`);
console.log(`\nfiles with no findings: ${report.length - dirty.length}/${report.length}`);

writeFileSync(
  path.join(ROOT, "scripts", ".cache", "audit.json"),
  JSON.stringify({ totalQuestions, totalFindings, byKind, report }, null, 2)
);
console.log("full report: scripts/.cache/audit.json");
