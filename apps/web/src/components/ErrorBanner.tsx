import type { ChatError } from "../hooks/useChat";
import { IconWarning } from "./icons";

export function ErrorBanner({
  error,
  onRetry,
  onDismiss,
}: {
  error: ChatError;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="error-banner" role="alert">
      <span className="error-banner__icon">
        <IconWarning />
      </span>
      <span className="error-banner__text">{error.reason} The trail went cold for a second.</span>
      <div className="error-banner__actions">
        <button type="button" onClick={onRetry} className="error-banner__retry">
          Try again
        </button>
        <button type="button" onClick={onDismiss} className="error-banner__dismiss">
          Dismiss
        </button>
      </div>
    </div>
  );
}
