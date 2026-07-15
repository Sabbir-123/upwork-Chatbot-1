import type { Activity, Intent, Temperature } from "@upwork-chatbot/shared";
import {
  MENU_OPTIONS,
  RETURN_POLICY,
  SHIPPING_OPTIONS,
  pickGearRecommendation,
} from "@upwork-chatbot/shared";
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
  recommendationFacts,
} from "./handlers/recommendation.js";
import { handoffReply, isBackToBot, liveAgentHoldingReply } from "./handlers/handoff.js";
import { smalltalkReply } from "./handlers/smalltalk.js";
import { outOfScopeReply } from "./handlers/outOfScope.js";

// Only genuinely unintelligible input counts toward this now (smalltalk and out_of_scope
// are handled without incrementing it), so we can afford to be patient before handing off.
const ESCALATION_THRESHOLD = 3;

// Intents a stray sub-flow message can confidently switch to; "fallback" re-prompts instead.
const REROUTABLE_INTENTS: ReadonlySet<Intent> = new Set([
  "returns",
  "shipping",
  "human_handoff",
  "order_tracking",
  "recommendation",
]);

// A structured description of *what* the bot needs to communicate this turn, so the LLM
// path (see generate.ts) can render it in natural, context-aware prose instead of a fixed
// string. The deterministic `reply` template is always the source of the facts and the
// guaranteed fallback — grounding never introduces data the template didn't already have.
export interface ReplyGrounding {
  // The bot's objective for this turn, e.g. "Share the customer's order status."
  goal: string;
  // Ground-truth facts the reply must be built from and must never contradict or invent
  // beyond. Comes from the same hardcoded functions the template uses.
  facts?: string;
  // Substrings that must appear verbatim in the rendered reply (links, order numbers). If
  // the model drops one, generate.ts discards its output and uses the template instead.
  preserve?: string[];
}

// What the pure state machine decided for one turn.
export interface TurnResult {
  // The bot's reply. `null` means "deliver this turn to a real human agent, bot stays
  // silent" — only happens once a human has actually taken the conversation over.
  reply: string | null;
  // True when the reply is null and the customer is waiting on a real human.
  awaitingHuman: boolean;
  // Present for every non-null reply: lets the LLM path re-render the reply naturally.
  // Absent when `reply` is null (nothing for the bot to say).
  grounding?: ReplyGrounding;
}

// One grounded reply: the deterministic text plus how to render it naturally.
interface Grounded {
  reply: string;
  grounding: ReplyGrounding;
}

const MENU_FACTS = `You help with exactly four things: ${MENU_OPTIONS.join(
  ", "
)}. The customer can also ask to talk to a live human agent at any time.`;

function g(reply: string, grounding: ReplyGrounding): Grounded {
  return { reply, grounding };
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
function handleIntent(session: SessionState, text: string, u: Understanding): Grounded {
  switch (u.intent) {
    case "greeting":
      session.mode = "main";
      session.consecutiveFallbacks = 0;
      return g(greetingReply(), {
        goal: "Warmly greet the customer as the North Star Support Bot and invite them to say what they need.",
        facts: MENU_FACTS,
      });

    case "human_handoff":
      session.mode = "live_agent";
      session.consecutiveFallbacks = 0;
      session.liveAgentPings = 0;
      return g(handoffReply(), {
        goal: "Tell the customer you're connecting them to a live human agent (this is simulated) and that they can type menu anytime to return to the bot.",
        preserve: ["menu"],
      });

    case "order_tracking": {
      session.consecutiveFallbacks = 0;
      const orderNumber = u.orderNumber ?? extractOrderNumber(text) ?? undefined;
      if (orderNumber) {
        session.mode = "main";
        const reply = orderStatusReply(orderNumber);
        return g(reply, {
          goal: "Share the customer's order status, exactly as given, then invite any follow-up.",
          facts: reply,
          preserve: [`#${orderNumber}`],
        });
      }
      session.mode = "awaiting_order_number";
      session.orderPromptRetries = 0;
      return g(askForOrderNumberReply(), {
        goal: "Ask the customer for their order number so you can look it up.",
        facts: "Order numbers look like #111 — the 3-digit number from the order confirmation email.",
      });
    }

    case "returns":
      session.mode = "main";
      session.consecutiveFallbacks = 0;
      return g(returnsReply(), {
        goal: "Explain the returns & exchanges policy, then ask if there's anything else you can help with.",
        facts: `${RETURN_POLICY.windowDays}-day returns and exchanges on ${RETURN_POLICY.condition}. Customers start one at ${RETURN_POLICY.link}.`,
        preserve: [RETURN_POLICY.link],
      });

    case "shipping":
      session.mode = "main";
      session.consecutiveFallbacks = 0;
      return g(shippingReply(), {
        goal: "Share the shipping timelines, then ask if there's anything else you can help with.",
        facts: SHIPPING_OPTIONS.map(
          (o) => `${o.name}: ${o.minDays}–${o.maxDays} business days`
        ).join("; "),
      });

    case "recommendation": {
      session.consecutiveFallbacks = 0;
      const activity = u.activity ?? extractActivity(text) ?? undefined;
      if (!activity) {
        session.mode = "recommend_flow";
        session.recommendActivity = undefined;
        return g(askActivityReply(), {
          goal: "Offer to help find gear and ask what kind of adventure they're gearing up for — hiking, camping, or a winter trip.",
        });
      }
      const temperature = u.temperature ?? extractTemperature(text) ?? undefined;
      if (!temperature) {
        session.mode = "recommend_flow";
        session.recommendActivity = activity;
        return g(askTemperatureReply(), {
          goal: `Acknowledge they're gearing up for ${activity}, then ask whether they'll mostly be in warm or cold weather.`,
        });
      }
      session.mode = "main";
      session.recommendActivity = undefined;
      const rec = pickGearRecommendation(activity, temperature);
      return g(recommendationReply(activity, temperature), {
        goal: "Recommend this gear category with the given reason, then ask if there's anything else you can help with.",
        facts: recommendationFacts(activity, temperature),
        preserve: [rec.category],
      });
    }

    case "smalltalk":
      session.mode = "main";
      // Not a failure: leave the fallback counter untouched (neither reset nor bumped) so a
      // friendly aside between two confused messages doesn't derail escalation either way.
      return g(smalltalkReply(), {
        goal: "The customer made small talk or a social remark (a thanks, farewell, compliment, or aside). Reply warmly and briefly in persona, acknowledging what they actually said, then lightly remind them what you can help with. Don't treat it as a support request or an error.",
        facts: MENU_FACTS,
      });

    case "out_of_scope":
      session.mode = "main";
      // A real question we simply have no data for. Don't count it as confusion, but always
      // offer the human exit so the customer is never stuck.
      return g(outOfScopeReply(), {
        goal: "The customer asked something genuine but outside what you have data for (not order tracking, returns, shipping, or recommendations). Warmly acknowledge in persona that you can't help with that specific thing, restate the four things you can do, and offer to connect a live agent. Never invent an answer, policy, price, or fact.",
        facts: MENU_FACTS,
      });

    default: {
      session.consecutiveFallbacks += 1;
      if (session.consecutiveFallbacks >= ESCALATION_THRESHOLD) {
        session.mode = "live_agent";
        session.consecutiveFallbacks = 0;
        session.liveAgentPings = 0;
        return g(handoffReply(), {
          goal: "You couldn't help after a couple of tries — hand off to a live human agent (simulated) and note they can type menu to return to the bot.",
          preserve: ["menu"],
        });
      }
      session.mode = "main";
      return g(fallbackReply(), {
        goal: "You didn't understand the customer's message. Gently say so and steer them to what you can help with; don't guess at an answer.",
        facts: MENU_FACTS,
      });
    }
  }
}

function liveAgentTurn(session: SessionState, text: string, ctx: TurnContext): TurnResult {
  if (isBackToBot(text)) {
    session.mode = "main";
    session.consecutiveFallbacks = 0;
    session.liveAgentPings = 0;
    return {
      reply: greetingReply(),
      awaitingHuman: false,
      grounding: {
        goal: "Welcome the customer back to the bot and remind them what you can help with.",
        facts: MENU_FACTS,
      },
    };
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
  return {
    reply: liveAgentHoldingReply(pings),
    awaitingHuman: false,
    grounding: {
      goal: "Reassure the customer their message is noted and a North Star agent will follow up; remind them they can type menu to return to the bot. Do not answer their question yourself — a human will.",
      preserve: ["menu"],
    },
  };
}

function awaitingOrderTurn(session: SessionState, text: string, u: Understanding): TurnResult {
  // Lenient: once we've explicitly asked, a bare "90" or "#90" can only be the answer.
  const orderNumber = u.orderNumber ?? extractOrderNumber(text, { lenient: true }) ?? undefined;
  if (orderNumber) {
    session.mode = "main";
    session.orderPromptRetries = 0;
    const reply = orderStatusReply(orderNumber);
    return {
      reply,
      awaitingHuman: false,
      grounding: {
        goal: "Share the customer's order status, exactly as given, then invite any follow-up.",
        facts: reply,
        preserve: [`#${orderNumber}`],
      },
    };
  }
  if (isCancel(text)) {
    session.mode = "main";
    session.orderPromptRetries = 0;
    return {
      reply: fallbackReply(),
      awaitingHuman: false,
      grounding: {
        goal: "The customer backed out of order tracking. Acknowledge that and steer them to what else you can help with.",
        facts: MENU_FACTS,
      },
    };
  }
  if (REROUTABLE_INTENTS.has(u.intent) && u.intent !== "order_tracking") {
    session.mode = "main";
    session.orderPromptRetries = 0;
    const { reply, grounding } = handleIntent(session, text, u);
    return { reply, awaitingHuman: false, grounding };
  }
  const retries = (session.orderPromptRetries ?? 0) + 1;
  session.orderPromptRetries = retries;
  const reply =
    retries >= 2
      ? "I'm still not spotting an order number — it's the 3-digit number from your order confirmation email (e.g. #111). If you don't have it handy, just say \"live agent\" and I'll connect you with a human."
      : "I didn't catch an order number there — it's the number on your order confirmation, like #111. What is it?";
  return {
    reply,
    awaitingHuman: false,
    grounding: {
      goal:
        retries >= 2
          ? "You still didn't get an order number. Re-ask patiently and offer a live agent as a way out. Order numbers look like #111."
          : "You didn't catch an order number in the customer's reply. Gently re-ask for it. Order numbers look like #111.",
    },
  };
}

// Build the grounded recommendation reply once both slots are known.
function recommend(activity: Activity, temperature: Temperature): TurnResult {
  const rec = pickGearRecommendation(activity, temperature);
  return {
    reply: recommendationReply(activity, temperature),
    awaitingHuman: false,
    grounding: {
      goal: "Recommend this gear category with the given reason, then ask if there's anything else you can help with.",
      facts: recommendationFacts(activity, temperature),
      preserve: [rec.category],
    },
  };
}

const ASK_ACTIVITY_GROUNDING: ReplyGrounding = {
  goal: "Ask what kind of adventure the customer is gearing up for — hiking, camping, or a winter trip.",
};

function askTemperatureTurn(activity: Activity): TurnResult {
  return {
    reply: askTemperatureReply(),
    awaitingHuman: false,
    grounding: {
      goal: `Acknowledge they're gearing up for ${activity}, then ask whether they'll mostly be in warm or cold weather.`,
    },
  };
}

function recommendFlowTurn(session: SessionState, text: string, u: Understanding): TurnResult {
  if (isCancel(text)) {
    session.mode = "main";
    session.recommendActivity = undefined;
    return {
      reply: fallbackReply(),
      awaitingHuman: false,
      grounding: {
        goal: "The customer backed out of the recommendation flow. Acknowledge that and steer them to what else you can help with.",
        facts: MENU_FACTS,
      },
    };
  }

  if (!session.recommendActivity) {
    const activity = u.activity ?? extractActivity(text) ?? undefined;
    if (activity) {
      const temperature = u.temperature ?? extractTemperature(text) ?? undefined;
      if (temperature) {
        // Both slots arrived in one answer — finish the recommendation now.
        session.mode = "main";
        session.recommendActivity = undefined;
        return recommend(activity, temperature);
      }
      session.recommendActivity = activity;
      return askTemperatureTurn(activity);
    }
    if (REROUTABLE_INTENTS.has(u.intent) && u.intent !== "recommendation") {
      session.mode = "main";
      session.recommendActivity = undefined;
      const { reply, grounding } = handleIntent(session, text, u);
      return { reply, awaitingHuman: false, grounding };
    }
    return { reply: askActivityReply(), awaitingHuman: false, grounding: ASK_ACTIVITY_GROUNDING };
  }

  const temperature = u.temperature ?? extractTemperature(text) ?? undefined;
  if (temperature) {
    const activity = session.recommendActivity;
    session.mode = "main";
    session.recommendActivity = undefined;
    return recommend(activity, temperature);
  }
  if (REROUTABLE_INTENTS.has(u.intent) && u.intent !== "recommendation") {
    session.mode = "main";
    session.recommendActivity = undefined;
    const { reply, grounding } = handleIntent(session, text, u);
    return { reply, awaitingHuman: false, grounding };
  }
  return askTemperatureTurn(session.recommendActivity);
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
    default: {
      const { reply, grounding } = handleIntent(session, text, u);
      return { reply, awaitingHuman: false, grounding };
    }
  }
}
