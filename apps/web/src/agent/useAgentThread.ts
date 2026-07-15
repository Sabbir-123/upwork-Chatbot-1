import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, ConversationStatus } from "@upwork-chatbot/shared";

export function useAgentThread(convId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConversationStatus>("bot");
  const [needsHuman, setNeedsHuman] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Read the latest status inside the SSE handler without making it an effect
  // dependency — otherwise a status change tears down and recreates the
  // EventSource, dropping any message in flight (e.g. the agent's own first reply).
  const statusRef = useRef(status);
  statusRef.current = status;

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
  }, []);

  useEffect(() => {
    if (!convId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/agent/conversations/${convId}`)
      .then((res) => res.json())
      .then((data: { messages: ChatMessage[]; status: ConversationStatus; needsHuman: boolean }) => {
        if (cancelled) return;
        setMessages(data.messages);
        setStatus(data.status);
        setNeedsHuman(data.needsHuman);
      });
    return () => {
      cancelled = true;
    };
  }, [convId]);

  useEffect(() => {
    if (!convId) return;
    const source = new EventSource(`/api/agent/conversations/${convId}/stream`);
    source.addEventListener("message", (evt) => {
      const message = JSON.parse((evt as MessageEvent).data) as ChatMessage;
      appendMessage(message);
      if (message.role === "user") setNeedsHuman((prev) => prev || statusRef.current !== "agent_handling");
    });
    return () => source.close();
  }, [convId, appendMessage]);

  const reply = useCallback(
    async (text: string) => {
      if (!convId || !text.trim()) return;
      setIsSending(true);
      try {
        const res = await fetch(`/api/agent/conversations/${convId}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        });
        // Show the reply immediately rather than waiting on the SSE echo, which
        // can race with the takeover status change. Dedup by id keeps this safe.
        const data = (await res.json().catch(() => null)) as { message?: ChatMessage } | null;
        if (data?.message) appendMessage(data.message);
        setStatus("agent_handling");
        setNeedsHuman(false);
      } finally {
        setIsSending(false);
      }
    },
    [convId, appendMessage]
  );

  const takeover = useCallback(async () => {
    if (!convId) return;
    await fetch(`/api/agent/conversations/${convId}/takeover`, { method: "POST" });
    setStatus("agent_handling");
    setNeedsHuman(false);
  }, [convId]);

  const release = useCallback(async () => {
    if (!convId) return;
    await fetch(`/api/agent/conversations/${convId}/release`, { method: "POST" });
    setStatus("bot");
    setNeedsHuman(false);
  }, [convId]);

  return { messages, status, needsHuman, isSending, reply, takeover, release };
}
