import { describe, expect, it } from "vitest";
import { getStore } from "./store.js";

describe("store (in-memory fallback)", () => {
  it("round-trips messages in append order", async () => {
    const store = getStore();
    const id = `conv-${Math.random()}`;

    await store.appendMessage(id, { id: "1", role: "user", content: "hi" });
    await store.appendMessage(id, { id: "2", role: "assistant", content: "hello" });

    const messages = await store.getMessages(id);
    expect(messages.map((m) => m.content)).toEqual(["hi", "hello"]);
  });

  it("round-trips session state", async () => {
    const store = getStore();
    const id = `conv-${Math.random()}`;

    expect(await store.loadSession(id)).toEqual({ mode: "main", consecutiveFallbacks: 0 });

    await store.saveSession(id, { mode: "recommend_flow", recommendActivity: "hiking", consecutiveFallbacks: 1 });
    expect(await store.loadSession(id)).toEqual({
      mode: "recommend_flow",
      recommendActivity: "hiking",
      consecutiveFallbacks: 1,
    });
  });

  it("lists conversations with needs-human first, then most recent", async () => {
    const store = getStore();
    const a = `conv-${Math.random()}`;
    const b = `conv-${Math.random()}`;
    const c = `conv-${Math.random()}`;

    await store.appendMessage(a, { id: "1", role: "user", content: "a", createdAt: 1000 });
    await store.appendMessage(b, { id: "1", role: "user", content: "b", createdAt: 2000 });
    await store.appendMessage(c, { id: "1", role: "user", content: "c", createdAt: 3000 });
    await store.setMeta(b, { needsHuman: true });

    const list = await store.listConversations();
    const relevant = list.filter((conv) => [a, b, c].includes(conv.id));
    expect(relevant.map((conv) => conv.id)).toEqual([b, c, a]);
  });
});
