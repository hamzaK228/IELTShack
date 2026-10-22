import type { AnswerValue, Question } from "./types";

export function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[.,;:!?"'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build acceptable spellings from an imported key such as
 * "crowd (noise)", "bank/banks", "(the) bank", "10 OR ten".
 */
export function acceptableAnswers(expected: string): string[] {
  const variants = new Set<string>();
  const add = (value: string) => {
    const cleaned = normalize(value);
    if (cleaned) variants.add(cleaned);
  };
  for (const alternative of expected.split(/\s+or\s+|\s*\/\s*|;/i)) {
    add(alternative);
    const withoutBrackets = alternative.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    add(withoutBrackets);
    add(alternative.replace(/[()]/g, " ").replace(/\s+/g, " ").trim());
    add(alternative.replace(/^(a|an|the)\s+/i, ""));
    add(withoutBrackets.replace(/^(a|an|the)\s+/i, ""));
  }
  return Array.from(variants);
}

export function isCorrect(question: Question, given: AnswerValue | undefined): boolean {
  if (given === undefined) return false;
  const expected = question.answer;
  if (Array.isArray(expected)) {
    const g = Array.isArray(given) ? given : [given];
    return (
      g.length === expected.length &&
      expected.every((e) => g.some((x) => normalize(String(x)) === normalize(String(e))))
    );
  }
  if (Array.isArray(given)) return false;
  const value = normalize(String(given));
  const options = acceptableAnswers(String(expected));
  if (options.includes(value)) return true;
  const withoutArticle = value.replace(/^(a|an|the)\s+/i, "");
  return options.includes(withoutArticle);
}

export function isAnswered(question: Question, given: AnswerValue | undefined) {
  if (given === undefined) return false;
  if (Array.isArray(given)) return given.length > 0;
  return String(given).trim().length > 0;
}
