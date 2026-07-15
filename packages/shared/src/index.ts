export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "agent" | "system";
  content: string;
  createdAt?: number;
}

export type ConversationStatus = "bot" | "waiting_agent" | "agent_handling";

export interface Conversation {
  id: string;
  status: ConversationStatus;
  needsHuman: boolean;
  updatedAt: number;
  preview: string;
  messageCount: number;
}

export const INTENTS = [
  "greeting",
  "order_tracking",
  "returns",
  "shipping",
  "recommendation",
  "human_handoff",
  "fallback",
] as const;

export type Intent = (typeof INTENTS)[number];

export const SESSION_MODES = [
  "main",
  "awaiting_order_number",
  "recommend_flow",
  "live_agent",
] as const;

export type SessionMode = (typeof SESSION_MODES)[number];

export const BRAND_NAME = "North Star Support Bot";

export const BRAND_PERSONA_SYSTEM_PROMPT = `You are the ${BRAND_NAME} 🏔️, the friendly customer-support assistant for North Star, an outdoor-apparel and camping-gear store.
Tone: warm, outdoorsy, concise, and helpful — like a knowledgeable trail buddy, not a corporate script.
You help with exactly four things: order tracking, returns & exchanges, shipping info, and product recommendations. You can also connect the user to a live human agent if they ask.
Never invent order statuses, policies, or facts — always rely on the data and tools you are given.`;

export const MENU_OPTIONS = [
  "Track an order",
  "Returns & exchanges",
  "Shipping info",
  "Product recommendations",
] as const;

export interface OrderRecord {
  number: string;
  status: string;
  followUp?: string;
}

export const ORDER_SEED: OrderRecord[] = [
  { number: "111", status: "Shipped, arriving tomorrow" },
  { number: "222", status: "Processing, ships in 24 hours" },
  {
    number: "333",
    status: "Delivered",
    followUp: "Anything else about this delivery — a return or exchange?",
  },
];

export const RETURN_POLICY = {
  windowDays: 30,
  condition: "unused items in their original packaging",
  link: "https://northstar.example/returns",
};

export const SHIPPING_OPTIONS = [
  { name: "Standard", minDays: 3, maxDays: 5 },
  { name: "Expedited", minDays: 1, maxDays: 2 },
] as const;

export const ACTIVITIES = ["hiking", "camping", "winter"] as const;
export type Activity = (typeof ACTIVITIES)[number];

export const TEMPERATURES = ["warm", "cold"] as const;
export type Temperature = (typeof TEMPERATURES)[number];

export interface GearRecommendation {
  category: string;
  justification: string;
}

const GEAR_RECOMMENDATIONS: Record<Activity, Record<Temperature, GearRecommendation>> = {
  hiking: {
    warm: {
      category: "Hiking Boots",
      justification: "Breathable, supportive boots keep you comfortable on warm-weather trails.",
    },
    cold: {
      category: "Insulated Jackets",
      justification: "An insulated jacket keeps you warm on chilly hikes without weighing you down.",
    },
  },
  camping: {
    warm: {
      category: "Tents",
      justification: "A well-ventilated tent makes a great base camp for warm-weather trips.",
    },
    cold: {
      category: "Sleeping Bags",
      justification: "A cold-rated sleeping bag is essential for staying warm through the night.",
    },
  },
  winter: {
    warm: {
      category: "Backpacks",
      justification: "A versatile backpack keeps your gear organized for shoulder-season winter trips.",
    },
    cold: {
      category: "Insulated Jackets",
      justification: "For winter trips in the cold, an insulated jacket is non-negotiable.",
    },
  },
};

export function pickGearRecommendation(activity: Activity, temperature: Temperature): GearRecommendation {
  return GEAR_RECOMMENDATIONS[activity][temperature];
}
