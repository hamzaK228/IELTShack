import ReadingQaList, { type ReadingQaRow } from "@/components/ReadingQaList";
import { listTests } from "@/lib/content";

export const dynamic = "force-dynamic";

export default function ReadingQaPage() {
  const rows: ReadingQaRow[] = listTests()
    .flatMap((test) => {
      // The diagnostic and hand-written sample are intentionally short.
      if (!test.id.startsWith("pte-")) return [];
      const sections = test.sections.filter((section) => section.skill === "reading");
      if (!sections.length) return [];
      const total = sections.reduce((sum, section) => sum + section.questions.length, 0);
      if (total >= 40) return [];
      return [{
        id: test.id,
        title: test.title,
        total,
        sections: sections.length,
        general: /general training/i.test(test.title),
      }];
    })
    .sort((a, b) => a.total - b.total);

  return <ReadingQaList rows={rows} />;
}
