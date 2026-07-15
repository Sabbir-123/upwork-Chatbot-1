import { SHIPPING_OPTIONS } from "@upwork-chatbot/shared";

export function shippingReply(): string {
  const lines = SHIPPING_OPTIONS.map(
    (o) => `${o.name}: ${o.minDays}–${o.maxDays} business days`
  ).join("\n");
  return `Here's our shipping timeline:\n${lines}\n\nAnything else I can help with?`;
}
