import { useEffect, useState } from "react";
import type { Conversation } from "@upwork-chatbot/shared";

function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => {
    if (a.needsHuman !== b.needsHuman) return a.needsHuman ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

export function useAgentInbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agent/conversations")
      .then((res) => res.json())
      .then((data: { conversations: Conversation[] }) => {
        if (!cancelled) setConversations(sortConversations(data.conversations));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/agent/stream");
    source.addEventListener("conversation", (evt) => {
      const conversation = JSON.parse((evt as MessageEvent).data) as Conversation;
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== conversation.id);
        next.push(conversation);
        return sortConversations(next);
      });
    });
    return () => source.close();
  }, []);

  return { conversations };
}
