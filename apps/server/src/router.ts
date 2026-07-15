import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import {
  ACTIVITIES,
  BRAND_PERSONA_SYSTEM_PROMPT,
  INTENTS,
  TEMPERATURES,
  type Activity,
  type Intent,
  type Temperature,
} from "@upwork-chatbot/shared";
import { extractOrderNumber } from "./handlers/orderTracking.js";
import { extractActivity, extractTemperature } from "./handlers/recommendation.js";
import { log, logError } from "./logger.js";

// The LLM path is *available* whenever a key is configured. Whether it is *used*
// for a given request is decided per-request by the client toggle (see understand).
export function llmAvailable(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

// A single understanding of the user's message: which intent, plus any slots we could
// pull out of the same utterance (order number, recommendation activity/temperature).
// The flow engine consumes this so a slot supplied mid-sentence ("track #222 please",
// "hiking gear for cold weather") is honored without a second turn.
export interface Understanding {
  intent: Intent;
  orderNumber?: string;
  activity?: Activity;
  temperature?: Temperature;
}

const MOCK_RULES: Array<{ intent: Intent; pattern: RegExp }> = [
  { intent: "human_handoff", pattern: /\b(human|agent|representative|real person|support (staff|team)|connect me (to|with)|talk to (a |an )?(person|someone)|speak (to|with) (a |an )?(person|someone)|someone real)\b/i },
  { intent: "greeting", pattern: /^\s*(hi|hello|hey|yo|sup|what'?s up|good (morning|afternoon|evening))\b/i },
  { intent: "order_tracking", pattern: /\b(order|track|package|shipment)\b|wheres?\s*#?\d+|(where'?s|where is) my (stuff|thing|item|order|package)|hasn'?t (arrived|come|shipped|showed up)|still waiting(?!.*\b(refund|return|exchange)\w*)|lost package|didn'?t (arrive|come)|my (order|package|stuff).*arriv\w*/i },
  { intent: "returns", pattern: /\b(return|refund|exchange\w*|money back|send (it|this|that)? ?back|wrong (size|item)|doesn'?t fit)\b/i },
  { intent: "shipping", pattern: /\b(shipping|deliver\w*|arriv\w*|how long(?! (have|has|had|are|were|been|since|ago))|when will it (ship|arrive)|expedited|standard shipping)\b/i },
  { intent: "recommendation", pattern: /\b(recommend|suggest|products?|purchase|what .*(should|would) .*(buy|get|purchase|wear)|what to (buy|get|wear)|looking for (a|some)|need (some )?gear|help me (choose|pick|decide))\b/i },
  // Social / meta chit-chat: sits below the four use cases (so "thanks, where's my order"
  // still routes to order_tracking) but above the help/menu catch, so a bare "thanks" or
  // "how are you" gets a warm reply instead of the "didn't quite get that" fallback.
  { intent: "smalltalk", pattern: /^\s*(thanks?|thank you|thx|ty|cheers|much appreciated|appreciate it|no thanks?|nope|nah|yep|yeah|yes|sure|ok(ay)?|k|cool|nice|great|awesome|perfect|sweet|sounds good|got it|bye|goodbye|see ?ya|see you|later|good ?night)\b|how are you|how'?s it going|how'?s your day|who are you|what'?s your name|whats your name|are you (a )?(bot|human|real|robot|ai)|nice to meet|(you'?re|ur) (great|awesome|the best|helpful|nice)|love you|good bot/i },
  // Lowest priority: a bare ask for help/the menu — specific intents above win first, so
  // "help me return this" still routes to returns, while "i need help" gets the warm menu
  // instead of the "didn't quite get that" fallback.
  { intent: "greeting", pattern: /\b(help|menu|options|get started|what (do (you|u) (do|offer|provide)|services? do (you|u) (provide|offer)|can (you|u) (do|help))|how (do|does) (this|you) work|where (do|to) (i|we) start)\b/i },
];

// Common English function/question words. Their presence is a strong signal the message is
// a real (if unanswerable) request — "do you ship to canada", "what are your hours" — rather
// than keyboard mash. Used to split coherent out-of-scope questions from true gibberish.
const INTELLIGIBLE_WORDS = new Set([
  "what", "whats", "where", "when", "why", "who", "whom", "whose", "which", "how",
  "do", "does", "did", "can", "could", "will", "would", "should", "is", "are", "am",
  "was", "were", "have", "has", "had", "may", "might", "you", "your", "youre", "u",
  "i", "me", "my", "we", "us", "our", "they", "them", "the", "a", "an", "to", "for",
  "of", "in", "on", "with", "about", "there", "here", "this", "that", "sell", "ship",
  "shipping", "price", "cost", "store", "stores", "open", "hours", "buy", "offer",
  "get", "want", "need", "tell", "give", "know", "material", "waterproof", "warranty",
  "discount", "coupon", "gift", "card", "size", "color", "stock", "available",
]);

// Distinguishes a coherent-but-unanswerable question ("do you sell cars") from genuinely
// unintelligible input ("asdkjaslkdj"). Conservative on the fallback side: a question mark
// or any recognizable English word tips it to out_of_scope.
function looksIntelligible(message: string): boolean {
  if (message.includes("?")) return true;
  const words = message.toLowerCase().match(/[a-z']+/g) ?? [];
  return words.some((w) => INTELLIGIBLE_WORDS.has(w));
}

function mockClassify(message: string): Intent {
  for (const rule of MOCK_RULES) {
    if (rule.pattern.test(message)) return rule.intent;
  }
  // Nothing matched: a coherent question we lack data for is out_of_scope; only true
  // gibberish falls through to fallback (which is what drives escalation).
  return looksIntelligible(message) ? "out_of_scope" : "fallback";
}

// Deterministic (no-network) understanding: regex intent + regex slot extraction. This is
// what runs for evaluators reviewing the repo locally without an API key, so it must be solid.
function mockUnderstand(message: string): Understanding {
  return {
    intent: mockClassify(message),
    orderNumber: extractOrderNumber(message) ?? undefined,
    activity: extractActivity(message) ?? undefined,
    temperature: extractTemperature(message) ?? undefined,
  };
}

const ROUTER_SYSTEM_PROMPT = `${BRAND_PERSONA_SYSTEM_PROMPT}
Classify the user's latest message into exactly one intent from the allowed set.
Distinguish the three "off-topic" intents carefully:
- smalltalk: social or meta remarks — greetings of thanks/farewell, "how are you", "what's your name", compliments, one-word acknowledgements ("ok", "cool", "sure").
- out_of_scope: a coherent, genuine question or request the bot has no data for — anything not about order tracking, returns, shipping, or recommendations (e.g. countries shipped to, store hours, product specs, pricing, jokes, general knowledge).
- fallback: only genuinely unintelligible input — gibberish, keyboard mash, or empty-of-meaning text.

Examples:
"hi" / "good morning" / "what's up" / "what can you do" / "what services do you provide" -> greeting
"where is my order?" / "track my package" / "wheres #111" -> order_tracking
"how do I return this" / "can I get my money back" / "how do exchanges work" -> returns
"how long is shipping" / "delivery time" / "when will it arrive" -> shipping
"recommend something" / "what jacket should I buy" / "I need gear for camping" -> recommendation
"talk to a person" / "connect me to support staff" / "let me talk to an agent" -> human_handoff
"thanks!" / "you're awesome" / "how are you" / "what's your name" / "bye" -> smalltalk
"do you ship to Canada" / "are the jackets waterproof" / "what are your store hours" / "do you sell cars" / "tell me a joke" -> out_of_scope
"asdkjaslkdj" / "12345" / "kdjf lkjdf" -> fallback`;

const UNDERSTAND_SYSTEM_PROMPT = `${ROUTER_SYSTEM_PROMPT}

Also extract these slots. Only extract a slot when the user EXPLICITLY states it; if it is not explicitly stated, return null. Do NOT guess or infer a slot from a destination, place name, season, holiday, or any world knowledge — an unstated slot must be null.
- orderNumber: just the digits of an order number the user actually gives ("#111" -> "111", "order ninety" -> "90", "it's 222" -> "222"). No number mentioned -> null.
- activity: the outdoor activity, one of: hiking, camping, winter — only if the user names it. A place or trip with no named activity -> null.
- temperature: the weather, one of: warm, cold — only if the user names it. A place name alone (e.g. a tropical or snowy destination) -> null; never infer the weather from where they're going.

Slot examples:
"trip to saint martin" -> activity null, temperature null (a destination names no activity and no weather)
"beach vacation next week" -> activity null, temperature null
"I'm going hiking somewhere cold" -> activity hiking, temperature cold
"I need gear for camping" -> activity camping, temperature null`;

const UNDERSTAND_SCHEMA = z.object({
  intent: z.enum(INTENTS),
  orderNumber: z.string().nullable(),
  activity: z.enum(ACTIVITIES).nullable(),
  temperature: z.enum(TEMPERATURES).nullable(),
});

async function llmUnderstand(sessionId: string, message: string): Promise<Understanding> {
  const model = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-5";
  log(sessionId, "nlu.llm.request", { model, message });

  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

  const { object } = await generateObject({
    model: openrouter(model),
    schema: UNDERSTAND_SCHEMA,
    system: UNDERSTAND_SYSTEM_PROMPT,
    prompt: message,
    // Deterministic classification: intent + slots shouldn't vary run-to-run for the same
    // input, and low temperature curbs the model inventing slots it can't ground in the text.
    temperature: 0,
    abortSignal: AbortSignal.timeout(10000),
  });

  const understanding: Understanding = {
    intent: object.intent,
    orderNumber: object.orderNumber ?? undefined,
    activity: object.activity ?? undefined,
    temperature: object.temperature ?? undefined,
  };
  log(sessionId, "nlu.llm.response", { model, ...understanding });
  return understanding;
}

// Intent + slot extraction in one shot. Uses the LLM when the client asked for it and a
// key is configured; otherwise (and on any LLM error) falls back to the deterministic path.
export async function understand(
  sessionId: string,
  message: string,
  useLlm: boolean
): Promise<Understanding> {
  const wantsLlm = useLlm && llmAvailable();

  if (wantsLlm) {
    try {
      return await llmUnderstand(sessionId, message);
    } catch (err) {
      logError(sessionId, "nlu.llm.failed", err, { message });
      // fall through to the deterministic path
    }
  }

  const understanding = mockUnderstand(message);
  log(sessionId, "nlu.mock", { message, ...understanding });
  return understanding;
}

// Kept for callers/tests that only need the intent. Exercises the same understanding path.
export async function classifyIntent(
  sessionId: string,
  message: string,
  useLlm: boolean
): Promise<Intent> {
  return (await understand(sessionId, message, useLlm)).intent;
}
