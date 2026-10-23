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
 *
 * The full key is always accepted first. Splitting is intentionally
 * conservative: "10 or more" is a threshold, not a list of alternatives.
 */
export function acceptableAnswers(expected: string): string[] {
  const variants = new Set<string>();
  const add = (value: string) => {
    const cleaned = normalize(value);
    if (cleaned) variants.add(cleaned);
  };

  add(expected);

  // "and/or" needs both expansions; a plain split would produce fragments.
  add(expected.replace(/\band\/or\b/gi, "and"));
  add(expected.replace(/\band\/or\b/gi, "or"));

  // Do not split a numeric threshold ("10 or more", "3 or fewer").
  const protectedExpected = expected.replace(
    /\b(\d+)\s+or\s+(more|less|fewer|above|below|over|under)\b/gi,
    "$1-$2"
  );

  for (const alternative of protectedExpected.split(/\s*;\s*|\s*\/\s*|\s+or\s+/i)) {
    add(alternative);
    const withoutBrackets = alternative.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    add(withoutBrackets);
    add(alternative.replace(/[()]/g, " ").replace(/\s+/g, " ").trim());
    add(alternative.replace(/^(a|an|the)\s+/i, ""));
    add(withoutBrackets.replace(/^(a|an|the)\s+/i, ""));
    add(alternative.replace(/-/g, " "));
    add(alternative.replace(/\s+/g, "-"));
    add(alternative.replace(/[()]/g, "").replace(/-/g, ""));
    add(withoutBrackets.replace(/[()]/g, "").replace(/-/g, ""));
  }

  return Array.from(variants);
}

function optionAnswer(question: Question, expected: string) {
  const option = question.options?.find((item) => item.id === expected);
  return option?.text;
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

  // Word-list completion stores the option id as the key; accept the text too.
  const optionText = optionAnswer(question, String(expected));
  if (optionText) options.push(...acceptableAnswers(optionText));

  if (options.includes(value)) return true;
  const withoutArticle = value.replace(/^(a|an|the)\s+/i, "");
  return options.includes(withoutArticle);
}

function editDistance(a: string, b: string) {
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

export type AnswerDiagnosis = "correct" | "spelling" | "format" | "wrong" | "blank";

/**
 * Distinguish a wrong answer from a right answer with a spelling, plural,
 * hyphen or number-format problem. IELTS still marks both wrong; the label is
 * feedback, not extra credit.
 */
export function diagnoseAnswer(question: Question, given: AnswerValue | undefined): AnswerDiagnosis {
  if (!isAnswered(question, given)) return "blank";
  if (isCorrect(question, given)) return "correct";
  if (
    Array.isArray(question.answer) ||
    Array.isArray(given) ||
    (question.type !== "gap" && question.type !== "short")
  ) {
    return "wrong";
  }

  const value = normalize(String(given));
  if (!value) return "blank";
  if (question.options?.some((option) => normalize(option.id) === value)) return "wrong";
  const expected = String(question.answer);
  const options = acceptableAnswers(expected);
  const optionText = optionAnswer(question, expected);
  if (optionText) options.push(...acceptableAnswers(optionText));

  const compact = (text: string) => text.replace(/[\s-]/g, "");
  for (const option of options) {
    if (compact(option) === compact(value)) return "format";
    if ((option.endsWith("s") ? option.slice(0, -1) : `${option}s`) === value) return "format";
    if (option.replace(/\s+/g, "") === value.replace(/\s+/g, "")) return "format";
    const allowance = Math.max(option.length, value.length) >= 8 ? 2 : 1;
    if (editDistance(option, value) <= allowance) return "spelling";
  }
  return "wrong";
}

export function isAnswered(question: Question, given: AnswerValue | undefined) {
  if (given === undefined) return false;
  if (Array.isArray(given)) return given.length > 0;
  return String(given).trim().length > 0;
}
