import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import type { Question, Section, Test } from "./types";

const CONTENT_DIR = path.join(process.cwd(), "content", "tests");

let cache: Test[] | null = null;

/** Clean obvious import artifacts without touching the source files. */
function normalizeTest(test: Test): Test {
  return {
    ...test,
    sections: test.sections.map((section) => ({
      ...section,
      title:
        section.skill === "writing" && /^reading/i.test(section.title.trim())
          ? section.title.replace(/^reading/i, "Writing").replace(/: Tasks$/, "")
          : section.title,
      instructions:
        section.skill === "writing" && /read the passage|answer the questions/i.test(section.instructions ?? "")
          ? "Write your answer for the task below. Spend about 20 minutes on Task 1 and 40 minutes on Task 2."
          : section.instructions,
      questions: section.questions,
    })),
  };
}

export function listTests(): Test[] {
  if (cache) return cache;
  if (!existsSync(CONTENT_DIR)) return [];
  const tests = readdirSync(CONTENT_DIR)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const raw = readFileSync(path.join(CONTENT_DIR, file), "utf8");
      return normalizeTest(JSON.parse(raw) as Test);
    })
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
  cache = tests;
  return tests;
}

export function getTest(id: string): Test | null {
  return listTests().find((test) => test.id === id) ?? null;
}

export type QuestionEntry = {
  testId: string;
  testTitle: string;
  sectionId: string;
  sectionTitle: string;
  skill: Section["skill"];
  question: Question;
};

export function allQuestions(): QuestionEntry[] {
  return listTests().flatMap((test) =>
    test.sections.flatMap((section) =>
      section.questions.map((question) => ({
        testId: test.id,
        testTitle: test.title,
        sectionId: section.id,
        sectionTitle: section.title,
        skill: section.skill,
        question,
      }))
    )
  );
}

export function scoredQuestions(test: Test): Question[] {
  return test.sections.flatMap((section) =>
    section.questions.filter((q) => q.graded !== false)
  );
}
