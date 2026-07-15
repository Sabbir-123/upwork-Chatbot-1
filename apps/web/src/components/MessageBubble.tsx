import type { ChatMessage } from "@upwork-chatbot/shared";
import { Avatar } from "./Avatar";
import { Markdown } from "./Markdown";

export function MessageBubble({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming: boolean;
}) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  // Bot and human-agent replies arrive as markdown from the LLM/agent; the customer's
  // own text and system notices are shown verbatim.
  const renderMarkdown = !isUser && !isSystem;
  return (
    <div className={`message ${isUser ? "message--user" : "message--assistant"}`}>
      {!isUser && !isSystem && <Avatar />}
      <div className={`bubble bubble--${isUser ? "user" : message.role}`}>
        {renderMarkdown ? <Markdown content={message.content} /> : message.content}
        {isStreaming && <span className="stream-cursor" />}
      </div>
    </div>
  );
}
