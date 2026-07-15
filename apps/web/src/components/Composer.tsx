import { useEffect, useRef, type FormEvent, type KeyboardEvent } from "react";
import { IconSend } from "./icons";

export function Composer({
  input,
  onInputChange,
  isBusy,
  onSubmit,
  onStop,
}: {
  input: string;
  onInputChange: (value: string) => void;
  isBusy: boolean;
  onSubmit: (text: string) => void;
  onStop: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(input);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit(input);
    }
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <div className="composer__shell">
        <textarea
          ref={textareaRef}
          className="composer__input"
          placeholder="Message North Star Support…"
          value={input}
          rows={1}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {isBusy ? (
          <button type="button" className="composer__btn composer__btn--stop" onClick={onStop}>
            <span className="stop-icon" />
          </button>
        ) : (
          <button
            type="submit"
            className="composer__btn composer__btn--send"
            disabled={!input.trim()}
            aria-label="Send message"
          >
            <IconSend />
          </button>
        )}
      </div>
      <p className="composer__hint">
        North Star can help with orders, returns, shipping, and recommendations — or connect you to
        a human anytime.
      </p>
    </form>
  );
}
