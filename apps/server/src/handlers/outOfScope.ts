import { MENU_OPTIONS } from "@upwork-chatbot/shared";

// A coherent request the bot has no data for (shipping to a country, store hours, product
// specs, pricing). We never guess an answer — we say so honestly, restate what we CAN do,
// and offer a human. In LLM mode generate.ts renders this in persona against the same menu
// facts; the guardrail keeps it from inventing anything the template didn't have.
export function outOfScopeReply(): string {
  const options = MENU_OPTIONS.map((o) => `• ${o}`).join("\n");
  return `That's a little outside what I can help with here 🏔️. I'm your North Star guide for:\n${options}\n\nWant me to connect you with a live agent for anything else?`;
}
