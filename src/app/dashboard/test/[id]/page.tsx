import { notFound } from "next/navigation";
import SectionRunner from "@/components/SectionRunner";
import { getTest } from "@/lib/content";

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const test = getTest(id);
  if (!test) notFound();
  return <SectionRunner test={test} mode={test.kind === "practice" ? "practice" : "exam"} />;
}
