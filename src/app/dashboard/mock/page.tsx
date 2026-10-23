import Link from "next/link";
import MockExam from "@/components/MockExam";
import { listTests } from "@/lib/content";
import { listSpeakingPrompts } from "@/lib/prompts";
import { qualityIssue } from "@/lib/test-quality";

export const dynamic = "force-dynamic";

function questionCount(test: ReturnType<typeof listTests>[number]) {
  return test.sections.reduce((sum, section) => sum + section.questions.length, 0);
}

function pick<T>(pool: T[], offset: number) {
  if (!pool.length) return undefined;
  const week = Math.floor(Date.now() / (7 * 86_400_000));
  return pool[(week + offset) % pool.length];
}

export default function MockPage() {
  const tests = listTests();

  const readingPool = tests.filter(
    (test) =>
      test.id.startsWith("pte-reading-") &&
      questionCount(test) === 40 &&
      !qualityIssue(test)
  );
  const listeningPool = tests.filter(
    (test) =>
      test.id.startsWith("pte-listening-") &&
      questionCount(test) === 40 &&
      !qualityIssue(test)
  );
  const writingPool = tests.filter(
    (test) =>
      test.id.startsWith("pte-writing-") &&
      test.sections.some((section) => section.skill === "writing") &&
      !qualityIssue(test)
  );
  const speakingPool = listSpeakingPrompts();

  const reading = pick(readingPool, 0);
  const listening = pick(listeningPool, 3);
  const writing = pick(writingPool, 5);
  const speaking = pick(speakingPool, 7);

  if (!reading || !listening || !writing || !speaking) {
    return (
      <div className="dash-page">
        <div className="dash-card dash-empty">
          <p>Mock content is not available yet. Import a reading, listening, writing and speaking set first.</p>
          <Link className="btn btn-ghost" href="/dashboard">Dashboard</Link>
        </div>
      </div>
    );
  }

  return <MockExam reading={reading} listening={listening} writing={writing} speaking={speaking} />;
}
