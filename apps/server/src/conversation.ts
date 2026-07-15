import type { Intent } from "@upwork-chatbot/shared";
import type { SessionState } from "./store.js";
import type { Understanding } from "./router.js";
import { greetingReply } from "./handlers/greeting.js";
import { fallbackReply } from "./handlers/fallback.js";
import { askForOrderNumberReply, extractOrderNumber, orderStatusReply } from "./handlers/orderTracking.js";
import { returnsReply } from "./handlers/returns.js";
import { shippingReply } from "./handlers/shipping.js";
import {
  askActivityReply,
  askTemperatureReply,
  extractActivity,
  extractTemperature,
  recommendationReply,
} from "./handlers/recommendation.js";
import { handoffReply, isBackToBot, liveAgentHoldingReply } from "./handlers/handoff.js";

const ESCALATION_THRESHOLD = 2;

// Intents a stray sub-flow message can confidently switch to; "fallback" re-prompts instead.
const REROUTABLE_INTENTS: ReadonlySet<Intent> = new Set([
  "returns",
  "shipping",
  "human_handoff",
  "order_tracking",
  "recommendation",
]);

// What the pure state machine decided for one turn.
export interface TurnResult {
  // The bot's reply. `null` means "deliver this turn to a real human agent, bot stays
  // silent" — only happens once a human has actually taken the conversation over.
  reply: string | null;
  // True when the reply is null and the customer is waiting on a real human.
  awaitingHuman: boolean;
}

// Context the state machine needs beyond the session itself.
export interface TurnContext {
  // Whether a real human agent has taken this conversation over (status agent_handling).
  agentActive: boolean;
}

function isCancel(text: string): boolean {
  return /\b(cancel|never ?mind|menu)\b/i.test(text);
}

// Handle a message classified into an intent from the main menu (or rerouted from a
// sub-flow). Mutates `session` for the resulting mode/state and returns the reply text.
function handleIntent(session: SessionState, text: string, u: Understanding): string {
  switch (u.intent) {
    case "greeting":
      session.mode = "main";
      session.consecutiveFallbacks = 0;
      return greetingReply();

    case "human_handoff":
      session.mode = "live_agent";
      session.consecutiveFallbacks = 0;
      session.liveAgentPings = 0;
      return handoffReply();

    case "order_tracking": {
      session.consecutiveFallbacks = 0;
      const orderNumber = u.orderNumber ?? extractOrderNumber(text) ?? undefined;
      if (orderNumber) {
        session.mode = "main";
        return orderStatusReply(orderNumber);
      }
      session.mode = "awaiting_order_number";
      session.orderPromptRetries = 0;
      return askForOrderNumberReply();
    }

    case "returns":
      session.mode = "main";
      session.consecutiveFallbacks = 0;
      return returnsReply();

    case "shipping":
      session.mode = "main";
      session.consecutiveFallbacks = 0;
      return shippingReply();

    case "recommendation": {
      session.consecutiveFallbacks = 0;
      const activity = u.activity ?? extractActivity(text) ?? undefined;
      if (!activity) {
        session.mode = "recommend_flow";
        session.recommendActivity = undefined;
        return askActivityReply();
      }
      const temperature = u.temperature ?? extractTemperature(text) ?? undefined;
      if (!temperature) {
        session.mode = "recommend_flow";
        session.recommendActivity = activity;
        return askTemperatureReply();
      }
      session.mode = "main";
      session.recommendActivity = undefined;
      return recommendationReply(activity, temperature);
    }

    default: {
      session.consecutiveFallbacks += 1;
      if (session.consecutiveFallbacks >= ESCALATION_THRESHOLD) {
        session.mode = "live_agent";
        session.consecutiveFallbacks = 0;
        session.liveAgentPings = 0;
        return handoffReply();
      }
      session.mode = "main";
      return fallbackReply();
    }
  }
}

function liveAgentTurn(session: SessionState, text: string, ctx: TurnContext): TurnResult {
  if (isBackToBot(text)) {
    session.mode = "main";
    session.consecutiveFallbacks = 0;
    session.liveAgentPings = 0;
    return { reply: greetingReply(), awaitingHuman: false };
  }
  if (ctx.agentActive) {
    // A real human has taken over — deliver the message to them via the agent channel;
    // the bot must not answer on their behalf.
    return { reply: null, awaitingHuman: true };
  }
  // Simulated live agent: acknowledge every message so a lone tester is never stranded,
  // while the conversation stays flagged for a real agent to optionally pick up.
  const pings = (session.liveAgentPings ?? 0) + 1;
  session.liveAgentPings = pings;
  return { reply: liveAgentHoldingReply(pings), awaitingHuman: false };
}

function awaitingOrderTurn(session: SessionState, text: string, u: Understanding): TurnResult {
  // Lenient: once we've explicitly asked, a bare "90" or "#90" can only be the answer.
  const orderNumber = u.orderNumber ?? extractOrderNumber(text, { lenient: true }) ?? undefined;
  if (orderNumber) {
    session.mode = "main";
    session.orderPromptRetries = 0;
    return { reply: orderStatusReply(orderNumber), awaitingHuman: false };
  }
  if (isCancel(text)) {
    session.mode = "main";
    session.orderPromptRetries = 0;
    return { reply: fallbackReply(), awaitingHuman: false };
  }
  if (REROUTABLE_INTENTS.has(u.intent) && u.intent !== "order_tracking") {
    session.mode = "main";
    session.orderPromptRetries = 0;
    return { reply: handleIntent(session, text, u), awaitingHuman: false };
  }
  const retries = (session.orderPromptRetries ?? 0) + 1;
  session.orderPromptRetries = retries;
  const reply =
    retries >= 2
      ? "I'm still not spotting an order number — it's the 3-digit number from your order confirmation email (e.g. #111). If you don't have it handy, just say \"live agent\" and I'll connect you with a human."
      : "I didn't catch an order number there — it's the number on your order confirmation, like #111. What is it?";
  return { reply, awaitingHuman: false };
}

function recommendFlowTurn(session: SessionState, text: string, u: Understanding): TurnResult {
  if (isCancel(text)) {
    session.mode = "main";
    session.recommendActivity = undefined;
    return { reply: fallbackReply(), awaitingHuman: false };
  }

  if (!session.recommendActivity) {
    const activity = u.activity ?? extractActivity(text) ?? undefined;
    if (activity) {
      const temperature = u.temperature ?? extractTemperature(text) ?? undefined;
      if (temperature) {
        // Both slots arrived in one answer — finish the recommendation now.
        session.mode = "main";
        session.recommendActivity = undefined;
        return { reply: recommendationReply(activity, temperature), awaitingHuman: false };
      }
      session.recommendActivity = activity;
      return { reply: askTemperatureReply(), awaitingHuman: false };
    }
    if (REROUTABLE_INTENTS.has(u.intent) && u.intent !== "recommendation") {
      session.mode = "main";
      session.recommendActivity = undefined;
      return { reply: handleIntent(session, text, u), awaitingHuman: false };
    }
    return { reply: askActivityReply(), awaitingHuman: false };
  }

  const temperature = u.temperature ?? extractTemperature(text) ?? undefined;
  if (temperature) {
    const activity = session.recommendActivity;
    session.mode = "main";
    session.recommendActivity = undefined;
    return { reply: recommendationReply(activity, temperature), awaitingHuman: false };
  }
  if (REROUTABLE_INTENTS.has(u.intent) && u.intent !== "recommendation") {
    session.mode = "main";
    session.recommendActivity = undefined;
    return { reply: handleIntent(session, text, u), awaitingHuman: false };
  }
  return { reply: askTemperatureReply(), awaitingHuman: false };
}

// The conversation state machine: given the current session, the raw text, the extracted
// understanding, and turn context, decide the reply and advance `session` in place. Pure
// (no I/O) so the full conversation flow is unit-testable against any store.
export function advance(
  session: SessionState,
  text: string,
  u: Understanding,
  ctx: TurnContext
): TurnResult {
  switch (session.mode) {
    case "live_agent":
      return liveAgentTurn(session, text, ctx);
    case "awaiting_order_number":
      return awaitingOrderTurn(session, text, u);
    case "recommend_flow":
      return recommendFlowTurn(session, text, u);
    default:
      return { reply: handleIntent(session, text, u), awaitingHuman: false };
  }
}
