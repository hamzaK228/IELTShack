# Adding practice tests

Practice content lives in `content/tests/*.json`. One file is one test. No code changes
are needed: the app loads every JSON file in that folder.

Validate after every edit:

```bash
npm run validate:content
```

## Test shape

```json
{
  "id": "reading-set-2",
  "title": "Academic Reading — Set 2",
  "kind": "practice",
  "description": "One passage, 13 questions.",
  "durationMinutes": 20,
  "sections": [ ... ]
}
```

- `id` — unique, kebab-case. Used in URLs (`/dashboard/test/<id>`).
- `kind` — `diagnostic`, `practice`, or `mock`.
- `durationMinutes` — shown as a guide; the timer counts up.
- `sections` — ordered list; each section has one skill.

## Section shape

```json
{
  "id": "reading-2",
  "skill": "reading",
  "title": "Reading — Passage 1",
  "instructions": "Read the passage and answer questions 1–13.",
  "passage": { "id": "p1", "title": "The story of tea", "text": "Paragraph one…\n\nParagraph two…" },
  "audio": "/assets/audio/listening-test-1.mp3",
  "questions": [ ... ]
}
```

- `skill` — `listening` | `reading` | `writing` | `speaking`.
- `passage` — optional. When present, the question screen becomes a split view.
  Double newlines separate paragraphs.
- `audio` — optional. Put files in `public/assets/audio/` and reference them from `/assets/audio/…`.
  The player is rendered above the questions. (Recordings are added in the content phase.)
- `layout` — optional inline format for form/note/table completion. `template` is plain
  text with `{{question-id}}` tokens; each token renders as an inline answer field:

```json
"layout": {
  "title": "Survey about shopping",
  "template": "Name: Martyn {{lf-q1}}\nUsed his {{lf-q2}}"
}
```

  Every token must match a question id in the same section. This is how listening form
  completion is rendered, instead of one block per question.

## Question types

Every question needs `id`, `skill` (matching the section), `type`, and `prompt`.
Graded questions also need `answer`. `explanation` is optional but recommended.
`difficulty` is `1 | 2 | 3`. Add `"graded": false` for prompts that cannot be machine-marked.

### Multiple choice

```json
{
  "id": "r2-q1", "skill": "reading", "type": "mcq",
  "prompt": "What is the main cause?",
  "options": [
    { "id": "A", "text": "Rising temperatures" },
    { "id": "B", "text": "Building materials" }
  ],
  "answer": "B",
  "explanation": "The first paragraph names building materials.",
  "difficulty": 1
}
```

### True / False / Not Given (also Yes / No / Not Given)

```json
{
  "id": "r2-q2", "skill": "reading", "type": "tfng",
  "prompt": "Green roofs lower surface temperatures.",
  "options": [
    { "id": "True", "text": "True" },
    { "id": "False", "text": "False" },
    { "id": "Not Given", "text": "Not Given" }
  ],
  "answer": "True"
}
```

### Gap fill / short answer

```json
{ "id": "r2-q3", "skill": "reading", "type": "gap", "prompt": "Plants cool the air through ______.", "answer": "evaporation" }
{ "id": "l1-q1", "skill": "listening", "type": "short", "prompt": "Which city is mentioned?", "answer": "Manchester" }
```

Matching is case-insensitive and ignores punctuation and extra spaces. Keep answers to a
single expected word or phrase; put accepted alternatives in the explanation for now.

### Matching

```json
{
  "id": "r2-q4", "skill": "reading", "type": "matching",
  "prompt": "Which heading best fits paragraph C?",
  "options": [
    { "id": "A", "text": "A drink for the wealthy" },
    { "id": "B", "text": "Trade and smuggling" },
    { "id": "C", "text": "Taxes and popularity" }
  ],
  "answer": "C"
}
```

### Multi-select

```json
{ "id": "r2-q5", "skill": "reading", "type": "multi", "prompt": "Which TWO are mentioned?", "options": [...], "answer": ["A", "C"] }
```

### Writing and Speaking (not auto-scored)

```json
{
  "id": "w1-q1", "skill": "writing", "type": "writing", "graded": false,
  "prompt": "The chart shows… Summarise the information (150 words).",
  "answer": "",
  "explanation": "Use a clear overview and two body paragraphs."
}
```

```json
{
  "id": "s1-q1", "skill": "speaking", "type": "speaking", "graded": false,
  "prompt": "Describe a skill you learned. You should say: what, how, how long, why it was difficult.",
  "answer": ""
}
```

These render a notes box, are saved with the attempt, and are excluded from the band.

## How scoring works

- Auto-scored questions are counted per skill.
- Sections with 38+ questions use official-style raw-score tables (Academic Reading, Listening).
- Shorter sets use a proportional estimate, capped at Band 8.5 for sets under 10 questions.
- The overall band is the average of the measured skills, rounded to the nearest half band.
- Writing and Speaking are excluded until human/AI marking lands in Phase 6.

## Checklist for a new test

1. Unique `id`s for the test, every section, and every question.
2. Section `skill` matches every question's `skill`.
3. Every graded question has an `answer`; every option-based answer is an option `id`.
4. Run `npm run validate:content` — it must pass.
5. Restart is not needed in dev; production builds read the files at build time.

## Imported practice library

`content/tests/pte-reading-*.json` (Academic), `content/tests/pte-gt-reading-*.json`
(General Training), `content/tests/pte-listening-*.json` and
`content/tests/pte-writing-*.json` are generated by `scripts/import-reading-tests.mjs`,
which reads the 319 academic, 125 GT, 208 listening and 132 academic writing tests listed
on practicepteonline.com.

```bash
node scripts/import-reading-tests.mjs                  # academic, fetch + parse
node scripts/import-reading-tests.mjs --track=general   # General Training
node scripts/import-reading-tests.mjs --track=listening # Listening
node scripts/import-reading-tests.mjs --track=writing   # Academic Writing
node scripts/import-reading-tests.mjs --parse-only      # re-parse from the HTML cache
node scripts/import-reading-tests.mjs --from=1 --to=10 --debug
```

The tracks are structurally different. Academic pages contain three titled passages. GT
pages carry 4–7 texts introduced by lead-ins ("Now, read the information below…") and
"Section 1/2/3" markers, and an option box can sit after the questions rather than before
them. The importer emits one section per text for both.

Listening pages have no transcripts: each test is one MP3 covering all four parts, so the
whole test becomes a single section whose `audio` field holds the recording and whose
questions run 1–40. The `audio` URL is absolute because the files stay on the source
server (about 19 MB each, 4 GB for the set); the session screen renders one player per
section above the question card. Section `audio` accepts either an absolute URL or a
root-relative path under `public/assets/audio/`, so a test can be pinned offline later by
downloading its MP3 and rewriting the field.

Writing pages hold one chart image plus two prompts, so a test is a single section with an
ungraded Task 1 and Task 2 question (`"graded": false`, `"answer": ""`). The chart is
downloaded to `public/assets/writing/` and referenced from the question's `image` field,
which the session screen renders above the prompt. Where a page used an HTML table instead
of an image, the table is serialised into the Task 1 prompt as text rows (the prompt keeps
its line breaks).

Raw pages are cached in `scripts/.cache/{reading,gt-reading,listening,writing}/`
(git-ignored), so re-parsing is free and repeatable after a parser change. Always finish
with `npm run validate:content`.

## General Training letters

`content/tests/pte-gt-writing-<N>.json` (29 tests) is generated by
`scripts/import-gt-letters.mjs` from the General Writing Task 1 letters page — one page
holding every letter, so each letter becomes its own ungraded writing test with the prompt
and its bullet list intact.

## Auditing the imported content

```bash
npm run audit:content            # summary + worst files
npm run audit:content -- --verbose
```

One source quirk worth knowing: the answer button is misspelled "Show Anwers" on some
pages (test 271, for instance), so the importer matches `show an*wers` rather than the
literal spelling.

The audit runs three independent passes over every test: answer shape per question
type, prompt hygiene (parser artefacts, duplicated stems, blank-only prompts), and a
**key cross-check** — the answer key is re-read from the cached source page by a separate,
simpler parser and compared question by question, with True/False synonyms and letter sets
normalised. A clean run means every graded answer agrees with the page it came from.

Findings are written to `scripts/.cache/audit.json`. Two classes are expected and harmless:
thin passages and `letter answer for a word-list task`, both coming from source tables or
maps that only exist as images.

## Speaking cue cards

`content/prompts/speaking-cue-cards.json` is generated by
`scripts/import-speaking-cards.mjs` from the Makkar Part 2 cue-card list (179 cards). The
file holds an array of `SpeakingPrompt` objects — `loadAll` in `src/lib/prompts.ts` accepts
either one prompt per file or an array, so an imported bank stays a single reviewable file.

```bash
node scripts/import-speaking-cards.mjs            # parse the cached page
node scripts/import-speaking-cards.mjs --refresh  # re-fetch first
```

The source lists topics only, with no "you should say" bullets, so each card gets the
standard four-bullet scaffold for its kind of topic (person, place, object, activity), read
off the head noun phrase — "a good law in your country" is an activity, not a place. Every
card uses the 60-second prep / 2-minute speak timers. Above twelve prompts the speaking page
switches from a chip row to a select.

What the importer cannot carry over, because the source page renders it as an image:

- table / diagram / flow-chart completion questions,
- picture-matching tasks and some "label the map" tasks.

Those questions are dropped and listed in `scripts/.cache/<track>/report.json`. Tests
without a published answer key are rejected outright, so every shipped test is fully
markable.
