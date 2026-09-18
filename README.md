# Health Insight Dashboard

A personal health dashboard for a fictional user, Maya Tran, with an AI assistant that answers
questions about her data and is structurally incapable of inventing a number.

The interesting part of this project is not the charting. It is that the dashboard and the
assistant read from **the same computed values**, so "the model must not make things up" is a
check that either passes or fails on every message, rather than an instruction in a prompt that
is hoped for.

```
pnpm install
cp .env.example .env      # add ANTHROPIC_API_KEY — the dashboard works without it
pnpm dev                  # web on :5173, BFF on :8787
```

---

## Contents

- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Architecture](#architecture)
- [Product decisions](#product-decisions)
- [The assistant: LLM and prompt design](#the-assistant-llm-and-prompt-design)
- [Testing](#testing)
- [Reviewing the loading, error and empty states](#reviewing-the-loading-error-and-empty-states)
- [Trade-offs and what I would do next](#trade-offs-and-what-i-would-do-next)

---

## Quick start

**Requirements:** Node ≥ 22.9 and pnpm ≥ 9. This project uses pnpm only — `packageManager` is
pinned and the workspace uses the `workspace:*` protocol.

> Node 22.9 is the floor because the BFF loads `.env` with the built-in
> `--env-file-if-exists` flag rather than a `dotenv` dependency.

```bash
pnpm install
cp .env.example .env       # then edit it and add your key
pnpm dev
```

Then open <http://localhost:5173>.

| Command | What it does |
|---|---|
| `pnpm dev` | Runs the BFF and the Vite dev server together |
| `pnpm dev:web` / `pnpm dev:bff` | Runs one of them |
| `pnpm build` | Typechecks and builds the production bundle |
| `pnpm test` | Runs the whole test suite |
| `pnpm typecheck` | Typechecks every package |

**The app runs without an API key.** The dashboard is fully functional; the assistant reports
itself as unconfigured and explains how to fix it. Nothing silently breaks.

---

## Environment variables

Everything lives in one `.env` at the repository root. Only the BFF reads it, and **nothing is
prefixed with `VITE_`**, so no value here is ever inlined into the browser bundle. `.env` is
gitignored; `.env.example` is committed and holds no real values. The API key never leaves the
server process.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | for the assistant | — | Anthropic API key. Without it the server starts and the assistant reports itself as unconfigured. |
| `ASSISTANT_MODEL` | no | `claude-opus-5` | Model the assistant uses. |
| `ASSISTANT_EFFORT` | no | `medium` | Reasoning effort: `low` \| `medium` \| `high` \| `xhigh` \| `max`. |
| `ASSISTANT_MAX_TOKENS` | no | `8192` | Ceiling on a single answer. |
| `PORT` | no | `8787` | Port the BFF listens on. Vite proxies `/api` here. |
| `WEB_ORIGIN` | no | `http://localhost:5173` | Allowed CORS origin. |
| `DATASET_SEED` | no | `20260918` | Seed for the generated dataset. |
| `DATASET_DAYS` | no | `90` | How many days of history to generate. |

Two notes on naming. The model variable is `ASSISTANT_MODEL` rather than `ANTHROPIC_MODEL`
because several Anthropic developer tools export `ANTHROPIC_MODEL` into the shell; inheriting it
silently would point this app at a model it was never tested against. `ANTHROPIC_API_KEY` keeps
its conventional name because the SDK reads it too. An unrecognised `ASSISTANT_EFFORT` falls back
to the default rather than being forwarded — a typo should not quietly change answer quality.

`GET /api/health` reports whether a key is present, never its value, prefix or length.

---

## Architecture

```
health-insight-dashboard/
├── packages/core/          Pure domain logic. Zero runtime dependencies.
│   ├── persona.ts          Maya Tran: who she is, what she is trying to do
│   ├── dataset.ts          Seeded generator for 90 days of observations
│   ├── metrics.ts          Rolling windows, gaps preserved as gaps
│   ├── readiness.ts        The readiness score and its components
│   ├── insights.ts         Rules that decide what is worth surfacing
│   ├── refs.ts             The reference index — every number the app may state
│   ├── api.ts              The HTTP contract, declared once for both sides
│   └── llm/                Prompt assembly, tools, citation validation
│
├── apps/bff/               Fastify. Holds the API key, computes nothing itself.
│   ├── config.ts           Environment parsing
│   ├── dashboard.ts        Builds the payload once, memoised
│   ├── tools.ts            The four tools the model may call
│   └── chat.ts             Prompt → tool runner → stream → citation check
│
└── apps/web/               React + Redux Toolkit. Renders. Decides nothing.
    ├── features/           Slices and memoised selectors
    ├── dashboard/          One component per section of the page
    ├── assistant/          Panel, streaming, citation rendering
    └── ui/                 Five primitives and the state components
```

### Why a BFF

The brief left API architecture open, so this is the deliberate choice: a small Fastify server
between the browser and Anthropic.

- **The key stays server-side.** A `VITE_`-prefixed key would be in the bundle, which is the
  same as publishing it.
- **The prompt is assembled from data the client cannot touch.** A tampered browser can change
  what it displays; it cannot change what the model is told, or which references exist.
- **The citation check runs where the index lives.** Validating in the browser would mean
  shipping the index and trusting the client's verdict on its own answer.

### One analytics layer, two consumers

`buildDashboard(dataset)` runs once at boot. Its output is both the JSON the browser fetches and
the snapshot that goes into the system prompt. There is no second implementation of "average
resting heart rate over the last 7 days" for the model to disagree with, because there is no
second implementation at all.

This is the decision the rest of the project hangs off. It means a number the assistant cites
and a number a chart plots are the same value by construction, not by convention.

### The HTTP contract lives in `packages/core/src/api.ts`

Types only, no runtime code, imported by both the BFF and the web app. A payload shape written
twice is a payload shape that drifts, and the failure mode is silent.

### State

Redux Toolkit, with three slices: `dashboard` (the payload and its load status), `ui` (theme,
selected trend metric and range, disclosure state) and `assistant` (conversation, streaming
status, grounding verdicts). Derived data goes through `createSelector`, so the reference-index
`Map` is built once per payload rather than on every render.

### Code style

Functions are arrow functions assigned to `const`, throughout all three packages. The exceptions
are the two places the language requires a regular function: `ApiError`'s members assign to
`this`, and the fake stream in the BFF test is an `async function*` — an arrow can neither own a
`this` binding nor be a generator.

The one consequence worth naming is that `const` is not hoisted, so a definition has to sit above
any *top-level* call to it. Calls from inside other function bodies are unaffected, which is every
call in this codebase.

### Request flow for a chat turn

```
browser ──POST /api/chat {messages}──▶ BFF
                                      │ 1. validate + cap history
                                      │ 2. build system prompt from the
                                      │    server's own computed data
                                      │ 3. toolRunner → Anthropic (streamed)
                                      │ 4. validateCitations(fullText, index)
                                      ▼
browser ◀──SSE: tool / delta / done / error──┘
```

The browser never sends its copy of the data. It cannot, because there is no endpoint that
accepts one.

---

## Product decisions

The brief's central question is *"if you were building this for a real user, what would you show
them and why?"* These are the answers I committed to.

### The page order is the argument

1. **Readiness, then what produced it.** One score, immediately followed by its three components
   and the evidence behind each. "76, good" is useless on its own; "76, good — and here is the
   40% of it that sleep is costing you" is actionable.
2. **Today's four numbers.** Steps, sleep, resting HR, HRV — each with its value, its change
   against the previous week, and the shape of the last 30 days.
3. **What we noticed.** Ranked observations, each with the figures that justify it.
4. **Trends.** The chart, with life events shaded underneath.
5. **Goals.** Progress, pace, and whether the target is still reachable.
6. **Sleep, activity, nutrition.** The detail, by domain.
7. **Context and data quality.** What to keep in mind while reading everything above.

Nothing earned a place above "how am I today".

### Four decisions that shaped the rest

**Gaps are gaps, never zeroes.** If the watch was not worn, there is no sleep record — and the
line breaks rather than dropping to the axis. A missing night drawn as a zero-height bar reads
as "slept nothing", which is a different and false claim from "the watch was charging". The
sample count is shown next to every average ("from 6 of 7 days"), because a 7-day average over 3
recorded days is a different claim from one over 7.

**Comparisons are to the user's own baseline, not a population.** The training-load panel reports
this week against *her* four-week norm (the acute:chronic ratio), not against a recommended
figure. 40 km is a quiet week for one runner and a spike for another. The bands are named in
words — "in your sweet spot", "sharp spike" — rather than leaving the reader to interpret "1.42".

**Life events are shaded on the trend chart.** A resting heart rate that climbed eight beats over
a week looks alarming until the flu is shaded underneath it. Most of what looks like a health
trend is a life event, and a chart that hides them is a chart that misleads.

**Nutrition completeness is the headline, not a footnote.** Food logging is partial in the
generated data, as it is in life, and partial days under-count rather than averaging out. The
panel says so at the top instead of presenting a confident calorie figure that is really a floor.

### Who Maya is

A 34-year-old product designer in Singapore, training for a 10 km run, with a family history of
type-2 diabetes and mildly elevated LDL. Her goals are a 10 km run without stopping, 7 hours of
sleep, 10,000 steps, and a resting heart rate under 60. She is not a patient and does not want to
be treated like one — she wants to know whether she is on track and what to change.

The dataset is generated from a seed (mulberry32 + Box–Muller), so it is reproducible and clearly
fictional. It is deliberately imperfect, because a clean dataset would let the UI dodge every hard
question. Across the 90 days there is a head cold in mid-August, a conference week in Tokyo that
pushed sleep later and shorter, a product launch week that cost her the training sessions, one
night the watch was not worn at all — and logging that is genuinely intermittent: 27 of 90 days
have no food record, weight is taken every second or third morning, and blood pressure only
occasionally.

Those gaps are the point. They are what the "gaps are gaps" decision above is tested against, and
they are why every average in the UI carries its sample count.

---

## The assistant: LLM and prompt design

### Grounding: the model cannot type a number

The system prompt gives the model a catalogue of every value it is allowed to state, each with an
id. To state one, it writes a token:

```
Your resting heart rate is averaging {{restingHeartRate.avg7d}}.
```

The client replaces that token with the value from **the same reference index the charts read
from**. There is no code path that turns model output into a number — a hallucinated figure has
nowhere to come from.

After each response, `validateCitations` checks every token against the index and reports the
result on the message. A token that does not resolve is **shown**, marked, not silently dropped:
deleting it would leave a sentence that reads as finished prose with a hole in it. The panel
shows a badge, and the header counts ungrounded answers across the session.

One wrinkle worth naming: a citation renders as value *and* unit ("61 bpm"), and models tend to
write the unit as well, which produced "61 bpm bpm". The prompt now states that the token expands
to include its unit, and `dropRepeatedUnits` removes a duplicate deterministically — on the raw
markdown, before parsing, because the commonest phrasing puts emphasis between the two
(`**{{x}}** bpm`) and they end up in different markdown nodes. The prompt asks; the code
guarantees.

### What goes into the prompt

Four blocks, in the order the API caches them:

1. **Persona and instructions** — who Maya is, the hard constraint on numbers, what the data can
   and cannot support, what the assistant must not do (no diagnosis, no medication advice, no
   false praise), and how to structure an answer.
2. **The data snapshot** — the reference catalogue plus the computed summary: readiness and its
   components, the insights, and the rolling windows. Generated from the same bundle the
   dashboard renders.
3. **Conversation history** — the last 16 turns, each capped at 4,000 characters.
4. **Tools** — four read-only tools for anything the snapshot does not cover:
   `get_metric_series`, `compare_periods`, `get_sleep_breakdown`, `get_workouts`.

The first two blocks are byte-identical on every request, so they carry a `cache_control`
breakpoint. The conversation gets a second breakpoint once it is long enough to be worth caching.

### Conversation context

History is sent as ordinary messages. The snapshot is **not** in the history — it is resent in
full every turn, which means the model never loses the data it needs even when early small talk
is dropped by the 16-turn cap. The alternative, letting the model accumulate its own summary of
the data across turns, is how a grounded system drifts into an ungrounded one.

### Tools, not vibes

The snapshot cannot contain every possible cross-section, and a model asked to compute "how does
this month compare with last month" from a table will eventually get it wrong. Instead it calls
`compare_periods`, which runs the same analytics code the dashboard uses and returns a formatted
result. The model is choosing *which question to ask*, not doing arithmetic.

### Failure handling

Errors map to something a person can act on rather than a status code: a rejected key, a rate
limit, an unreachable provider, and a model API error each get their own message and their own
`code` on the error event. The dashboard is unaffected by any of them, and the UI says so.

The request also opts into server-side fallbacks, so a question that trips a safety classifier
gets an answer from a substitute model inside the same call rather than an empty bubble.

Answers stream as server-sent events over a POST (`EventSource` cannot send a body), which makes
cancellation a plain `AbortController` — that is what the stop button uses. A malformed SSE frame
is dropped rather than killing the stream; losing one token of a sentence is survivable, losing
the sentence is not. If the user closes the tab mid-answer the server aborts generation rather
than burning tokens on output nobody will read.

---

## Testing

```bash
pnpm test        # 86 tests across 3 files
pnpm typecheck   # all three packages
```

The suite covers the parts where a bug would be silent:

- **Analytics** — rolling windows with gaps, readiness components, the insight rules.
- **Grounding** — that a citation resolves to the indexed value, that an invented reference is
  caught and reported, that a repeated unit is stripped without eating a neighbouring number's
  unit or the start of a longer word, and that the token regex does not leak `lastIndex` between
  calls (a module-level `/g` regex would silently skip citations on the second use).
- **The BFF** — request validation, SSE framing, the stop button's abort path, error mapping,
  and that `/api/health` never echoes key material. The Anthropic client is injected, so the
  suite never reaches the network.

One BFF test deliberately does *not* use `app.inject()`. It opens a real socket, because
`inject()` bypasses the request lifecycle — and the lifecycle is where a bug hid that made every
chat turn return `200` with an empty stream (see below). A suite that only ever calls `inject()`
cannot see it, however many assertions it has.

Beyond the unit tests, the UI was verified in a real browser against a real stream: deltas
arrive, citations resolve to values, an unresolvable token is marked, the gzipped bundle is split
so the assistant's markdown renderer loads only when the panel opens, and there is no horizontal
overflow at any of ten viewport widths from 320px to 1920px.

That browser pass also covers the chart annotations, and it earned its keep. The life-event
shading had been rendering as *nothing at all* — the window constants are counted in days ago,
which runs backwards against the calendar, so every multi-day span was written into the dataset
with `date` after `endDate`. Recharts draws that as a zero-width band: no error, no warning, no
band. Two unit tests now assert the ordering, because the failure is invisible in every other
way. All five events draw correctly today, at all three ranges.

The same pass caught a worse one on the assistant: every turn returned `200` with an empty
stream. Two faults compounded. `signal` was destructured in `streamChat` but never passed to the
tool runner — it is a request option, not a body field — so the abort controller was decorative
and closing the tab would not have stopped generation at all. And the abort was wired to
`request.raw`, which emits `'close'` the moment the request body has been read, *before* the
model is called. So `signal.aborted` was true on every turn, and the catch block read every
upstream failure as "the user has left" and stayed quiet. `describeError` had been written,
unit-tested, and never once reached a caller. Both are fixed; the regression test opens a real
socket, because `app.inject()` is precisely what hid it.

---

## Reviewing the loading, error and empty states

The brief asks for loading, error and empty states to be handled. Handling them is half the job —
a reviewer has to be able to *see* them, and "unplug your network" is not a review instruction.

Append `?state=` to the URL:

| URL | Shows |
|---|---|
| `/` | The real dashboard |
| `/?state=loading` | The loading skeletons, held indefinitely |
| `/?state=error` | The error state with a retry |
| `/?state=empty` | A brand-new user with no recorded data |
| `/?state=partial` | A real load with parts blanked, exercising per-section empty states |

There are links to each in the footer. Dark mode is a toggle in the header and persists across
reloads.

---

## Trade-offs and what I would do next

**The dashboard is the product; the assistant is a layer on it.** I spent the time on the
analytics and the section-by-section empty states rather than on assistant features, on the
theory that an assistant explaining a bad dashboard is worth less than a good dashboard.

**Recharts is the largest dependency** (~400 kB minified of a 676 kB initial bundle) and it is
above the fold, so it is not worth splitting out. If the chart set grew, I would draw the
sparklines and the simpler bars by hand — `Sparkline` already is hand-drawn SVG for exactly this
reason.

**No end-to-end test in CI.** The browser verification described above was run manually against a
fake Anthropic endpoint. With more time I would commit that harness: a stub Messages API plus
Playwright, asserting the streaming path on every push, since that is the one path where a
regression is invisible to the unit tests.

**The dataset is generated, not fetched.** A real version would read from whatever the wearable
syncs to, and the interesting engineering there is the same as here — one analytics layer, gaps
preserved, and an assistant that can only cite what exists.

**The assistant has no memory between sessions.** Each conversation starts fresh. Persisting
conversations would mean deciding what the model is allowed to remember, which is a product
question before it is a technical one.
