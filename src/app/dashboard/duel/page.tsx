import DuelArena from "@/components/DuelArena";
import { allQuestions } from "@/lib/content";

export default function DuelPage() {
  return <DuelArena entries={allQuestions()} />;
}
