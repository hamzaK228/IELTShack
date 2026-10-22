import type { Skill } from "./types";

/** Round an average band to the nearest half band (IELTS convention). */
export function roundBand(value: number): number {
  const clamped = Math.min(9, Math.max(0, value));
  return Math.round(clamped * 2) / 2;
}

export function overallBand(bands: number[]): number {
  const usable = bands.filter((b) => Number.isFinite(b));
  if (!usable.length) return 0;
  return roundBand(usable.reduce((sum, b) => sum + b, 0) / usable.length);
}

/**
 * Official-style raw score → band tables for a 40-question section.
 * For shorter practice sets we fall back to a proportional estimate.
 */
const READING_40: Array<[number, number]> = [
  [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6],
  [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5],
];

const LISTENING_40: Array<[number, number]> = [
  [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6],
  [18, 5.5], [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5],
];

function fromTable(correct: number, table: Array<[number, number]>): number {
  for (const [raw, band] of table) {
    if (correct >= raw) return band;
  }
  return 1;
}

export function bandForSkill(skill: Skill, correct: number, total: number): number {
  if (total <= 0) return 0;
  if (total >= 38) {
    if (skill === "reading") return fromTable(correct, READING_40);
    if (skill === "listening") return fromTable(correct, LISTENING_40);
  }
  const ratio = correct / total;
  // Short practice sets cannot honestly produce a band 9 estimate: cap the
  // top of the scale until the section is long enough to behave like a real test.
  if (total < 10) return roundBand(4 + ratio * 4.5);
  return roundBand(ratio * 9);
}

export function bandFromPercent(percent: number): number {
  return roundBand((percent / 100) * 9);
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
