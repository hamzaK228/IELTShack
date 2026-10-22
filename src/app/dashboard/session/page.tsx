import SectionRunner from "@/components/SectionRunner";
import { getTest, listTests } from "@/lib/content";

export default function SessionPage() {
  const test =
    getTest("reading-set-1") ??
    listTests().find((t) => t.kind === "practice") ??
    listTests()[0];

  if (!test) {
    return (
      <div className="dash-page">
        <div className="dash-card dash-empty">
          No practice content yet. Add a test JSON to <code>content/tests</code>.
        </div>
      </div>
    );
  }

  return <SectionRunner test={test} mode="practice" introTitle="Practice session" />;
}
