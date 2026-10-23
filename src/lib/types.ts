export type Skill = "listening" | "reading" | "writing" | "speaking";

export type QuestionType =
  | "mcq"
  | "multi"
  | "gap"
  | "tfng"
  | "matching"
  | "short"
  | "writing"
  | "speaking";

export type QuestionOption = { id: string; text: string };

export type Question = {
  id: string;
  skill: Skill;
  type: QuestionType;
  prompt: string;
  /** MCQ / matching options. */
  options?: QuestionOption[];
  /** String for single answers, string[] for multi-select. */
  answer: string | string[];
  explanation?: string;
  difficulty?: 1 | 2 | 3;
  marks?: number;
  /** Optional reference to a passage declared on the section. */
  passageId?: string;
  /** Optional chart/diagram shown above the prompt (writing Task 1, diagram tasks). */
  image?: string;
  /** Writing/speaking prompts are not auto-scored. */
  graded?: boolean;
};

export type Section = {
  id: string;
  skill: Skill;
  title: string;
  instructions?: string;
  /** Reading passage / listening transcript (plain text, newlines allowed). */
  passage?: { id: string; title?: string; text: string };
  /** Listening audio file under /assets/audio, reserved for real content. */
  audio?: string;
  /**
   * Optional inline layout for form/note/table completion. Use `{{questionId}}`
   * tokens in the template; each token renders an inline answer field.
   */
  layout?: { title?: string; template: string };
  questions: Question[];
};

export type TestKind = "diagnostic" | "practice" | "mock";

export type Test = {
  id: string;
  title: string;
  kind: TestKind;
  description?: string;
  durationMinutes: number;
  sections: Section[];
};

export type AnswerValue = string | string[];

export type Answers = Record<string, AnswerValue>;

export type SkillScore = {
  correct: number;
  total: number;
  band: number;
  /** Per-question-type accuracy, used for the weakness profile. */
  byType?: Record<string, { correct: number; total: number }>;
};

export type Attempt = {
  id: string;
  testId: string;
  testTitle: string;
  mode: "exam" | "practice";
  startedAt: string;
  finishedAt: string;
  durationSeconds: number;
  answers: Answers;
  perSkill: Partial<Record<Skill, SkillScore>>;
  overallBand: number;
  correct: number;
  total: number;
  missed: string[];
};

export type Profile = {
  name: string;
  email: string;
  targetBand: number;
  currentBand: number | null;
  testDate: string | null;
  hoursPerWeek: number;
  createdAt: string;
};

export const SKILLS: Skill[] = ["listening", "reading", "writing", "speaking"];

export const SKILL_LABEL: Record<Skill, string> = {
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};
