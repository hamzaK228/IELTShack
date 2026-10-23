import type { Test } from "./types";

/**
 * Tests whose published answer key disagrees with the source page in the
 * project's own content audit. Keep this list short and remove entries once the
 * content is repaired; the library hides them instead of presenting broken
 * scored practice.
 */
const KNOWN_KEY_MISMATCHES = new Set([
  "pte-listening-180",
  "pte-listening-204",
  "pte-listening-206",
  "pte-listening-3",
  "pte-reading-274",
  "pte-reading-298",
]);

export function qualityIssue(test: Test): string | null {
  if (KNOWN_KEY_MISMATCHES.has(test.id)) return "answer key mismatch";
  for (const section of test.sections) {
    for (const question of section.questions) {
      const prompt = question.prompt?.trim() ?? "";
      if (!prompt || /^_{3,}$/.test(prompt)) return "missing prompt";
    }
  }
  return null;
}
