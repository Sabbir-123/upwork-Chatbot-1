import { describe, expect, it } from "vitest";
import { advance, type TurnContext, type TurnResult } from "./conversation.js";
import { understand } from "./router.js";
import type { SessionState } from "./store.js";

// Drives one turn end-to-end through the deterministic pipeline: raw text -> understanding
// (mock brain, no network) -> state machine. Mirrors exactly what the /api/chat route does,
// so these assert the real conversation flows a no-key evaluator will experience.
async function turn(
  session: SessionState,
  text: string,
  ctx: TurnContext = { agentActive: false }
): Promise<TurnResult> {
  const u = await understand("test", text, false);
  return advance(session, text, u, ctx);
}

function freshSession(): SessionState {
  return { mode: "main", consecutiveFallbacks: 0 };
}

describe("order tracking flow", () => {
  it("asks for the number, then returns the exact mock status", async () => {
    const s = freshSession();
    const ask = await turn(s, "where is my order?");
    expect(ask.reply).toContain("order number");
    expect(s.mode).toBe("awaiting_order_number");

    const status = await turn(s, "111");
    expect(status.reply).toBe("Order #111: Shipped, arriving tomorrow.");
    expect(s.mode).toBe("main");
  });

  it("returns the exact status for each seed order in one message", async () => {
    expect((await turn(freshSession(), "track #222")).reply).toBe(
      "Order #222: Processing, ships in 24 hours."
    );
    expect((await turn(freshSession(), "where's order #333")).reply).toBe(
      "Order #333: Delivered. Anything else about this delivery — a return or exchange?"
    );
  });

  it("treats any other order as invalid (gracefully, not a broken record)", async () => {
    const s = freshSession();
    await turn(s, "where is my order?");
    const res = await turn(s, "#90");
    expect(res.reply).toContain("couldn't find an order with number #90");
    expect(s.mode).toBe("main");
  });

  it("escalates the re-prompt after repeated non-answers", async () => {
    const s = freshSession();
    await turn(s, "where is my order?");
    const first = await turn(s, "no idea");
    expect(first.reply).toContain("What is it?");
    const second = await turn(s, "still no idea");
    expect(second.reply).toContain("live agent");
    expect(s.mode).toBe("awaiting_order_number");
  });

  it("lets the user switch topics out of the order flow", async () => {
    const s = freshSession();
    await turn(s, "where is my order?");
    const res = await turn(s, "actually what's your return policy?");
    expect(res.reply).toContain("30-day returns");
    expect(s.mode).toBe("main");
  });
});

describe("returns & shipping", () => {
  it("returns the policy with the link", async () => {
    const res = await turn(freshSession(), "how do I return this?");
    expect(res.reply).toContain("30-day returns");
    expect(res.reply).toContain("https://northstar.example/returns");
  });

  it("returns both shipping speeds", async () => {
    const res = await turn(freshSession(), "how long is shipping?");
    expect(res.reply).toContain("3–5 business days");
    expect(res.reply).toContain("1–2 business days");
  });
});

describe("product recommendation flow", () => {
  it("asks two clarifying questions, then recommends a category", async () => {
    const s = freshSession();
    const q1 = await turn(s, "can you recommend some gear?");
    expect(q1.reply).toContain("hiking, camping, or a winter trip");
    expect(s.mode).toBe("recommend_flow");

    const q2 = await turn(s, "hiking");
    expect(q2.reply).toContain("warm weather or cold");

    const rec = await turn(s, "cold");
    expect(rec.reply).toContain("Insulated Jackets");
    expect(s.mode).toBe("main");
  });

  it("recommends in one turn when both slots are present", async () => {
    const s = freshSession();
    const rec = await turn(s, "what should I get for camping in the cold?");
    expect(rec.reply).toContain("Sleeping Bags");
    expect(s.mode).toBe("main");
  });
});

describe("human handoff & fallback", () => {
  it("hands off on explicit request and can return to the bot via menu", async () => {
    const s = freshSession();
    const handoff = await turn(s, "I want to talk to a human");
    expect(handoff.reply).toContain("live agent");
    expect(s.mode).toBe("live_agent");

    const back = await turn(s, "menu");
    expect(s.mode).toBe("main");
    expect(back.reply).toContain("I can help you with");
  });

  it("acknowledges (never goes silent) while simulating the agent", async () => {
    const s = freshSession();
    await turn(s, "get me a live agent");
    const ack = await turn(s, "are you there?", { agentActive: false });
    expect(ack.awaitingHuman).toBe(false);
    expect(ack.reply).toContain("agent");
    expect(ack.reply).toContain("menu");
  });

  it("stays silent and defers to a real human once one has taken over", async () => {
    const s = freshSession();
    await turn(s, "get me a live agent");
    const res = await turn(s, "hello?", { agentActive: true });
    expect(res.reply).toBeNull();
    expect(res.awaitingHuman).toBe(true);
  });

  it("escalates to a live agent after repeated unintelligible input", async () => {
    const s = freshSession();
    const first = await turn(s, "asdkjaslkdj");
    expect(first.reply).toContain("didn't quite get that");
    expect(s.mode).toBe("main");

    await turn(s, "blah blah nonsense");
    expect(s.mode).toBe("main");

    const third = await turn(s, "kdjf lkjdf");
    expect(s.mode).toBe("live_agent");
    expect(third.reply).toContain("live agent");
  });

  it("answers social chit-chat warmly without counting it as a failure", async () => {
    const s = freshSession();
    const res = await turn(s, "thanks so much!");
    expect(s.mode).toBe("main");
    expect(s.consecutiveFallbacks).toBe(0);
    // A thanks between confused messages must not nudge the user toward a handoff.
    expect(res.awaitingHuman).toBe(false);
  });

  it("deflects a real but unanswerable question and offers a human", async () => {
    const s = freshSession();
    const res = await turn(s, "do you ship to Canada?");
    expect(s.mode).toBe("main");
    expect(s.consecutiveFallbacks).toBe(0);
    expect(res.reply).toContain("live agent");
  });
});
