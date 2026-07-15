import { describe, expect, it } from "vitest";
import { extractOrderNumber, orderStatusReply } from "./orderTracking.js";

describe("extractOrderNumber", () => {
  it("extracts a number from a #-prefixed order", () => {
    expect(extractOrderNumber("#111")).toBe("111");
  });

  it("extracts a number from 'order 222'", () => {
    expect(extractOrderNumber("order 222")).toBe("222");
  });

  it("extracts a number from a sentence", () => {
    expect(extractOrderNumber("it's 333 please")).toBe("333");
  });

  it("returns null when no number is present", () => {
    expect(extractOrderNumber("where is my order")).toBeNull();
  });

  it("ignores bare sub-3-digit numbers in open conversation", () => {
    expect(extractOrderNumber("i have 2 questions")).toBeNull();
  });

  it("accepts a #-prefixed number at any length (unambiguous order reference)", () => {
    expect(extractOrderNumber("#90")).toBe("90");
  });

  it("accepts a bare short number when leniently asking for the order number", () => {
    expect(extractOrderNumber("90", { lenient: true })).toBe("90");
  });
});

describe("orderStatusReply (exact seed data)", () => {
  it("returns the exact status for #111", () => {
    expect(orderStatusReply("111")).toBe("Order #111: Shipped, arriving tomorrow.");
  });

  it("returns the exact status for #222", () => {
    expect(orderStatusReply("222")).toBe("Order #222: Processing, ships in 24 hours.");
  });

  it("returns the exact status + follow-up for #333", () => {
    expect(orderStatusReply("333")).toBe(
      "Order #333: Delivered. Anything else about this delivery — a return or exchange?"
    );
  });

  it("returns the invalid-order message for an unknown order", () => {
    expect(orderStatusReply("999")).toBe(
      "Hmm, I couldn't find an order with number #999. Want to try another order number, or I can connect you with a live agent."
    );
  });
});
