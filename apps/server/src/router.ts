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
  { intent: "recommendation", pattern: /\b(recommend|suggest|what .*(should|would) .*(buy|get)|looking for (a|some)|need (some )?gear)\b/i },
  // Lowest priority: a bare ask for help/the menu — specific intents above win first, so
  // "help me return this" still routes to returns, while "i need help" gets the warm menu
  // instead of the "didn't quite get that" fallback.
  { intent: "greeting", pattern: /\b(help|menu|options|get started|what can (you|u) (do|help)|how (do|does) (this|you) work|where (do|to) (i|we) start)\b/i },
];

function mockClassify(message: string): Intent {
  for (const rule of MOCK_RULES) {
    if (rule.pattern.test(message)) return rule.intent;
  }
  return "fallback";
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
Classify the user's latest message into exactly one intent from the allowed set. Pick "fallback" if nothing else clearly applies.

Examples:
"hi" / "good morning" / "what's up" -> greeting
"where is my order?" / "track my package" / "wheres #111" -> order_tracking
"how do I return this" / "can I get my money back" / "how do exchanges work" -> returns
"how long is shipping" / "delivery time" / "when will it arrive" -> shipping
"recommend something" / "what jacket should I buy" / "I need gear for camping" -> recommendation
"talk to a person" / "connect me to support staff" / "let me talk to an agent" -> human_handoff
"asdkjaslkdj" / "do you sell cars" / "tell me a joke" -> fallback`;

const UNDERSTAND_SYSTEM_PROMPT = `${ROUTER_SYSTEM_PROMPT}

Also extract these slots when the message contains them, otherwise return null:
- orderNumber: just the digits of any order number the user mentions ("#111" -> "111", "order ninety" -> "90", "it's 222" -> "222").
- activity: the outdoor activity they're gearing up for, one of: hiking, camping, winter.
- temperature: the weather they'll be in, one of: warm, cold.`;

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
