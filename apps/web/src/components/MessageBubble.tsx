import type { ChatMessage } from "@upwork-chatbot/shared";
import { Avatar } from "./Avatar";

export function MessageBubble({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  return (
    <div className={`message ${isUser ? "message--user" : "message--assistant"}`}>
      {!isUser && !isSystem && <Avatar />}
      <div className={`bubble bubble--${isUser ? "user" : message.role}`}>
        {message.content}
        {isStreaming && <span className="stream-cursor" />}
      </div>
    </div>
  );
}
