import Link from "next/link";
import MockExam from "@/components/MockExam";
import { listTests } from "@/lib/content";
import { listSpeakingPrompts } from "@/lib/prompts";

export const dynamic = "force-dynamic";

export default function MockPage() {
  const tests = listTests();
  const reading =
    tests.find((test) => test.id === "pte-reading-79") ??
    tests.find((test) => test.id.startsWith("pte-reading-") && test.sections.some((s) => s.skill === "reading"));
  const listening =
    tests.find((test) => test.id === "pte-listening-39") ??
    tests.find((test) => test.id.startsWith("pte-listening-"));
  const writing =
    tests.find((test) => test.id === "pte-writing-1") ??
    tests.find((test) => test.id.startsWith("pte-writing-"));

  const speaking = listSpeakingPrompts()[0];

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
