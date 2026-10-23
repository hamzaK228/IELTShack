/** Clean extraction artifacts in imported prompts for display. */
export function cleanPrompt(prompt: string) {
  return prompt
    .replace(/^(?:[\s•\-–]+|o\s+)+/i, "")
    .split(/Example:/i)[0]
    .replace(/;?\s*Answer:.*$/i, "")
    .replace(/\(\d+\)\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function hasInlineBlank(prompt: string) {
  return /_{3,}/.test(prompt);
}

export function splitInlineBlank(prompt: string) {
  return prompt.split(/_{3,}/);
}

/**
 * Clean a gap-fill prompt without deleting the (12) markers that identify the
 * other blanks in a summary-completion task. `cleanPrompt()` intentionally
 * strips parenthetical numbers, which is right for display but destroys the
 * only mapping between a question and its blank.
 */
export function cleanInlinePrompt(prompt: string) {
  return prompt
    .replace(/^(?:[\s•\-–]+|o\s+)+/i, "")
    .replace(/;?\s*Answer:.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export type InlineSegment =
  | { kind: "text"; text: string }
  | { kind: "blank"; number: string | null; target: boolean };

/**
 * Imported summary-completion questions repeat the whole summary and omit the
 * number in front of the blank this question owns. Everything else is
 * "(12) ______". Parse that structure so SectionRunner can render one input at
 * the right blank instead of one input at the first blank.
 */
export function inlineSegments(prompt: string): InlineSegment[] {
  const cleaned = cleanInlinePrompt(prompt);
  const segments: InlineSegment[] = [];
  const blankPattern = /(\(\s*\d+\s*\)\s*)?_{3,}/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = blankPattern.exec(cleaned))) {
    if (match.index > cursor) {
      segments.push({ kind: "text", text: cleaned.slice(cursor, match.index) });
    }
    const number = match[1] ? match[1].replace(/[()\s]/g, "") : null;
    segments.push({ kind: "blank", number, target: false });
    cursor = match.index + match[0].length;
  }

  if (cursor < cleaned.length) {
    segments.push({ kind: "text", text: cleaned.slice(cursor) });
  }

  const blanks = segments.filter(
    (segment): segment is Extract<InlineSegment, { kind: "blank" }> => segment.kind === "blank"
  );
  const target = blanks.find((blank) => !blank.number) ?? blanks[0];
  if (target) target.target = true;

  return segments;
}

type Option = { id: string; text: string };

export type QuestionGroup =
  | { kind: "single"; question: import("./types").Question }
  | {
      kind: "options";
      options: Option[];
      questions: Array<import("./types").Question>;
    };

/**
 * Group consecutive questions that share the same option bank (e.g. matching
 * headings) so the options render once instead of repeated under every question.
 */
export function groupQuestions(questions: import("./types").Question[]): QuestionGroup[] {
  const groups: QuestionGroup[] = [];
  let i = 0;
  while (i < questions.length) {
    const q = questions[i];
    const options = q.options ?? [];
    const shared =
      q.type !== "multi" &&
      q.type !== "gap" &&
      q.type !== "short" &&
      options.length >= 4 &&
      !options.every((o) => /^(true|false|yes|no|not given)$/i.test(o.text.trim()));
    if (!shared) {
      groups.push({ kind: "single", question: q });
      i += 1;
      continue;
    }
    const signature = options.map((o) => `${o.id}:${o.text}`).join("|");
    const run = [q];
    let j = i + 1;
    while (j < questions.length) {
      const next = questions[j];
      if (next.type !== q.type) break;
      const nextSig = (next.options ?? []).map((o) => `${o.id}:${o.text}`).join("|");
      if (nextSig !== signature) break;
      run.push(next);
      j += 1;
    }
    if (run.length >= 2) {
      groups.push({ kind: "options", options, questions: run });
      i = j;
    } else {
      groups.push({ kind: "single", question: q });
      i += 1;
    }
  }
  return groups;
}
