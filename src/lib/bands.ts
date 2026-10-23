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

function capForTotal(total: number) {
  if (total < 10) return 8;
  if (total < 20) return 8.5;
  return 9;
}

export function bandForSkill(skill: Skill, correct: number, total: number): number {
  if (total <= 0) return 0;
  const safeCorrect = Math.min(total, Math.max(0, correct));

  if (skill === "reading" || skill === "listening") {
    // Scale short practice sets onto the 40-question table. This keeps the
    // estimate monotonic across set sizes (9/9 and 10/10 no longer disagree)
    // and removes the old floor of Band 4 for a blank answer sheet.
    const scaled = Math.round((safeCorrect / total) * 40);
    const table = skill === "reading" ? READING_40 : LISTENING_40;
    let band = 0;
    for (const [raw, value] of table) {
      if (scaled >= raw) {
        band = value;
        break;
      }
    }
    if (!band) band = scaled > 0 ? 1 : 0;
    return Math.min(capForTotal(total), band);
  }

  return Math.min(capForTotal(total), roundBand((safeCorrect / total) * 9));
}

export function bandFromPercent(percent: number): number {
  return roundBand((percent / 100) * 9);
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
