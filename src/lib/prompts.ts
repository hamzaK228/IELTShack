import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

export type WritingPrompt = {
  id: string;
  taskNumber: 1 | 2;
  title: string;
  prompt: string;
  timeMinutes: number;
  minWords: number;
  checklist: string[];
  modelAnswer: string;
};

export type SpeakingPrompt = {
  id: string;
  part: number;
  title: string;
  cueCard: string;
  bullets: string[];
  prepSeconds: number;
  speakSeconds: number;
  followUps: string[];
};

const DIR = path.join(process.cwd(), "content", "prompts");

/** A prompt file holds either one prompt or an array of them (imported banks). */
function loadAll<T>(): T[] {
  if (!existsSync(DIR)) return [];
  return readdirSync(DIR)
    .filter((file) => file.endsWith(".json"))
    .flatMap((file) => {
      const parsed = JSON.parse(readFileSync(path.join(DIR, file), "utf8")) as T | T[];
      return Array.isArray(parsed) ? parsed : [parsed];
    });
}

export function listWritingPrompts(): WritingPrompt[] {
  return loadAll<WritingPrompt>()
    .filter((item) => "taskNumber" in item)
    .sort((a, b) => a.taskNumber - b.taskNumber);
}

export function listSpeakingPrompts(): SpeakingPrompt[] {
  return loadAll<SpeakingPrompt>()
    .filter((item) => "cueCard" in item)
    .sort((a, b) => a.id.localeCompare(b.id));
}
