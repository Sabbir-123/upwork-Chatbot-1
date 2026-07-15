import { describe, expect, it } from "vitest";
import { understand } from "./router.js";

// The deterministic (no-key) understanding path: intent + slot extraction in one shot.
// useLlm=false so no network is touched — this is what evaluators exercise locally.
describe("understand (mock brain) — slot extraction", () => {
  it("pulls the order number out of the same message as the intent", async () => {
    const u = await understand("test", "can you track order #222 for me", false);
    expect(u.intent).toBe("order_tracking");
    expect(u.orderNumber).toBe("222");
  });

  it("treats a #-prefixed number as an order reference at any length", async () => {
    expect((await understand("test", "#90", false)).orderNumber).toBe("90");
  });

  it("leaves the order number empty when none is given", async () => {
    expect((await understand("test", "where is my order?", false)).orderNumber).toBeUndefined();
  });

  it("pulls both recommendation slots from one utterance", async () => {
    const u = await understand("test", "recommend hiking gear for cold weather", false);
    expect(u.intent).toBe("recommendation");
    expect(u.activity).toBe("hiking");
    expect(u.temperature).toBe("cold");
  });
});
