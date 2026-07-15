import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { stream } from "hono/streaming";
import type { ChatMessage } from "@upwork-chatbot/shared";
import { understand, llmAvailable } from "./router.js";
import { getStore } from "./store.js";
import { getEventBus } from "./events.js";
import { openSse } from "./sse.js";
import { log } from "./logger.js";
import { greetingReply } from "./handlers/greeting.js";
import { advance } from "./conversation.js";
import { generateReply } from "./generate.js";

const store = getStore();
const bus = getEventBus();

const app = new Hono();

app.use("/api/*", cors());

app.get("/api/health", (c) => c.json({ ok: true }));

// Tells the client whether the AI (LLM) mode can be offered in the toggle.
app.get("/api/config", (c) => c.json({ llmAvailable: llmAvailable() }));

function makeMessage(role: ChatMessage["role"], content: string): ChatMessage {
  return { id: randomUUID(), role, content, createdAt: Date.now() };
}

async function persist(convId: string, message: ChatMessage, audience: "agent" | "both"): Promise<void> {
  await store.appendMessage(convId, message);
  await bus.publish(convId, message, audience);
}

app.post("/api/chat", async (c) => {
  const requestStart = performance.now();
  const body = await c.req.json<{ messages: ChatMessage[]; sessionId?: string; mode?: "mock" | "llm" }>();
  const sessionId = body.sessionId ?? "default";
  const session = await store.loadSession(sessionId);
  const modeAtStart = session.mode;
  // Per-request brain: the client toggle picks "llm" or "mock"; llmAvailable() gates it.
  const useLlm = body.mode === "llm" && llmAvailable();

  const lastUserMessage = [...(body.messages ?? [])]
    .reverse()
    .find((m) => m.role === "user");

  log(sessionId, "request.received", {
    mode: modeAtStart,
    brain: useLlm ? "llm" : "mock",
    messageCount: body.messages?.length ?? 0,
    text: lastUserMessage?.content ?? "",
  });

  let reply: string | null;
  let awaitingHuman = false;

  if (!lastUserMessage) {
    reply = "Say something!";
    log(sessionId, "request.empty", {});
  } else {
    const text = lastUserMessage.content;
    await persist(sessionId, makeMessage("user", text), "agent");

    const modeBefore = session.mode;
    const u = await understand(sessionId, text, useLlm);
    // A real human only owns the conversation once they've replied/taken over
    // (status "agent_handling"); until then we simulate the live agent so a lone
    // tester is never left waiting on silence.
    const metaNow = await store.getMeta(sessionId);
    const result = advance(session, text, u, { agentActive: metaNow.status === "agent_handling" });
    reply = result.reply;
    awaitingHuman = result.awaitingHuman;

    // AI mode: the state machine decided *what* to say (and the grounded facts); let the
    // LLM render *how*, using recent history for context. Any failure returns the template.
    //
    // Exception: in live_agent mode the reply *is* the simulated human handoff/holding
    // message ("a North Star agent will follow up"). The LLM's persona is the bot itself,
    // so rendering here makes it answer as the bot — overriding the handoff and stranding
    // the customer with an AI reply. Keep those deterministic so the simulated agent shows
    // through. (The back-to-bot greeting sets mode to "main" in advance(), so it still
    // renders naturally.)
    if (useLlm && reply !== null && result.grounding && session.mode !== "live_agent") {
      reply = await generateReply(sessionId, {
        history: body.messages ?? [],
        grounding: result.grounding,
        fallback: reply,
      });
    }

    log(sessionId, "conversation.turn", {
      text,
      intent: u.intent,
      orderNumber: u.orderNumber ?? null,
      activity: u.activity ?? null,
      temperature: u.temperature ?? null,
      modeBefore,
      modeAfter: session.mode,
      awaitingHuman,
    });
  }

  await store.saveSession(sessionId, session);

  if (awaitingHuman) {
    const meta = await store.getMeta(sessionId);
    const alreadyHandled = meta.status === "agent_handling";
    await store.setMeta(sessionId, {
      status: alreadyHandled ? "agent_handling" : "waiting_agent",
      needsHuman: !alreadyHandled,
      updatedAt: Date.now(),
    });
    await bus.publishConversationChange(sessionId);
    c.header("X-Session-Mode", session.mode);
    log(sessionId, "reply.awaiting_human", { mode: session.mode });
    return c.body(null, 204);
  }

  if (reply !== null) {
    await persist(sessionId, makeMessage("assistant", reply), "agent");
    await store.setMeta(sessionId, {
      status: session.mode === "live_agent" ? "waiting_agent" : "bot",
      needsHuman: session.mode === "live_agent",
      updatedAt: Date.now(),
    });
    await bus.publishConversationChange(sessionId);
  }

  log(sessionId, "reply.ready", { mode: session.mode, reply, elapsedMs: Math.round(performance.now() - requestStart) });

  c.header("X-Session-Mode", session.mode);

  const finalReply = reply ?? "";
  return stream(c, async (s) => {
    const streamStart = performance.now();
    const words = finalReply.split(" ");
    for (const [i, word] of words.entries()) {
      await s.write(i === words.length - 1 ? word : `${word} `);
      if (useLlm) await s.sleep(20);
    }
    log(sessionId, "stream.complete", { wordCount: words.length, streamMs: Math.round(performance.now() - streamStart) });
  });
});

// Customer-facing SSE: only forwards messages meant to reach the customer out-of-band
// (human agent replies, system notices, the release-to-bot greeting).
app.get("/api/conversations/:id/stream", (c) => {
  const convId = c.req.param("id");
  return openSse(c, (push) => {
    return bus.subscribe(convId, (event) => {
      if (event.audience !== "both") return;
      push({ event: "message", data: event.message });
      if (event.mode) push({ event: "mode", data: { mode: event.mode } });
    });
  });
});

// --- Agent-facing routes ---

app.get("/api/agent/conversations", async (c) => {
  const conversations = await store.listConversations();
  return c.json({ conversations });
});

app.get("/api/agent/stream", (c) => {
  return openSse(c, (push) => {
    return bus.subscribeConversationChanges(async (convId) => {
      const conversation = await store.getConversation(convId);
      push({ event: "conversation", data: conversation });
    });
  });
});

app.get("/api/agent/conversations/:id", async (c) => {
  const convId = c.req.param("id");
  const [messages, meta] = await Promise.all([store.getMessages(convId), store.getMeta(convId)]);
  return c.json({
    id: convId,
    messages,
    status: meta.status,
    needsHuman: meta.needsHuman,
  });
});

app.get("/api/agent/conversations/:id/stream", (c) => {
  const convId = c.req.param("id");
  return openSse(c, (push) => {
    return bus.subscribe(convId, (event) => {
      push({ event: "message", data: event.message });
    });
  });
});

app.post("/api/agent/conversations/:id/reply", async (c) => {
  const convId = c.req.param("id");
  const body = await c.req.json<{ text: string }>();
  const text = (body.text ?? "").trim();
  if (!text) return c.json({ error: "text is required" }, 400);

  const session = await store.loadSession(convId);
  const wasLiveAgent = session.mode === "live_agent";
  session.mode = "live_agent";
  session.consecutiveFallbacks = 0;
  await store.saveSession(convId, session);

  const message = makeMessage("agent", text);
  await store.appendMessage(convId, message);
  await bus.publish(convId, message, "both", wasLiveAgent ? undefined : "live_agent");
  await store.setMeta(convId, { status: "agent_handling", needsHuman: false, updatedAt: Date.now() });
  await bus.publishConversationChange(convId);

  log(convId, "agent.reply", { text });
  return c.json({ message });
});

app.post("/api/agent/conversations/:id/takeover", async (c) => {
  const convId = c.req.param("id");
  const session = await store.loadSession(convId);
  const wasLiveAgent = session.mode === "live_agent";
  session.mode = "live_agent";
  session.consecutiveFallbacks = 0;
  await store.saveSession(convId, session);
  await store.setMeta(convId, { status: "agent_handling", needsHuman: false, updatedAt: Date.now() });
  await bus.publishConversationChange(convId);

  if (!wasLiveAgent) {
    const notice = makeMessage("system", "🧑‍💼 A human agent has joined the conversation.");
    await store.appendMessage(convId, notice);
    await bus.publish(convId, notice, "both", "live_agent");
  }

  log(convId, "agent.takeover", {});
  return c.json({ ok: true });
});

app.post("/api/agent/conversations/:id/release", async (c) => {
  const convId = c.req.param("id");
  const session = await store.loadSession(convId);
  session.mode = "main";
  session.consecutiveFallbacks = 0;
  await store.saveSession(convId, session);
  await store.setMeta(convId, { status: "bot", needsHuman: false, updatedAt: Date.now() });
  await bus.publishConversationChange(convId);

  const notice = makeMessage("system", "You're back with the North Star bot.");
  await store.appendMessage(convId, notice);
  await bus.publish(convId, notice, "both", "main");

  const greeting = makeMessage("assistant", greetingReply());
  await store.appendMessage(convId, greeting);
  await bus.publish(convId, greeting, "both");

  log(convId, "agent.release", {});
  return c.json({ ok: true });
});

// Serves the built React app (apps/web/dist) as static files, produced by `vite build`.
// Absent in local dev (the Vite dev server handles the frontend there instead).
app.use("*", serveStatic({ root: "../web/dist" }));
app.get("*", serveStatic({ root: "../web/dist", path: "index.html" }));

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Server listening on http://localhost:${info.port}`);
});
