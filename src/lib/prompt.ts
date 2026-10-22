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
