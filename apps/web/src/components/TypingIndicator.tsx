import { Avatar } from "./Avatar";

export function TypingIndicator() {
  return (
    <div className="message message--assistant">
      <Avatar pulsing />
      <div className="bubble bubble--assistant bubble--typing">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  );
}
