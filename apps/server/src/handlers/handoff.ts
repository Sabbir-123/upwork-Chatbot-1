export function handoffReply(): string {
  return "Connecting you to a live agent… 🧑‍💼 You're now chatting with a North Star human agent (simulated).\n\nType `menu` anytime to return to the bot.";
}

// Sent while we're simulating a live agent and no real human has taken over yet, so a
// customer testing alone always gets an acknowledgement (never silence) and is reminded
// they can return to the bot. Varied by ping count to avoid a robotic repeated line.
export function liveAgentHoldingReply(pings: number): string {
  if (pings <= 1) {
    return "Thanks for your patience — I've flagged your conversation for the next available North Star agent. 🧑‍💼\n\nYou can keep chatting here, or type `menu` anytime to head back to the bot.";
  }
  return "Got it — a North Star agent will follow up on this. 🧑‍💼 In the meantime, I've noted your message.\n\nType `menu` whenever you'd like to return to the bot.";
}

export function isBackToBot(text: string): boolean {
  return /\b(menu|back to bot|main menu)\b/i.test(text);
}
