import { roundBand } from "./bands";
import type { Attempt, Skill } from "./types";

export type Projection = {
  band: number;
  low: number;
  high: number;
  skills: Skill[];
  questions: number;
};

/**
 * A practice projection, not an official IELTS result: take the most recent
 * measured band for each skill, average the available skills, and show a
 * half-band range. Requires at least two skills so a single reading set cannot
 * masquerade as an overall band.
 */
export function projectedBand(attempts: Attempt[]): Projection | null {
  const latest = new Map<Skill, { band: number; at: number; total: number }>();

  for (const attempt of attempts) {
    const at = Date.parse(attempt.finishedAt) || 0;
    for (const skill of Object.keys(attempt.perSkill) as Skill[]) {
      const score = attempt.perSkill[skill];
      if (!score || !Number.isFinite(score.band)) continue;
      const current = latest.get(skill);
      if (!current || at >= current.at) {
        latest.set(skill, { band: score.band, at, total: score.total });
      }
    }
  }

  const entries = Array.from(latest.entries());
  if (entries.length < 2) return null;

  const band = roundBand(entries.reduce((sum, [, score]) => sum + score.band, 0) / entries.length);
  return {
    band,
    low: roundBand(band - 0.5),
    high: roundBand(band + 0.5),
    skills: entries.map(([skill]) => skill),
    questions: entries.reduce((sum, [, score]) => sum + score.total, 0),
  };
}
