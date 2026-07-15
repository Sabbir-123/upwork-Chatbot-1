import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@upwork-chatbot/shared";

const SESSION_ID_KEY = "northstar-session-id";
const MODE_KEY = "northstar-mode";

export type BrainMode = "mock" | "llm";

export type ChatError = {
  assistantId: string;
  messagesSnapshot: ChatMessage[];
  reason: string;
};

function createId(): string {
  return crypto.randomUUID();
}

function readSessionId(): string {
  let id = localStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = createId();
    localStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

function readMode(): BrainMode {
  return localStorage.getItem(MODE_KEY) === "mock" ? "mock" : "llm";
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<ChatError | null>(null);
  const [sessionId, setSessionId] = useState(readSessionId);
  const [mode, setModeState] = useState<BrainMode>(readMode);
  const [llmAvailable, setLlmAvailable] = useState(false);
  const [isLiveAgent, setIsLiveAgent] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const isBusy = isWaiting || isStreaming;

  // Ask the server whether the AI mode can be offered. If not, force mock.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/config")
      .then((res) => (res.ok ? res.json() : { llmAvailable: false }))
      .then((cfg: { llmAvailable?: boolean }) => {
        if (cancelled) return;
        const available = !!cfg.llmAvailable;
        setLlmAvailable(available);
        if (!available) {
          setModeState("mock");
          localStorage.setItem(MODE_KEY, "mock");
        }
      })
      .catch(() => {
        if (!cancelled) setLlmAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Out-of-band channel: delivers human-agent replies, system notices, and the
  // release-to-bot greeting, none of which arrive via this browser's own POST.
  useEffect(() => {
    const source = new EventSource(`/api/conversations/${sessionId}/stream`);

    source.addEventListener("message", (evt) => {
      const message = JSON.parse((evt as MessageEvent).data) as ChatMessage;
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    });

    source.addEventListener("mode", (evt) => {
      const { mode: nextMode } = JSON.parse((evt as MessageEvent).data) as { mode: string };
      setIsLiveAgent(nextMode === "live_agent");
    });

    return () => source.close();
  }, [sessionId]);

  const setMode = useCallback(
    (next: BrainMode) => {
      if (next === "llm" && !llmAvailable) return;
      setModeState(next);
      localStorage.setItem(MODE_KEY, next);
    },
    [llmAvailable]
  );

  const runStream = useCallback(
    async (nextMessages: ChatMessage[], assistantId: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setStreamingId(assistantId);
      setError(null);
      setIsWaiting(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextMessages, sessionId, mode }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`The server responded with ${res.status}.`);
        }

        const headerMode = res.headers.get("X-Session-Mode");
        if (headerMode) setIsLiveAgent(headerMode === "live_agent");

        if (res.status === 204 || !res.body) {
          // Awaiting a human reply — nothing to stream, the SSE channel delivers it.
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let receivedAny = false;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;
          if (!receivedAny) {
            receivedAny = true;
            setIsWaiting(false);
            setIsStreaming(true);
            setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: chunk }]);
          } else {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + chunk } : m))
            );
          }
        }

        if (!receivedAny) {
          throw new Error("The assistant didn't return a response.");
        }
      } catch (err) {
        if (controller.signal.aborted) {
          // user-initiated stop; keep whatever partial content arrived
        } else {
          const reason = err instanceof Error ? err.message : "Something went wrong.";
          setError({ assistantId, messagesSnapshot: nextMessages, reason });
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        }
      } finally {
        setIsWaiting(false);
        setIsStreaming(false);
        setStreamingId(null);
        abortRef.current = null;
      }
    },
    [sessionId, mode]
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isBusy) return;

      const userMessage: ChatMessage = { id: createId(), role: "user", content: trimmed };
      const assistantId = createId();
      const nextMessages = [...messages, userMessage];

      setMessages(nextMessages);
      setInput("");
      void runStream(nextMessages, assistantId);
    },
    [messages, isBusy, runStream]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    if (!error) return;
    const assistantId = createId();
    const { messagesSnapshot } = error;
    setError(null);
    setMessages(messagesSnapshot);
    void runStream(messagesSnapshot, assistantId);
  }, [error, runStream]);

  const dismissError = useCallback(() => setError(null), []);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    const id = createId();
    localStorage.setItem(SESSION_ID_KEY, id);
    setSessionId(id);
    setMessages([]);
    setError(null);
    setInput("");
    setIsLiveAgent(false);
  }, []);

  return {
    messages,
    input,
    setInput,
    isWaiting,
    isStreaming,
    isBusy,
    streamingId,
    error,
    send,
    stop,
    retry,
    dismissError,
    newChat,
    mode,
    setMode,
    llmAvailable,
    isLiveAgent,
  };
}
