# Test Plan

Manual test script for reviewing the North Star Support Bot. Run `pnpm install && pnpm dev`
(no `.env` needed — mock mode is the default) and open `http://localhost:5173`. Each step below
lists what to type and the exact expected output.

## 1. Greeting

| You type | Expected reply |
|---|---|
| `hi` | Persona intro naming the 4 things it can help with (track an order, returns & exchanges, shipping info, product recommendations) + mention of live agent. |

## 2. Order tracking (exact mock data)

| You type | Expected reply |
|---|---|
| `where is my order` | Asks for an order number, e.g. "Sure, I can help track that! What's your order number? (e.g. #111)" |
| `#111` | `Order #111: Shipped, arriving tomorrow.` |
| `track #222` (number given up front) | `Order #222: Processing, ships in 24 hours.` (resolved in one turn) |
| `where is my order` → `#333` | `Order #333: Delivered. Anything else about this delivery — a return or exchange?` |
| `where is my order` → `#999` | `Hmm, I couldn't find an order with number #999. Want to try another order number, or I can connect you with a live agent.` |
| `where is my order` → `90` / `#90` | Same graceful "couldn't find #90" — a short or hash-prefixed number given in answer to the prompt is accepted and looked up (not rejected as "not a number"). |
| `where is my order` → `no idea` → `still nothing` | The re-prompt **escalates** on the 2nd miss and offers a live agent, instead of repeating one line. |

After each resolved lookup, the session returns to the main menu (`mode: "main"`).

## 3. Returns & exchanges

| You type | Expected reply |
|---|---|
| `how do I return this` | States the 30-day / unused / original-packaging policy and the returns link `https://northstar.example/returns`, then "Anything else I can help with?" |

## 4. Shipping info

| You type | Expected reply |
|---|---|
| `how long is shipping` | Lists `Standard: 3–5 business days` and `Expedited: 1–2 business days`, then "Anything else I can help with?" |

## 5. Product recommendations (guided multi-turn)

| You type | Expected reply |
|---|---|
| `recommend something` | Asks which activity — hiking, camping, or winter trip. |
| `camping` | Asks warm weather or cold. |
| `cold` | Recommends **Sleeping Bags** with a short justification, then "Anything else I can help with?" |

Try `hiking` + `warm` → **Hiking Boots**; `winter` + `cold` → **Insulated Jackets**; to confirm the category
map covers all combinations.

## 6. Fallback (never a dead end)

| You type | Expected reply |
|---|---|
| `do you sell cars` | "Hmm, I didn't quite get that 🤔" + the 4 menu options + "talk to a live agent" offer. |
| *(a second unrelated message right after)* | Auto-escalates to the live agent (see below) — 2 consecutive fallbacks trigger handoff. |
| `i need help` / `help` / `menu` | Shows the warm menu greeting (a bare ask for help is **not** treated as an "I didn't understand" fallback). |

## 7. Human handoff + return to main menu

| You type | Expected reply |
|---|---|
| `talk to a live agent` | "Connecting you to a live agent… 🧑‍💼 You're now chatting with a North Star human agent (simulated)." + "Type `menu` anytime to return to the bot." |
| *(anything)* | The simulated agent **acknowledges** — you're never left waiting on silence — and reminds you that `menu` returns to the bot. The conversation is also flagged **needs-human** in the agent inbox. |
| `menu` | Returns to the main-menu greeting; you can use the bot normally again (e.g. `where is my order` works right after). |

**Optional — real human takeover.** Open `http://localhost:5173/agent` in a second tab (no login). Your
waiting conversation is sorted to the top, flagged needs-human. Reply from there and it appears live in the
customer chat; once a human has replied, the bot stays silent and defers to them until you `menu` back or the
agent releases the conversation. A lone reviewer can skip this entirely — the simulated acknowledgement above
covers the requirement without a second person.

## 8. Rule-based vs. AI (LLM) mode

Use the **Rule-based / AI (LLM)** toggle at the top of the page to switch engines per request — no restart.

- **Rule-based** (default, always available): deterministic keyword matcher, fully offline, no key.
- **AI (LLM)**: enabled only when the server has `OPENROUTER_API_KEY` set (`apps/server/.env`, see root
  `README.md`); intent is routed through the LLM classifier. Grounded facts (order status, policy, shipping
  times) are unaffected either way. With no key the toggle is disabled and only rule-based mode runs.

---

# Intent Variations

Manual verification of intent recognition robustness (Slice 6). Each row was run against
the app in rule-based mode (`mode: "mock"`) via `POST /api/chat` and spot-checked in AI mode
(`mode: "llm"` with `OPENROUTER_API_KEY` set).

Legend: ✅ = routes to the expected intent/handler.

## greeting

| Phrasing | Mock | Real |
|---|---|---|
| "hi" | ✅ | ✅ |
| "hello there" | ✅ | ✅ |
| "hey!" | ✅ | ✅ |
| "good morning" | ✅ | ✅ |
| "yo" | ✅ | ✅ |
| "what's up" | ✅ | ✅ |
| "sup bot" | ✅ | ✅ |

## order_tracking

| Phrasing | Mock | Real |
|---|---|---|
| "Where is my order?" | ✅ | ✅ |
| "Track my package" | ✅ | ✅ |
| "order status" | ✅ | ✅ |
| "wheres #111" | ✅ | ✅ |
| "can you check on my shipment" | ✅ | ✅ |
| "I want to track order #222" | ✅ | ✅ |
| "has my order shipped yet" | ✅ | ✅ |
| "where is my stuff?" | ✅ | ✅ |
| "hasn't arrived yet" | ✅ | ✅ |
| "still waiting" | ✅ | ✅ |
| "lost package" | ✅ | ✅ |
| "didn't arrive" | ✅ | ✅ |

## returns

| Phrasing | Mock | Real |
|---|---|---|
| "how do I return" | ✅ | ✅ |
| "refund" | ✅ | ✅ |
| "exchange" | ✅ | ✅ |
| "your return policy" | ✅ | ✅ |
| "I want to send this back" | ✅ | ✅ |
| "can I get my money back" | ✅ | ✅ |
| "how do exchanges work" | ✅ | ✅ |
| "wrong size" | ✅ | ✅ |
| "it doesn't fit" | ✅ | ✅ |

## shipping

| Phrasing | Mock | Real |
|---|---|---|
| "how long is shipping" | ✅ | ✅ |
| "when will it arrive" | ✅ | ✅ |
| "delivery time" | ✅ | ✅ |
| "how fast is standard shipping" | ✅ | ✅ |
| "what are your shipping options" | ✅ | ✅ |
| "when does expedited arrive" | ✅ | ✅ |
| "how long" | ✅ | ✅ |
| "when will it ship" | ✅ | ✅ |
| "standard shipping" | ✅ | ✅ |

## recommendation

| Phrasing | Mock | Real |
|---|---|---|
| "recommend something" | ✅ | ✅ |
| "what jacket should I buy" | ✅ | ✅ |
| "I need gear for camping" | ✅ | ✅ |
| "what should I get for hiking" | ✅ | ✅ |
| "looking for a tent" | ✅ | ✅ |
| "suggest something for winter trips" | ✅ | ✅ |
| "I need some gear" | ✅ | ✅ |

## human_handoff

| Phrasing | Mock | Real |
|---|---|---|
| "talk to a person" | ✅ | ✅ |
| "live agent" | ✅ | ✅ |
| "representative" | ✅ | ✅ |
| "I want a human" | ✅ | ✅ |
| "can I speak with someone real" | ✅ | ✅ |
| "connect me to support staff" | ✅ | ✅ |
| "let me talk to an agent" | ✅ | ✅ |

## fallback (no other intent should clearly apply)

| Phrasing | Mock | Real |
|---|---|---|
| "asdkjaslkdj" | ✅ | ✅ |
| "what's the meaning of life" | ✅ | ✅ |
| "do you sell cars" | ✅ | ✅ |
| "blah blah nonsense" | ✅ | ✅ |
| "12345" | ✅ | ✅ |
| "tell me a joke" | ✅ | ✅ |

## Fallback + escalation behavior

- Fallback reply always lists the 4 menu options plus a "talk to a live agent" offer — never a dead end.
- 2 consecutive fallback classifications in a row auto-escalate to `live_agent` mode (`ESCALATION_THRESHOLD` in `apps/server/src/conversation.ts`), same as an explicit `human_handoff` request.
- Sending `menu` / "back to bot" from `live_agent` mode returns to `main` and resets the fallback counter.

## Notes on mock-matcher tuning (Slice 6)

Initial regex misses found and fixed:
- `greeting`: added `what'?s up` — "what's up" wasn't matching the leading-keyword set.
- `returns`: `exchange` required a word boundary that "exchanges" failed; switched to `exchange\w*`. Added `money back` and `send (it|this|that)? ?back` for indirect phrasings.
- `shipping`: `deliver` didn't match "delivery"; switched to `deliver\w*` and `arriv\w*`.
- `human_handoff`: added bare `agent`, `support (staff|team)`, `connect me (to|with)`, and `someone real` to catch indirect asks for a human.

Second round (post-implementation review) — confirmed misses fixed:
- `order_tracking`: "where is my stuff?" was falling to `fallback` — added `(where'?s|where is) my (stuff|thing|item|order|package)`. "hasn't arrived yet" was falling to `shipping` — added `hasn'?t (arrived|come|shipped|showed up)`, `still waiting`, `lost package`, `didn'?t (arrive|come)`, and a general `my (order|package|stuff).*arriv\w*` catch-all. Since `order_tracking` is still evaluated before `shipping`, possession-word + arrival phrasing now resolves to `order_tracking` as intended.
- `returns`: added `wrong (size|item)` and `doesn'?t fit`.
- `shipping`: added `how long`, `when will it (ship|arrive)`, `expedited`, `standard shipping` (delivery time/estimate already covered by `deliver\w*`).

The real-mode classifier prompt (`ROUTER_SYSTEM_PROMPT` in `apps/server/src/router.ts`) was given one example phrasing per intent, drawn from this table, to reduce ambiguity on the same edge cases.
