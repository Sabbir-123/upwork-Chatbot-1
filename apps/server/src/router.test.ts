import { describe, expect, it } from "vitest";
import { classifyIntent } from "./router.js";

const CASES: Array<[string, string]> = [
  // greeting
  ["hi", "greeting"],
  ["hello there", "greeting"],
  ["hey!", "greeting"],
  ["good morning", "greeting"],
  ["yo", "greeting"],
  ["what's up", "greeting"],
  ["sup bot", "greeting"],
  // order_tracking
  ["Where is my order?", "order_tracking"],
  ["Track my package", "order_tracking"],
  ["order status", "order_tracking"],
  ["wheres #111", "order_tracking"],
  ["can you check on my shipment", "order_tracking"],
  ["I want to track order #222", "order_tracking"],
  ["has my order shipped yet", "order_tracking"],
  // newly added order_tracking synonyms (previously-failing cases)
  ["where is my stuff?", "order_tracking"],
  ["hasn't arrived yet", "order_tracking"],
  ["still waiting", "order_tracking"],
  ["lost package", "order_tracking"],
  ["it didn't arrive", "order_tracking"],
  ["my order hasn't arrived", "order_tracking"],
  // returns
  ["how do I return", "returns"],
  ["refund", "returns"],
  ["exchange", "returns"],
  ["your return policy", "returns"],
  ["I want to send this back", "returns"],
  ["can I get my money back", "returns"],
  ["how do exchanges work", "returns"],
  ["wrong size", "returns"],
  ["it doesn't fit", "returns"],
  ["still waiting on my refund", "returns"],
  // shipping
  ["how long is shipping", "shipping"],
  ["when will it arrive", "shipping"],
  ["delivery time", "shipping"],
  ["how fast is standard shipping", "shipping"],
  ["what are your shipping options", "shipping"],
  ["when does expedited arrive", "shipping"],
  ["how long", "shipping"],
  ["when will it ship", "shipping"],
  // recommendation
  ["recommend something", "recommendation"],
  ["what jacket should I buy", "recommendation"],
  ["I need gear for camping", "recommendation"],
  ["what should I get for hiking", "recommendation"],
  ["looking for a tent", "recommendation"],
  ["suggest something for winter trips", "recommendation"],
  ["I need some gear", "recommendation"],
  // human_handoff
  ["talk to a person", "human_handoff"],
  ["live agent", "human_handoff"],
  ["representative", "human_handoff"],
  ["I want a human", "human_handoff"],
  ["can I speak with someone real", "human_handoff"],
  ["connect me to support staff", "human_handoff"],
  ["let me talk to an agent", "human_handoff"],
  // help / menu — a bare ask for help routes to the warm menu, not the fallback apology,
  // while a specific ask that merely contains "help" still wins its own intent.
  ["help", "greeting"],
  ["i need help", "greeting"],
  ["menu", "greeting"],
  ["what can you do", "greeting"],
  ["what can you help with", "greeting"],
  ["help me return this", "returns"],
  // fallback
  ["asdkjaslkdj", "fallback"],
  ["what's the meaning of life", "fallback"],
  ["do you sell cars", "fallback"],
  ["blah blah nonsense", "fallback"],
  ["12345", "fallback"],
  ["tell me a joke", "fallback"],
  ["how long have you been open", "fallback"],
];

describe("classifyIntent (mock mode)", () => {
  for (const [message, expected] of CASES) {
    it(`"${message}" -> ${expected}`, async () => {
      // useLlm=false exercises the deterministic mock classifier directly.
      const intent = await classifyIntent("test-session", message, false);
      expect(intent).toBe(expected);
    });
  }
});
