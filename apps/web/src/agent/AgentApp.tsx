import { useState } from "react";
import { MessageThread } from "../components/MessageThread";
import { Composer } from "../components/Composer";
import { useAgentInbox } from "./useAgentInbox";
import { useAgentThread } from "./useAgentThread";
import "../App.css";

export default function AgentApp() {
  const { conversations } = useAgentInbox();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const thread = useAgentThread(selectedId);

  return (
    <div className="agent-app">
      <aside className="agent-inbox">
        <div className="agent-inbox__header">Conversations</div>
        <ul className="agent-inbox__list">
          {conversations.map((conv) => (
            <li key={conv.id}>
              <button
                type="button"
                className={`agent-inbox__item ${conv.id === selectedId ? "agent-inbox__item--active" : ""} ${conv.needsHuman ? "agent-inbox__item--needs-human" : ""}`}
                onClick={() => setSelectedId(conv.id)}
              >
                <div className="agent-inbox__item-top">
                  <span className="agent-inbox__id">{conv.id.slice(0, 8)}</span>
                  {conv.needsHuman && <span className="agent-inbox__badge">needs human</span>}
                </div>
                <div className="agent-inbox__preview">{conv.preview || "(no messages yet)"}</div>
              </button>
            </li>
          ))}
          {conversations.length === 0 && <li className="agent-inbox__empty">No conversations yet.</li>}
        </ul>
      </aside>

      <main className="agent-thread">
        {selectedId ? (
          <>
            <div className="agent-thread__header">
              <div className="agent-thread__header-left">
                <span className="agent-thread__status">Status: {thread.status.replace("_", " ")}</span>
                {thread.needsHuman && <span className="agent-thread__badge">Needs human</span>}
              </div>
              {thread.status === "agent_handling" ? (
                <button type="button" className="agent-thread__action" onClick={() => void thread.release()}>
                  Release to bot
                </button>
              ) : (
                <button type="button" className="agent-thread__action" onClick={() => void thread.takeover()}>
                  Take over
                </button>
              )}
            </div>
            <div className="chat-viewport">
              <MessageThread
                messages={thread.messages}
                isWaiting={false}
                streamingId={null}
                error={null}
                onRetry={() => {}}
                onDismissError={() => {}}
              />
            </div>
            <Composer
              input={draft}
              onInputChange={setDraft}
              isBusy={thread.isSending}
              onSubmit={(text) => {
                void thread.reply(text);
                setDraft("");
              }}
              onStop={() => {}}
            />
          </>
        ) : (
          <div className="agent-thread__placeholder">Select a conversation to view the transcript.</div>
        )}
      </main>
    </div>
  );
}
