import { lookupOrder } from "../tools/lookupOrder.js";

export function extractOrderNumber(text: string, opts: { lenient?: boolean } = {}): string | null {
  // A '#'-prefixed number is an unambiguous order reference at any length (e.g. #90),
  // so accept it even mid-conversation.
  const hashed = text.match(/#\s*(\d+)/);
  if (hashed) return hashed[1];
  // Bare digits: require 3+ in open conversation so stray counts ("2 questions") aren't
  // mistaken for orders; accept any length once we've explicitly asked for the number,
  // where a bare "90" can only be the answer — then lookup fails gracefully if unknown.
  const bare = text.match(opts.lenient ? /\b(\d+)\b/ : /(\d{3,})/);
  return bare ? bare[1] : null;
}

export function askForOrderNumberReply(): string {
  return "Sure, I can help track that! What's your order number? (e.g. #111)";
}

export function orderStatusReply(orderNumber: string): string {
  const order = lookupOrder(orderNumber);
  if (!order) {
    return `Hmm, I couldn't find an order with number #${orderNumber}. Want to try another order number, or I can connect you with a live agent.`;
  }
  const parts = [`Order #${order.number}: ${order.status}.`];
  if (order.followUp) parts.push(order.followUp);
  return parts.join(" ");
}
