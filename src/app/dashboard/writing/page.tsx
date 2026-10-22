import WritingWorkspace from "@/components/WritingWorkspace";
import { listWritingPrompts } from "@/lib/prompts";

export default function WritingPage() {
  return <WritingWorkspace prompts={listWritingPrompts()} />;
}
