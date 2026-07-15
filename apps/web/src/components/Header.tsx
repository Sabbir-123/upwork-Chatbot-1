import { Avatar } from "./Avatar";
import type { BrainMode } from "../hooks/useChat";

type HeaderProps = {
  onNewChat: () => void;
  disabled: boolean;
  mode: BrainMode;
  onModeChange: (mode: BrainMode) => void;
  llmAvailable: boolean;
};

export function Header({ onNewChat, disabled, mode, onModeChange, llmAvailable }: HeaderProps) {
  return (
    <header className="app-header">
      <button type="button" className="brand" onClick={onNewChat} aria-label="Go to home">
        <Avatar />
        <div className="brand-text">
          <span className="brand-name">North Star</span>
          <span className="brand-tagline">Support Bot</span>
        </div>
      </button>
      <div className="app-header__actions">
        <div
          className="mode-toggle"
          role="group"
          aria-label="Response engine"
          title={
            llmAvailable
              ? "Switch between the rule-based engine and the AI (LLM) router"
              : "AI mode needs an OpenRouter API key on the server — running rule-based only"
          }
        >
          <button
            type="button"
            className={`mode-toggle__option${mode === "llm" ? " is-active" : ""}`}
            onClick={() => onModeChange("llm")}
            aria-pressed={mode === "llm"}
            disabled={!llmAvailable}
          >
            AI (LLM)
          </button>
          <button
            type="button"
            className={`mode-toggle__option${mode === "mock" ? " is-active" : ""}`}
            onClick={() => onModeChange("mock")}
            aria-pressed={mode === "mock"}
          >
            Rule-based
          </button>
        </div>
        <a className="header-link" href="/docs/mock-flow.html" target="_blank" rel="noreferrer">
          How this works
        </a>
        <button
          type="button"
          className="new-chat-btn"
          onClick={onNewChat}
          disabled={disabled}
          title="Start a new conversation"
        >
          <span className="new-chat-btn__icon">＋</span>
          New chat
        </button>
      </div>
    </header>
  );
}
