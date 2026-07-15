import { MENU_OPTIONS } from "@upwork-chatbot/shared";

export function fallbackReply(): string {
  const options = MENU_OPTIONS.map((o) => `• ${o}`).join("\n");
  return `Hmm, I didn't quite get that 🤔. Here's what I can help with:\n${options}\n\nOr say "talk to a live agent" to reach a human.`;
}
