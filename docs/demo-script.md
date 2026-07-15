# Video Demo Script (2–3 minutes)

A tight walkthrough that shows **all four required use cases plus a fallback**. Run
`pnpm install && pnpm dev` and open `http://localhost:5173` (rule-based mode, no key needed),
or use the hosted demo URL to show the AI brain. Type the **bold** lines; the notes say what to
point out.

---

**0:00 — Intro (10s).** "This is the North Star Support Bot — a customer-support assistant for an
outdoor-gear store. It runs fully offline with no API key, and there's also a hosted version on the
real LLM. Everything grounded — order status, policies, shipping — comes from fixed data, not the model."

**0:10 — Greeting & discoverability (15s).** Type **`hi`**.
→ Point out the persona intro and the four things it can help with. Note the **quick-reply chips** above
the composer — "these make every capability one click, and they're what I'll use to move through the demo."

**0:25 — Use case 1: Order tracking, exact mock data (30s).**
- Type **`where is my order?`** → it asks for the number.
- Type **`#111`** → **"Order #111: Shipped, arriving tomorrow."**
- Type **`track #333`** → **"Order #333: Delivered…"** — "note it pulled the number and the status in one turn."
- Type **`#404`** → graceful "couldn't find order #404" — "invalid orders fail cleanly, no dead end."

**0:55 — Use case 2: Returns & exchanges (15s).** Type **`how do I return something?`**
→ 30-day / unused / original-packaging policy **and the returns link**.

**1:10 — Use case 3: Shipping info (10s).** Type **`how long does shipping take?`**
→ Standard 3–5 business days, Expedited 1–2 business days.

**1:20 — Use case 4: Product recommendations, guided (30s).**
- Type **`can you recommend some gear?`** → asks the activity (clarifying question 1).
- Type **`camping`** → asks warm or cold (clarifying question 2).
- Type **`cold`** → recommends **Sleeping Bags** with a reason. "Two clarifying questions, then a category."

**1:50 — Fallback that never dead-ends (15s).** Type **`do you sell kayaks?`**
→ "I didn't quite get that" + the menu + a live-agent offer. "It always offers a way forward."

**2:05 — Human handoff + return to menu (30s).**
- Type **`I'd like to talk to a live agent`** → clearly announces the (simulated) handoff.
- Type **`are you there?`** → "notice the agent **acknowledges** — you're never left on silence, and it's
  flagged for a real human in the `/agent` inbox." *(Optional: show `/agent` in a second tab replying live.)*
- Type **`menu`** → back to the bot's main menu. "And you can pick right back up." Type **`where is my order?`**
  to prove the bot resumed.

**2:35 — Close (10s).** "Same flows work on the hosted LLM version with more natural phrasing. All four use
cases, fallback, exact order data, and handoff-with-return — covered. Thanks."

---

### If demoing the AI brain
Flip the header toggle to **AI (LLM)** (hosted demo, or local with a key) and show a hard paraphrase in one
line — e.g. **`the boots I ordered, order two twenty two, where are they?`** → resolves straight to
`Order #222`, demonstrating intent + order-number extraction in a single turn.
