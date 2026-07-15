import { Avatar } from "./Avatar";
import { IconBackpack, IconPackage, IconTruck, IconUndo } from "./icons";

const QUICK_ACTIONS = [
  { icon: IconPackage, label: "Track an order", prompt: "Where is my order #111?" },
  { icon: IconUndo, label: "Returns & exchanges", prompt: "What's your return policy?" },
  { icon: IconTruck, label: "Shipping info", prompt: "How long does shipping take?" },
  { icon: IconBackpack, label: "Gear recommendations", prompt: "Can you recommend some gear for me?" },
] as const;

export function WelcomeScreen({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="welcome">
      <div className="welcome__orb">
        <Avatar />
      </div>
      <h1 className="welcome__title">
        <span className="welcome__title-gradient">Hey there, trailblazer.</span>
      </h1>
      <p className="welcome__subtitle">
        I'm your North Star guide — ask about an order, a return, shipping times, or let me point
        you to the right gear.
      </p>
      <div className="quick-actions">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            className="quick-action"
            onClick={() => onSelect(action.prompt)}
          >
            <span className="quick-action__icon">
              <action.icon />
            </span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
