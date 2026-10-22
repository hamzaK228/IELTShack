import { notFound } from "next/navigation";
import SectionRunner from "@/components/SectionRunner";
import { getTest } from "@/lib/content";

export default function DiagnosticPage() {
  const test = getTest("diagnostic");
  if (!test) notFound();
  return <SectionRunner test={test} mode="exam" introTitle="Full diagnostic" />;
}
