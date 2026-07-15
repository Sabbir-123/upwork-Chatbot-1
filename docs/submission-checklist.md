# Submission Checklist

Requirement-by-requirement sign-off against the project brief. Each row points at the code, test,
or doc that satisfies it.

## The four required use cases

| # | Requirement | Status | Where |
|---|---|---|---|
| 1 | **Order tracking** — ask for order number, return simulated status | ✅ | `conversation.ts` (`order_tracking`, `awaitingOrderTurn`), `handlers/orderTracking.ts` |
| 2 | **Returns & exchanges** — explain policy, provide returns link | ✅ | `handlers/returns.ts`, `RETURN_POLICY` in `packages/shared` |
| 3 | **Product recommendations** — 1–2 clarifying questions, recommend a category | ✅ | `conversation.ts` (`recommend_flow`), `handlers/recommendation.ts` |
| 4 | **Human handoff** — handle fallback or explicit request, go to Live Agent state | ✅ | `conversation.ts` (`human_handoff`, fallback escalation, `liveAgentTurn`), `handlers/handoff.ts` |

## Functional requirements

| Requirement | Status | Where |
|---|---|---|
| Intent recognition handles phrasing variations | ✅ | `router.ts` (`understand`: deterministic regex + LLM); `router.test.ts` (60+ phrasings) |
| Slot extraction handles variations (numbers, activity, temperature) | ✅ | `understand.test.ts`; lenient/hash-prefixed order numbers in `orderTracking.ts` |
| Logical, guided conversation flow | ✅ | `conversation.ts` state machine; `conversation.test.ts` |
| Returns to main flow after resolution | ✅ | every resolved handler sets `mode: "main"`; asserted in `conversation.test.ts` |
| **Mock order data used exactly** (#111/#222/#333, else invalid) | ✅ | `ORDER_SEED` in `packages/shared`; exact-string tests in `orderTracking.test.ts` |
| Return policy: 30-day, unused, original packaging | ✅ | `RETURN_POLICY`; `returns.ts`; asserted in `conversation.test.ts` |
| Shipping: Standard 3–5 days, Expedited 1–2 days | ✅ | `SHIPPING_OPTIONS`; `shipping.ts`; asserted in `conversation.test.ts` |
| Live Agent state clearly communicated | ✅ | `handoffReply()`; verified in `test-plan.md` §7 |
| Never silent while awaiting a human | ✅ | `liveAgentHoldingReply()` acknowledges each message; `conversation.test.ts` |
| User can return to main menu after handoff | ✅ | `isBackToBot()` → greeting; `conversation.test.ts` ("menu" flow) |
| Fallback: clear "I didn't understand" + options/escalation | ✅ | `fallback.ts`; 2-fallback auto-escalation in `conversation.ts` |

## Constraints & deliverables

| Requirement | Status | Where |
|---|---|---|
| No deployment required to review | ✅ | `pnpm install && pnpm dev` runs everything locally |
| Testable without API keys / accounts / subscriptions | ✅ | rule-based brain is the default with no `.env`; see README "Reviewing this submission" |
| Uses provided data only | ✅ | all facts from `packages/shared` seed constants |
| Practical and testable | ✅ | `pnpm test` — 111 automated tests, no network |
| Code repository with instructions | ✅ | `README.md` |
| Video demo (2–3 min, 4 use cases + a fallback) | ▶️ | script in `docs/demo-script.md` |
| Hosted testable version (LLM brain, no key needed by reviewer) | ✅ | `<LIVE_DEMO_URL>` (set in README) |

## SLA sign-off (brief's final checklist)

1. All four use cases implemented — ✅
2. Order tracking follows mock data exactly — ✅ (`orderTracking.test.ts`)
3. Return policy & shipping info included where required — ✅
4. Intent recognition supports multiple phrasings — ✅ (`router.test.ts`)
5. Fallback handling implemented — ✅
6. Users can return to the main menu after handoff — ✅ (`conversation.test.ts`)
7. Reviewable without API keys or extra steps — ✅
8. Video demonstrates all four use cases + a fallback — ▶️ record from `docs/demo-script.md`
9. All required deliverables included and labeled — ✅ (this file)

**Before recording the video / submitting:** run `pnpm test && pnpm typecheck` (both green), and fill in
`<LIVE_DEMO_URL>` in `README.md` and above.
