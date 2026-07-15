import { BRAND_NAME, MENU_OPTIONS } from "@upwork-chatbot/shared";

export function greetingReply(): string {
  const options = MENU_OPTIONS.map((o) => `• ${o}`).join("\n");
  return `Hi, I'm the ${BRAND_NAME} 🏔️! I can help you with:\n${options}\n\nJust let me know what you need, or ask to talk to a live agent anytime.`;
}
