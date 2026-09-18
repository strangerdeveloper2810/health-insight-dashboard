# Health Insight Dashboard — Design

**Context:** Final-round technical test for a Senior Frontend Engineer role at SQREEM.
Source: `docs/context/Frontend Developer Technical Test v2.pdf`.
Deadline: 1–2 days. Deliverable: public GitHub repo + README.

**The test's central question** (verbatim): *"If you were building this product for a real
user, what would you show them and why?"* The grading weight sits on product judgement and
LLM/prompt design, not on how many chart types we ship.

---

## 1. Persona and dataset

The brief says *"you will be given a fictional user persona and a set of health-related data"*,
but no such file was supplied. We therefore author our own, and isolate it so the real one can
be dropped in later without touching anything else (`packages/core/src/persona.ts`).

**Maya Tran, 34** — product designer, desk-bound, two young kids, lives in a walkable city.

| | |
|---|---|
| Goals | Run a 10K in 12 weeks (currently **day 47 of 84**); sleep 7h+; keep resting HR under 60 |
| Risk factors | Mother has type-2 diabetes; LDL mildly elevated at last checkup; reports a 3pm energy crash |
| Devices | Watch (sleep, HR, HRV, workouts), phone (steps), manual food logging |
| **Data quality** | **Nutrition logged on only ~60% of days** — a deliberate, realistic gap |

That last row matters. Real health data is incomplete, and a dashboard that pretends otherwise
is lying to the user. We surface logging completeness in the UI and hand the same caveat to the
LLM, so the assistant says "I can't tell you much about your sodium — you logged 18 of 30 days"
instead of inventing a trend. This is the cheapest, most convincing demonstration of grounded AI
in the whole build.

The dataset is a **seeded deterministic generator** over 90 days (steps, sleep stages, resting HR,
HRV, workouts, nutrition, weight, blood pressure, SpO2) with realistic autocorrelation — weekends
differ from weekdays, a training block starts on day 33, there is a 4-day illness gap and a
travel week. Annotations ride along so charts can explain *why* a line moved.

## 2. Product point of view

> The dashboard does not show data. It answers one question:
> **"Am I on track — and if not, what is the ONE thing to change?"**

Every layout decision follows from that. Verdict first, evidence second, raw data last:

1. **Verdict** — explainable readiness score
2. **Evidence** — trends with annotations, so movement is interpretable
3. **The one thing** — ranked, rule-based insight cards
4. **Detail** — sleep / activity / nutrition / goals for people who want to dig

## 3. Architecture — one analytics layer, two consumers

```
packages/core  (pure TypeScript — no React, no fetch, no DOM)
  persona → dataset → metrics → insights → readiness
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
   Redux selectors                 LLM snapshot + tools
   (what the user sees)            (what the model sees)
```

**The UI and the LLM read from the same computed state.** The assistant cannot cite a number the
dashboard does not have, and the insight cards it explains are the literal same objects rendered
on screen. Grounding is enforced by construction, not by asking the model nicely.

Two practical wins: `packages/core` is pure so it unit-tests without a DOM or network, and
swapping the dataset for a real API touches exactly one module.

## 4. Dashboard information architecture

Desktop 12-column grid; mobile collapses to a single column re-ordered by importance.

| Section | What it shows | Why it earns space |
|---|---|---|
| Header | Persona, date, **Day 47/84 of 10K plan**, data freshness, refresh | Anchors the user in their own story, not in a metric |
| Readiness hero | Composite 0–100 ring + **breakdown into Sleep / Recovery / Load sub-scores** | One number to act on, expandable so it is never a black box |
| Today tiles | Steps, sleep, resting HR, active minutes — value, delta vs 7-day baseline, goal ring, sparkline | The four numbers a person actually checks daily |
| Focus | Top 3 insight cards, severity-ranked, each with a **"Why?"** expander showing the rule and its evidence | This is *the one thing to change* |
| Trends | Metric switcher + 7/30/90-day range + **event annotations** + healthy-range band | Movement is meaningless without context |
| Sleep | Nightly stage breakdown, sleep debt line, bedtime consistency | The persona's biggest lever |
| Activity | Workout list with HR-zone bars, weekly volume vs goal, streak | Progress toward the stated 10K goal |
| Nutrition | Macro split, calories in/out, **logging-completeness banner** | Honest about partial data |
| Goals | Progress bars with **projections** ("at current pace: 10K by Nov 3") | Turns data into a forecast the user can act on |

**Readiness score** (explainable, not a vibe):
`0.4 × Sleep + 0.3 × Recovery + 0.3 × Load`, each sub-score 0–100 with its inputs retained:
Sleep = duration vs 7.5h target + efficiency + bedtime consistency; Recovery = HRV vs personal
baseline + resting HR vs baseline; Load = acute:chronic workload ratio inside the 0.8–1.3 band.

**Insight rules** (deterministic, each returns evidence refs): sleep↔resting-HR correlation,
cumulative sleep debt, bedtime consistency, weekend/weekday activity gap, goal projection,
training-load spike (ACWR), nutrition logging gap, HRV/RHR trend, streaks.

## 5. LLM design

### a. How the data reaches the model — two tiers

**Tier 1, always present (~1k tokens):** persona, today's metrics, 7/30/90-day baselines and
deltas, goal progress, the active insight list with evidence refs, and data-quality caveats.
Keys are emitted in a fixed order so the block is byte-stable across turns and therefore
cacheable. We do **not** dump 90 days × 10 metrics — that burns context, buries the signal, and
invites the model to pattern-match on noise.

**Tier 2, on demand — four read-only tools:** `get_metric_series`, `compare_periods`,
`get_sleep_breakdown`, `get_workouts`. Every tool is a pure function over the same dataset, so
drill-down answers are computed, never recalled.

### b. Prompt structure

Layered system prompt, stable content first for cache hits:
`[role & scope] → [grounding rules] → [citation contract] → [safety limits] → [output format] →
[persona + snapshot, cache_control: ephemeral]`. The volatile user turn sits after the last
cache breakpoint.

### c. Conversation context

The Messages API is stateless, so history is resent each turn. We keep a token-budgeted sliding
window of recent turns plus a rolling one-line summary of anything trimmed; the system prompt and
snapshot stay a cached prefix. Hard cap on turns.

### d. Invalid and unexpected responses

Typed SDK exceptions map to distinct user-facing states rather than one generic toast:
`AuthenticationError` → setup instructions with a link to `.env.example`; `RateLimitError` →
retry-after countdown; 5xx/overloaded → jittered backoff retry; `APIConnectionError` → offline
banner. `stop_reason: "refusal"` is handled explicitly (server-side fallbacks enabled);
`max_tokens` truncation is labelled as incomplete; empty text offers a retry.

### e. Preventing invented information — five layers

1. **Instruction + contract** — cite every number; say "not enough data" when there isn't any.
2. **Tools are the only data source**, and they are deterministic.
3. **Server-side citation validation** — the model writes `[[sleep.avg7d]]`; the BFF validates
   each ref against the computed metrics *after* the stream ends, strips unknown refs, and
   reports a grounding score.
4. **Numeric guard** — numbers in prose that trace to no context value are flagged.
5. **Data-quality map** — the model is told which domains are incomplete and instructed to say so.

Plus a scope guardrail: no diagnosis, no prescription, red-flag symptoms escalate to "see a
clinician", and a permanent "not medical advice" disclaimer. This is a health product; the
interviewer will look for it.

### f. Why citations are the centrepiece

Rendering `[[ref]]` as a live chip sourced from Redux makes grounding **visible**: the reviewer
can watch a claim resolve to the exact metric the chart is drawing. It also demos well — the
answer stops being a wall of text and becomes a set of inspectable claims.

## 6. Stack

| Layer | Choice | Rationale |
|---|---|---|
| Repo | npm workspaces monorepo | Shared types between client and server with no build step |
| Web | Vite + React 19 + TypeScript (strict) | Required by the brief; fastest dev loop |
| State | Redux Toolkit (+ `createSelector`) | Explicitly named in the brief; memoised derived metrics |
| Styling | Tailwind CSS | Fast, consistent, responsive by default |
| Charts | Recharts | Composable, accessible, React-native idiom |
| BFF | **Fastify** + `@anthropic-ai/sdk` | Keeps the key server-side, owns prompt assembly, validation and rate limiting |
| Model | `claude-opus-5`, adaptive thinking, effort `medium`, prompt caching, refusal fallbacks | Env-overridable (`ANTHROPIC_MODEL`) |
| Tests | Vitest | Core is pure TypeScript, so rules and the citation validator test without a DOM |

**Why a BFF rather than calling the API from the browser:** the key never enters the bundle;
prompt assembly and the anti-hallucination validation cannot be tampered with from DevTools;
one place to add caching, rate limiting and provider swaps. `npm run dev` starts both processes
via `concurrently`, so the reviewer still runs one command.

## 7. Scope

**P0 (must ship):** scaffold · dataset · metrics + insight rules · readiness hero · today tiles ·
insight cards · trends · BFF chat with streaming · README.

**P1:** sleep / activity / nutrition / goals sections · citation chips + grounding badge ·
tool-based drill-down.

**P2:** `?state=loading|error|empty|partial` debug simulator · unit tests · a11y pass · dark mode.

**Cut:** E2E tests, multi-provider adapter, auth, real wearable integration, i18n, PDF export.

The state simulator is deliberate: the brief requires loading, error and empty states, and a
toggle that demonstrates them beats a README sentence claiming they exist.

## 8. Verification

- `npm run dev` → dashboard renders, charts populated, readiness score explainable.
- `?state=loading|error|empty|partial` → each state renders correctly.
- Ask the assistant the brief's five example questions → streamed answers whose citations
  resolve to real metrics; ask something outside the data → it should decline, not invent.
- `npm test` → rules, readiness, citation validator, context builder.
- Unset `ANTHROPIC_API_KEY` → assistant shows a setup error, dashboard still works.
