import Link from "next/link";
import { notFound } from "next/navigation";
import SectionRunner from "@/components/SectionRunner";
import { allQuestions, listTests } from "@/lib/content";
import { qualityIssue } from "@/lib/test-quality";
import { QUESTION_TYPE_LABEL } from "@/lib/insights";
import type { QuestionType, Skill, Test } from "@/lib/types";

export const dynamic = "force-dynamic";

const SKILLS: Skill[] = ["listening", "reading", "writing", "speaking"];
const TYPES: QuestionType[] = ["mcq", "multi", "gap", "tfng", "matching", "short", "writing", "speaking"];

function isSkill(value: string | undefined): value is Skill {
  return Boolean(value && SKILLS.includes(value as Skill));
}

function isType(value: string | undefined): value is QuestionType {
  return Boolean(value && TYPES.includes(value as QuestionType));
}

export default async function DrillPage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string; type?: string }>;
}) {
  const { skill, type } = await searchParams;
  if (!isSkill(skill) || !isType(type)) notFound();

  const blocked = new Set(
    listTests().filter((test) => qualityIssue(test)).map((test) => test.id)
  );
  const entries = allQuestions()
    .filter(
      (entry) =>
        entry.skill === skill &&
        entry.question.type === type &&
        !blocked.has(entry.testId)
    )
    .slice(0, 12);

  if (!entries.length) {
    return (
      <div className="dash-page">
        <div className="dash-card dash-empty">
          <p>No questions of this type are available yet.</p>
          <Link className="btn btn-ghost" href="/dashboard">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const label = QUESTION_TYPE_LABEL[type];
  const test: Test = {
    id: `drill-${skill}-${type}`,
    title: `${label} drill`,
    kind: "practice",
    description: `Targeted ${label.toLowerCase()} practice from your weakest question type.`,
    durationMinutes: 15,
    sections: [
      {
        id: `drill-${type}`,
        skill,
        title: `${label} — targeted drill`,
        instructions: `Answer these ${entries.length} ${label.toLowerCase()} questions. Check the answers when you submit.`,
        questions: entries.map((entry) => ({ ...entry.question, skill })),
      },
    ],
  };

  return <SectionRunner test={test} mode="practice" introTitle={`${label} drill`} />;
}
