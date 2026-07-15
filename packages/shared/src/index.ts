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
  // Social / meta chit-chat (thanks, bye, how are you, what's your name). Handled warmly
  // in persona and NOT treated as a failure — it never counts toward escalation.
  "smalltalk",
  // A coherent question the bot simply has no data for (do you ship to Canada, store hours,
  // is it waterproof). Answered with an honest in-persona deflection + a live-agent offer —
  // distinct from `fallback`, which is reserved for genuinely unintelligible input.
  "out_of_scope",
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

/** A concrete, purchasable product in the North Star catalog. */
export interface Product {
  /** Stable SKU-style id, e.g. "boot-summit-trail". */
  id: string;
  name: string;
  /** Human-facing category label (matches GearRecommendation.category). */
  category: string;
  /** Retail price in USD. */
  price: number;
  /** Activities this product is well suited for. */
  activities: Activity[];
  /** Temperature conditions this product is rated for. */
  temperatures: Temperature[];
  /** One-line reason a shopper would pick this over its siblings. */
  blurb: string;
  /** A few standout specs/features to mention in a recommendation. */
  highlights: string[];
}

/**
 * The full North Star product catalog. Each category has multiple real SKUs at
 * different price points so recommendations can be specific ("the Summit Trail
 * boots at $149") rather than just naming a category.
 */
export const PRODUCT_CATALOG: Product[] = [
  // --- Hiking Boots ---
  {
    id: "boot-summit-trail",
    name: "Summit Trail Hiker",
    category: "Hiking Boots",
    price: 149,
    activities: ["hiking"],
    temperatures: ["warm", "cold"],
    blurb: "Our do-everything three-season boot — light enough for day hikes, tough enough for loaded packs.",
    highlights: ["Waterproof breathable membrane", "Vibram outsole", "1 lb 9 oz per pair"],
  },
  {
    id: "boot-canyon-vent",
    name: "Canyon Vent Low",
    category: "Hiking Boots",
    price: 119,
    activities: ["hiking"],
    temperatures: ["warm"],
    blurb: "A breathable low-cut hiker built for hot, dry trails where airflow beats waterproofing.",
    highlights: ["Mesh upper for max airflow", "Quick-dry lining", "1 lb 3 oz per pair"],
  },
  {
    id: "boot-alpine-gtx",
    name: "Alpine Ridge GTX",
    category: "Hiking Boots",
    price: 199,
    activities: ["hiking", "winter"],
    temperatures: ["cold"],
    blurb: "A stiff, insulated backpacking boot for cold, rugged, snow-dusted terrain.",
    highlights: ["200g insulation", "GORE-TEX waterproofing", "Crampon-compatible"],
  },
  {
    id: "boot-trailrunner-x",
    name: "Trailrunner X",
    category: "Hiking Boots",
    price: 139,
    activities: ["hiking"],
    temperatures: ["warm", "cold"],
    blurb: "A fast-and-light trail-running shoe for fastpackers who want to move quick.",
    highlights: ["Rock plate underfoot", "Grippy lug outsole", "14 oz per pair"],
  },

  // --- Insulated Jackets ---
  {
    id: "jacket-northwind-down",
    name: "Northwind 800 Down",
    category: "Insulated Jackets",
    price: 279,
    activities: ["hiking", "winter", "camping"],
    temperatures: ["cold"],
    blurb: "Our warmest packable down jacket for deep-cold days and camp evenings.",
    highlights: ["800-fill responsibly sourced down", "Packs into its own pocket", "Rated to 5°F / -15°C"],
  },
  {
    id: "jacket-ember-synthetic",
    name: "Ember Synthetic Hoodie",
    category: "Insulated Jackets",
    price: 179,
    activities: ["hiking", "winter", "camping"],
    temperatures: ["cold", "warm"],
    blurb: "A do-it-all synthetic insulator that keeps warming even when damp — great for shoulder seasons.",
    highlights: ["PrimaLoft synthetic fill", "Warm when wet", "Rated to 25°F / -4°C"],
  },
  {
    id: "jacket-glacier-parka",
    name: "Glacier Expedition Parka",
    category: "Insulated Jackets",
    price: 379,
    activities: ["winter", "camping"],
    temperatures: ["cold"],
    blurb: "A knee-length expedition parka for the deepest, most brutal winter cold.",
    highlights: ["900-fill down", "Storm hood with fur ruff", "Rated to -25°F / -32°C"],
  },

  // --- Tents ---
  {
    id: "tent-meadow-2",
    name: "Meadowlight 2P",
    category: "Tents",
    price: 229,
    activities: ["camping", "hiking"],
    temperatures: ["warm"],
    blurb: "A breezy, freestanding two-person tent that shines on warm-weather trips.",
    highlights: ["Large mesh panels for airflow", "3 lb 6 oz packed", "Dual doors & vestibules"],
  },
  {
    id: "tent-basecamp-4",
    name: "Basecamp 4P",
    category: "Tents",
    price: 349,
    activities: ["camping"],
    temperatures: ["warm", "cold"],
    blurb: "A roomy family car-camping tent with headroom to stand and a full-coverage fly.",
    highlights: ["Stand-up height", "Full-coverage rainfly", "Sleeps 4 comfortably"],
  },
  {
    id: "tent-stormpeak-2",
    name: "Stormpeak 2P 4-Season",
    category: "Tents",
    price: 429,
    activities: ["camping", "winter", "hiking"],
    temperatures: ["cold"],
    blurb: "A burly four-season tent that stands up to snow load and hard winter wind.",
    highlights: ["4-season geometry", "Sheds snow load", "Reinforced pole structure"],
  },

  // --- Sleeping Bags ---
  {
    id: "bag-frostline-15",
    name: "Frostline 15° Down",
    category: "Sleeping Bags",
    price: 259,
    activities: ["camping", "hiking", "winter"],
    temperatures: ["cold"],
    blurb: "A cold-rated down mummy bag that keeps you toasty through freezing nights.",
    highlights: ["15°F / -9°C comfort rating", "650-fill down", "Draft collar & hood"],
  },
  {
    id: "bag-summernight-40",
    name: "Summernight 40° Quilt",
    category: "Sleeping Bags",
    price: 139,
    activities: ["camping", "hiking"],
    temperatures: ["warm"],
    blurb: "An ultralight warm-weather quilt for mild nights when a full bag is overkill.",
    highlights: ["40°F / 4°C rating", "Under 1 lb 8 oz", "Opens flat as a blanket"],
  },
  {
    id: "bag-polar-neg20",
    name: "Polar -20° Expedition",
    category: "Sleeping Bags",
    price: 389,
    activities: ["winter", "camping"],
    temperatures: ["cold"],
    blurb: "A serious deep-winter mummy bag for sub-zero alpine and expedition nights.",
    highlights: ["-20°F / -29°C rating", "850-fill water-resistant down", "Full draft tube & collar"],
  },

  // --- Backpacks ---
  {
    id: "pack-trailhead-30",
    name: "Trailhead 30 Daypack",
    category: "Backpacks",
    price: 129,
    activities: ["hiking", "winter"],
    temperatures: ["warm", "cold"],
    blurb: "A versatile 30L daypack sized for day hikes and shoulder-season outings.",
    highlights: ["30L capacity", "Hydration-sleeve ready", "Ventilated back panel"],
  },
  {
    id: "pack-expedition-65",
    name: "Expedition 65 Pack",
    category: "Backpacks",
    price: 239,
    activities: ["camping", "hiking", "winter"],
    temperatures: ["warm", "cold"],
    blurb: "A full-size 65L hauler for multi-day trips when you're carrying everything in.",
    highlights: ["65L capacity", "Adjustable torso fit", "Rain cover included"],
  },
];

export interface GearRecommendation {
  category: string;
  justification: string;
  /** Concrete catalog products that match the shopper, best fit first. */
  products: Product[];
}

/** Which category we steer each activity + temperature toward. */
const CATEGORY_BY_CONTEXT: Record<Activity, Record<Temperature, string>> = {
  hiking: { warm: "Hiking Boots", cold: "Insulated Jackets" },
  camping: { warm: "Tents", cold: "Sleeping Bags" },
  winter: { warm: "Backpacks", cold: "Insulated Jackets" },
};

const JUSTIFICATION_BY_CATEGORY: Record<string, string> = {
  "Hiking Boots": "Breathable, supportive boots keep you comfortable on the trail.",
  "Insulated Jackets": "An insulated jacket keeps you warm without weighing you down.",
  Tents: "A well-ventilated tent makes a great base camp.",
  "Sleeping Bags": "A cold-rated sleeping bag is essential for staying warm through the night.",
  Backpacks: "A versatile pack keeps your gear organized on the move.",
};

/** Products in a category, with exact activity + temperature matches ranked first. */
export function findProducts(category: string, activity: Activity, temperature: Temperature): Product[] {
  return PRODUCT_CATALOG.filter((p) => p.category === category)
    .map((p) => ({
      p,
      score:
        (p.activities.includes(activity) ? 2 : 0) + (p.temperatures.includes(temperature) ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.p.price - b.p.price)
    .map((entry) => entry.p);
}

export function pickGearRecommendation(activity: Activity, temperature: Temperature): GearRecommendation {
  const category = CATEGORY_BY_CONTEXT[activity][temperature];
  return {
    category,
    justification: JUSTIFICATION_BY_CATEGORY[category],
    products: findProducts(category, activity, temperature),
  };
}
