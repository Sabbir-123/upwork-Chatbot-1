import { useEffect, useRef } from "react";
import type { ChatMessage } from "@upwork-chatbot/shared";
import type { ChatError } from "../hooks/useChat";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { ErrorBanner } from "./ErrorBanner";

export function MessageThread({
  messages,
  isWaiting,
  streamingId,
  error,
  onRetry,
  onDismissError,
}: {
  messages: ChatMessage[];
  isWaiting: boolean;
  streamingId: string | null;
  error: ChatError | null;
  onRetry: () => void;
  onDismissError: () => void;
}) {
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isWaiting]);

  return (
    <div className="thread">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} isStreaming={streamingId === m.id} />
      ))}
      {isWaiting && <TypingIndicator />}
      {error && <ErrorBanner error={error} onRetry={onRetry} onDismiss={onDismissError} />}
      <div ref={scrollAnchorRef} />
    </div>
  );
}
