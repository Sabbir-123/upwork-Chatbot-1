import { ORDER_SEED, type OrderRecord } from "@upwork-chatbot/shared";

export function lookupOrder(orderNumber: string): OrderRecord | null {
  return ORDER_SEED.find((o) => o.number === orderNumber) ?? null;
}
