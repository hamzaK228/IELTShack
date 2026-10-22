import TestLibrary, { type TestSummary } from "@/components/TestLibrary";
import { listTests } from "@/lib/content";
import type { Skill } from "@/lib/types";

export const dynamic = "force-dynamic";

export default function TestLibraryPage() {
  const all = listTests();
  const usable = all.filter((test) => {
    const reading = test.sections.filter((section) => section.skill === "reading");
    const total = reading.reduce((sum, section) => sum + section.questions.length, 0);
    // Imported reading tests that lost question groups are quarantined until repaired.
    return !(test.id.startsWith("pte-") && reading.length > 0 && total < 40);
  });

  const tests: TestSummary[] = usable.map((test) => ({
    id: test.id,
    title: test.title,
    kind: test.kind,
    durationMinutes: test.durationMinutes,
    questions: test.sections.reduce((sum, section) => sum + section.questions.length, 0),
    skills: Array.from(new Set(test.sections.map((section) => section.skill))) as Skill[],
  }));

  return <TestLibrary tests={tests} hidden={all.length - usable.length} />;
}
