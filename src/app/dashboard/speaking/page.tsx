import SpeakingPractice from "@/components/SpeakingPractice";
import { listSpeakingPrompts } from "@/lib/prompts";

export default function SpeakingPage() {
  return <SpeakingPractice prompts={listSpeakingPrompts()} />;
}
