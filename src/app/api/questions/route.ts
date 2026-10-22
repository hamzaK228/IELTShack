import { NextResponse } from "next/server";
import { allQuestions } from "@/lib/content";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get("ids")?.split(",").filter(Boolean) ?? null;
  const testId = searchParams.get("testId");
  const skill = searchParams.get("skill");
  const type = searchParams.get("type");
  const q = searchParams.get("q")?.toLowerCase() ?? "";
  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0) || 0);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 25) || 25));

  let items = allQuestions();
  if (ids) {
    const wanted = new Set(ids);
    items = items.filter((entry) => wanted.has(entry.question.id));
  } else {
    if (testId) items = items.filter((entry) => entry.testId === testId);
    if (skill && skill !== "all") items = items.filter((entry) => entry.skill === skill);
    if (type && type !== "all") items = items.filter((entry) => entry.question.type === type);
    if (q) {
      items = items.filter(
        (entry) =>
          entry.question.prompt.toLowerCase().includes(q) ||
          entry.testTitle.toLowerCase().includes(q)
      );
    }
  }

  return NextResponse.json({
    total: items.length,
    items: items.slice(offset, offset + limit),
  });
}
