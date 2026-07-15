import { RETURN_POLICY } from "@upwork-chatbot/shared";

export function returnsReply(): string {
  return `We offer ${RETURN_POLICY.windowDays}-day returns and exchanges on ${RETURN_POLICY.condition}. You can start one here: ${RETURN_POLICY.link}\n\nAnything else I can help with?`;
}
