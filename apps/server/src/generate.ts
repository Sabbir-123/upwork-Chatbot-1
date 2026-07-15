import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { BRAND_PERSONA_SYSTEM_PROMPT } from "@upwork-chatbot/shared";
import type { ChatMessage } from "@upwork-chatbot/shared";
import type { ReplyGrounding } from "./conversation.js";
import { log, logError } from "./logger.js";

// How many prior turns of context to hand the model. Enough to resolve "the other one" /
// "is that refundable?" without ballooning the prompt.
const HISTORY_TURNS = 8;

const RENDER_SYSTEM_PROMPT = `${BRAND_PERSONA_SYSTEM_PROMPT}

You are writing the bot's next reply to the customer. Rules:
- Use ONLY the facts provided as ground truth. Never invent, alter, or omit an order status, policy, price, date, link, or number. If a fact you'd need isn't provided, don't make one up.
- Write ONLY the message text — no quotation marks, no "Bot:" prefix, no meta commentary.
- Keep it warm, outdoorsy, and concise (usually 1–3 short sentences). Sound like a knowledgeable trail buddy, not a script.
- Use the conversation so far for context (acknowledge what the customer just said, don't re-introduce yourself mid-chat), but stay focused on this turn's goal.
- Preserve any "must include verbatim" items exactly as written.`;

// Map our stored message roles onto the chat roles the model expects. Agent (human) and
// bot messages are both "assistant" from the model's point of view; system stays system.
function toModelRole(role: ChatMessage["role"]): "user" | "assistant" | "system" {
  if (role === "user") return "user";
  if (role === "system") return "system";
  return "assistant"; // assistant + agent
}

function buildTurnPrompt(grounding: ReplyGrounding): string {
  const parts = [`Your goal this turn: ${grounding.goal}`];
  if (grounding.facts) parts.push(`\nFacts (ground truth — do not contradict):\n${grounding.facts}`);
  if (grounding.preserve?.length) {
    parts.push(`\nMust include verbatim: ${grounding.preserve.map((p) => `"${p}"`).join(", ")}`);
  }
  parts.push("\nWrite the reply now.");
  return parts.join("\n");
}

// A rendered reply must still contain every must-preserve string; otherwise the model
// dropped or altered grounded data and we can't trust it.
function preservesFacts(reply: string, grounding: ReplyGrounding): boolean {
  return (grounding.preserve ?? []).every((p) => reply.includes(p));
}

// Render the state machine's grounded decision as natural, context-aware prose. On any
// failure (LLM error, empty output, or dropped grounded data) returns the deterministic
// `fallback` template unchanged — so accuracy and availability never regress.
export async function generateReply(
  sessionId: string,
  params: {
    history: ChatMessage[];
    grounding: ReplyGrounding;
    fallback: string;
  }
): Promise<string> {
  const model = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-5";
  const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });

  const history = params.history
    .filter((m) => m.role !== "system")
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: toModelRole(m.role), content: m.content }));

  // No conversation to render against — nothing to gain over the template.
  if (history.length === 0) return params.fallback;

  log(sessionId, "generate.request", { model, goal: params.grounding.goal });

  try {
    const { text } = await generateText({
      model: openrouter(model),
      // The per-turn goal/facts go in the system prompt so `messages` stays a clean,
      // strictly-alternating conversation history ending on the customer's latest turn.
      system: `${RENDER_SYSTEM_PROMPT}\n\n---\n${buildTurnPrompt(params.grounding)}`,
      messages: history,
      abortSignal: AbortSignal.timeout(10000),
    });

    const reply = text.trim();
    if (!reply) {
      log(sessionId, "generate.empty", { model });
      return params.fallback;
    }
    if (!preservesFacts(reply, params.grounding)) {
      log(sessionId, "generate.dropped_facts", { model, preserve: params.grounding.preserve });
      return params.fallback;
    }
    log(sessionId, "generate.response", { model, reply });
    return reply;
  } catch (err) {
    logError(sessionId, "generate.failed", err, { goal: params.grounding.goal });
    return params.fallback;
  }
}
