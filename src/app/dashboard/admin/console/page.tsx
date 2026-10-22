import AdminConsole from "@/components/AdminConsole";
import { allQuestions, listTests } from "@/lib/content";

export const dynamic = "force-dynamic";

export default function AdminConsolePage() {
  const tests = listTests().map((test) => ({
    id: test.id,
    title: test.title,
    kind: test.kind,
    questions: test.sections.reduce((sum, section) => sum + section.questions.length, 0),
  }));
  return <AdminConsole tests={tests} questionCount={allQuestions().length} />;
}
