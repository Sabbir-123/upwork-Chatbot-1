import { describe, expect, it } from "vitest";
import { pickGearRecommendation } from "@upwork-chatbot/shared";
import type { Activity, Temperature } from "@upwork-chatbot/shared";

const EXPECTED: Record<Activity, Record<Temperature, string>> = {
  hiking: { warm: "Hiking Boots", cold: "Insulated Jackets" },
  camping: { warm: "Tents", cold: "Sleeping Bags" },
  winter: { warm: "Backpacks", cold: "Insulated Jackets" },
};

describe("pickGearRecommendation", () => {
  for (const activity of Object.keys(EXPECTED) as Activity[]) {
    for (const temperature of Object.keys(EXPECTED[activity]) as Temperature[]) {
      it(`${activity} + ${temperature} -> ${EXPECTED[activity][temperature]}`, () => {
        const rec = pickGearRecommendation(activity, temperature);
        expect(rec.category).toBe(EXPECTED[activity][temperature]);
      });
    }
  }
});
