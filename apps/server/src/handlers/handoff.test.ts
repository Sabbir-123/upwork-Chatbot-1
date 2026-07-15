import { describe, expect, it } from "vitest";
import { isBackToBot } from "./handoff.js";

describe("isBackToBot", () => {
  it.each(["menu", "back to bot", "main menu", "Menu", "take me to the main menu"])(
    "returns true for %j",
    (text) => {
      expect(isBackToBot(text)).toBe(true);
    }
  );

  it.each(["hello", "I want a refund", "asdkjaslkdj", ""])("returns false for %j", (text) => {
    expect(isBackToBot(text)).toBe(false);
  });
});
