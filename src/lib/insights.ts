import type { Attempt, QuestionType, Skill } from "./types";

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  mcq: "Multiple choice",
  multi: "Multiple answers",
  gap: "Form / note completion",
  tfng: "True / False / Not Given",
  matching: "Matching",
  short: "Short answer",
  writing: "Writing",
  speaking: "Speaking",
};

export type ErrorTypeRow = {
  skill: Skill;
  type: QuestionType;
  correct: number;
  total: number;
  accuracy: number;
};

/**
 * Aggregate question-type accuracy from every stored attempt. Older attempts
 * predate `byType`; they are skipped rather than guessed at.
 */
export function errorTypeProfile(attempts: Attempt[]): ErrorTypeRow[] {
  const buckets = new Map<string, { skill: Skill; type: QuestionType; correct: number; total: number }>();

  for (const attempt of attempts) {
    for (const skill of Object.keys(attempt.perSkill) as Skill[]) {
      const byType = attempt.perSkill[skill]?.byType;
      if (!byType) continue;
      for (const type of Object.keys(byType) as QuestionType[]) {
        const entry = byType[type];
        if (!entry?.total) continue;
        const key = `${skill}:${type}`;
        const bucket = buckets.get(key) ?? { skill, type, correct: 0, total: 0 };
        bucket.correct += entry.correct;
        bucket.total += entry.total;
        buckets.set(key, bucket);
      }
    }
  }

  return Array.from(buckets.values())
    .map((bucket) => ({
      ...bucket,
      accuracy: bucket.total ? Math.round((bucket.correct / bucket.total) * 100) : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
}

export function topErrorTypes(attempts: Attempt[], limit = 3): ErrorTypeRow[] {
  return errorTypeProfile(attempts)
    .filter((row) => row.total >= 2)
    .slice(0, limit);
}
