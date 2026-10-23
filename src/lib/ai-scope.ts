import { listTests } from "./content";
import { cleanPrompt } from "./prompt";
import { listSpeakingPrompts, listWritingPrompts } from "./prompts";

function normalize(text: string) {
  return cleanPrompt(text)
    .toLowerCase()
    .replace(/\(\d+\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

let allowed: Set<string> | null = null;

/**
 * The AI examiner is not a general-purpose assistant. Only prompts that exist
 * in this app's Writing/Speaking content are eligible for evaluation. This
 * prevents someone from using the key for unrelated generation.
 */
export function isAllowedIeltsPrompt(prompt: string) {
  if (!allowed) {
    const set = new Set<string>();
    for (const test of listTests()) {
      for (const section of test.sections) {
        if (section.skill !== "writing" && section.skill !== "speaking") continue;
        for (const question of section.questions) {
          const key = normalize(question.prompt);
          if (key) set.add(key);
        }
      }
    }
    for (const item of listWritingPrompts()) {
      const key = normalize(item.prompt);
      if (key) set.add(key);
    }
    for (const item of listSpeakingPrompts()) {
      const key = normalize(item.cueCard);
      if (key) set.add(key);
    }
    allowed = set;
  }

  const key = normalize(prompt);
  return key.length >= 12 && allowed.has(key);
}
