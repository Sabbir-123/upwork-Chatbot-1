import { pickGearRecommendation, type Activity, type Temperature } from "@upwork-chatbot/shared";

export function extractActivity(text: string): Activity | null {
  if (/\bhik/i.test(text)) return "hiking";
  if (/\bcamp/i.test(text)) return "camping";
  if (/\b(winter|snow)\b/i.test(text)) return "winter";
  return null;
}

export function extractTemperature(text: string): Temperature | null {
  if (/\b(warm|hot|summer)\b/i.test(text)) return "warm";
  if (/\b(cold|freez|chilly|winter|snow)\b/i.test(text)) return "cold";
  return null;
}

export function askActivityReply(): string {
  return "I'd love to help you find the right gear! What kind of adventure are you gearing up for — hiking, camping, or a winter trip?";
}

export function askTemperatureReply(): string {
  return "Got it! Will you mostly be out in warm weather or cold?";
}

/** Grounding facts for the LLM path: the category, reason, and concrete SKUs to cite. */
export function recommendationFacts(activity: Activity, temperature: Temperature): string {
  const rec = pickGearRecommendation(activity, temperature);
  const products = rec.products
    .slice(0, 2)
    .map((p) => `${p.name} ($${p.price}) — ${p.blurb}`)
    .join("; ");
  const catalogLine = products ? ` Suggested products: ${products}.` : "";
  return `For ${activity} in ${temperature} weather, recommend: ${rec.category}. Reason: ${rec.justification}${catalogLine}`;
}

export function recommendationReply(activity: Activity, temperature: Temperature): string {
  const rec = pickGearRecommendation(activity, temperature);
  const top = rec.products.slice(0, 2);

  let reply = `I'd recommend checking out our ${rec.category}. ${rec.justification}`;

  if (top.length > 0) {
    const picks = top
      .map((p) => `• **${p.name}** ($${p.price}) — ${p.blurb}`)
      .join("\n");
    reply += `\n\nA couple of picks for you:\n${picks}`;
  }

  return `${reply}\n\nAnything else I can help with?`;
}
