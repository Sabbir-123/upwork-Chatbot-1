import { MENU_OPTIONS } from "@upwork-chatbot/shared";

// Warm, brief acknowledgement for social / meta chit-chat ("thanks", "how are you",
// "bye"). Deliberately not an error and not a hard menu dump — it keeps the tone human
// and gently reminds the customer what the bot is here for. In LLM mode this is only the
// fallback template; generate.ts renders something tailored to what they actually said.
export function smalltalkReply(): string {
  const options = MENU_OPTIONS.map((o) => o.toLowerCase()).join(", ");
  return `Happy to help! 🏔️ I'm right here whenever you need ${options} — or a live agent if you'd prefer.`;
}
