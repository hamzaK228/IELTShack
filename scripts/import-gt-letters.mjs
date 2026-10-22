#!/usr/bin/env node
/**
 * Imports the General Training Task 1 letter prompts (one page, 29 letters) into
 * content/tests/pte-gt-writing-*.json. Each letter becomes its own practice test so
 * it can be attempted from the test list like the other writing tasks.
 *
 *   node scripts/import-gt-letters.mjs
 *   node scripts/import-gt-letters.mjs --refresh
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CACHE = path.join(ROOT, "scripts", ".cache", "gt-writing");
const OUT = path.join(ROOT, "content", "tests");
const URL = "https://practicepteonline.com/ielts-general-writing-tasks-1-letters/";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

const ENTITIES = { nbsp: " ", ndash: "–", mdash: "—", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…", amp: "&", apos: "'", quot: '"' };

function decode(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

function clean(text) {
  return decode(text).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[ \t]+/g, " ").trim();
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(45_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 700 * attempt * attempt));
    }
  }
  throw lastError;
}

/** Split the page into numbered letters, each with its prompt and bullet list. */
function lettersFrom(html) {
  const open = /<div[^>]*class="[^"]*\bentry-content\b[^"]*"[^>]*>/i.exec(html);
  const start = open ? open.end : 0;
  const articleEnd = html.indexOf("</article>", start);
  const body = html.slice(start, articleEnd === -1 ? undefined : articleEnd)
    .replace(/<script[\s\S]*?<\/script>/gi, " ");

  const lines = decode(body.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "\n"))
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  const letters = [];
  let current = null;
  for (const line of lines) {
    const numbered = /^(\d{1,3})\.\s*(.+)$/.exec(line);
    if (numbered) {
      current = { number: Number(numbered[1]), parts: [numbered[2]] };
      letters.push(current);
      continue;
    }
    if (!current) continue;
    // Stop at page furniture rather than swallowing the footer.
    if (/^(for|please|students|coaching|all the tests)/i.test(line) && current.parts.length > 3) continue;
    current.parts.push(line);
  }
  return letters.filter((letter) => letter.parts.join(" ").length > 40);
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  mkdirSync(OUT, { recursive: true });

  const cacheFile = path.join(CACHE, "letters.html");
  let html;
  if (existsSync(cacheFile) && !args.refresh) html = readFileSync(cacheFile, "utf8");
  else {
    html = await fetchText(URL);
    writeFileSync(cacheFile, html);
  }

  const letters = lettersFrom(html);
  if (letters.length < 10) {
    console.error(`Only ${letters.length} letters parsed — refusing to write.`);
    process.exit(1);
  }

  for (const letter of letters) {
    const [headline, ...rest] = letter.parts;
    const id = `pte-gt-writing-${letter.number}`;
    const test = {
      id,
      title: `General Training Writing — Letter ${letter.number}`,
      kind: "practice",
      description: `Task 1 letter, ${letter.number} of ${letters.length}. Write at least 150 words.`,
      durationMinutes: 20,
      sections: [
        {
          id: "task-1",
          skill: "writing",
          title: "Writing — Task 1 (letter)",
          instructions: "Write the letter in the box below. It is not auto-scored.",
          questions: [
            {
              id: `${id}-q1`,
              skill: "writing",
              type: "writing",
              graded: false,
              prompt: [clean(headline), ...rest.map(clean)].join("\n"),
              answer: "",
              difficulty: 2,
            },
          ],
        },
      ],
    };
    writeFileSync(path.join(OUT, `${id}.json`), `${JSON.stringify(test, null, 2)}\n`);
  }

  console.log(`wrote ${letters.length} letter tests to content/tests/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
