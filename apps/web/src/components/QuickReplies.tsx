// Tappable shortcuts shown above the composer once a conversation is underway. They make
// the bot's capabilities discoverable in one click (a big usability win) and keep the demo
// crisp. Context-aware: during a live-agent handoff the only shortcut is returning to the bot.
const MENU_CHIPS = [
  { label: "Track an order", prompt: "Where is my order?" },
  { label: "Returns & exchanges", prompt: "What's your return policy?" },
  { label: "Shipping info", prompt: "How long does shipping take?" },
  { label: "Recommend gear", prompt: "Can you recommend some gear?" },
  { label: "Talk to a live agent", prompt: "I'd like to talk to a live agent" },
] as const;

const LIVE_AGENT_CHIPS = [{ label: "← Back to the bot", prompt: "menu" }] as const;

export function QuickReplies({
  isLiveAgent,
  disabled,
  onSelect,
}: {
  isLiveAgent: boolean;
  disabled: boolean;
  onSelect: (prompt: string) => void;
}) {
  const chips = isLiveAgent ? LIVE_AGENT_CHIPS : MENU_CHIPS;
  return (
    <div className="quick-replies" role="group" aria-label="Suggested actions">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          className="quick-reply"
          disabled={disabled}
          onClick={() => onSelect(chip.prompt)}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
