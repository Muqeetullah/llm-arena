# Scope: LLM Arena

Send one prompt, watch up to three AI models answer it at the same time, and vote for the best one. Over time those votes and the real per-call numbers, speed, tokens, cost, build an honest leaderboard of which model is actually worth using.

Build it in a thin, working slice first, one prompt actually reaching a model and coming back, before making any single part of it fuller. Then thicken it piece by piece. Before building anything, decide what you're doing and why in a few plain sentences, then build it, and if the plan turns out wrong once it's actually built, say so and fix the plan too, not just the code.

Whenever a "build it" style step actually gets underway, break it into its own short list of what's genuinely being done, and check each part off as it's finished, right in this file. That way this file can be opened fresh, in a brand new conversation, and it's obvious what's already done and what's still left, without anyone re-explaining the feature from scratch.

## Stack

Already decided, nothing open here: Next.js (App Router), TypeScript, Tailwind, shadcn for components (card, button, popover, loading skeleton, and whatever else the UI actually needs as it gets built), Prisma with Postgres, Clerk for auth, Arcjet in front of the endpoint, PostHog for analytics and observability.

## Sketches

There are rough hand-drawn sketches for the arena screen, the leaderboard, and the models page. Treat them as structure only, where things sit, what exists on the page, not as the final design or the actual colors, all of that is already decided elsewhere in this file. If something in a sketch genuinely contradicts what's written here, stop and ask which one actually wins rather than guessing.

## At a glance

| #   | Feature                                     | Phase      | Status      |
| --- | ------------------------------------------- | ---------- | ----------- |
| 1   | Connecting to a model                       | Foundation | complete    |
| 2   | Coding standards & tooling                  | Foundation | complete    |
| 3   | Data model                                  | Foundation | complete    |
| 4   | Design & look                               | Foundation | complete    |
| 5   | Model picker                                | Slice 1    | complete    |
| 6   | Send a prompt, parallel streams, and voting | Slice 1    | complete    |
| 7   | App shell & thread history                  | Slice 2    | not started |
| 8   | Public thread visibility & sharing          | Slice 3    | complete    |
| 9   | Leaderboard: global & personal              | Slice 4    | not started |

## Foundation

### 1. How the app actually connects to a model

The Next.js project itself gets created manually first, `create-next-app`, fast and simple, no reason to spend agent time or tokens on something that easy.

Two real decisions still open once that exists: how the app calls OpenRouter to get a model's answer, and how streaming three models back to the browser at once should actually work. This one's worth real thought: routing all three through one shared connection looks simpler, but if that one connection drops, all three answers die together, which breaks the whole point of one model failing never affecting the others. Decide both properly, then wire them, along with Prisma, Clerk, and Arcjet, into the project that already exists.

PostHog should be wired in from the start too, session replay and heatmaps turned on, and tied to the signed-in user once Clerk resolves, so events are attached to a real person, not left anonymous.

The decided connection boundary is one authenticated HTTP stream per model call. The browser will start up to three requests concurrently later, rather than asking one server request to multiplex three providers; that gives every model its own cancellation, failure, and retry boundary. Each request runs Clerk authentication and Arcjet protection before calling OpenRouter, so a three-model prompt spends three units from the same user-keyed quota.

Model calls use Vercel AI SDK's `streamText` with OpenRouter's AI SDK provider. The route returns the AI SDK UI message stream rather than exposing OpenRouter's raw SSE format, and it replaces provider failures with one safe retryable message while logging the real error on the server. The request signal is forwarded to the model call so disconnecting one response stops only that provider call.

PostHog wraps each AI SDK model call with `withTracing`. The Clerk user ID is the PostHog distinct ID and each call carries a trace ID and browser session ID, which keeps server-side LLM generations linkable to client analytics and session replay. Prisma 7 is initialized for PostgreSQL with the `pg` driver adapter and a single reusable client, but domain tables remain Feature 3 work.

- [x] Decide the approach
- [x] Write the spec
- [x] Install the exact integration dependencies and document required environment variables
- [x] Configure Clerk authentication and protect the model endpoint
- [x] Connect the LLM Arena Arcjet site and configure Shield, bot detection, prompt-injection detection, and a shared per-user quota
- [x] Configure OpenRouter through Vercel AI SDK and stream one real model response
- [x] Configure PostHog client analytics, Clerk identity, session replay, heatmaps, and server-side AI telemetry
- [x] Configure Prisma 7 for PostgreSQL with its PostgreSQL driver adapter
- [x] Verify the configured PostgreSQL connection with a live query
- [x] Implement safe route errors and per-request cancellation
- [x] Run every live integration smoke check; lint, typecheck, the webpack production build, PostgreSQL, OpenRouter, PostHog, Clerk, and Arcjet enforcement pass

### 2. Coding standards & tooling

Write down the real conventions for this project once it actually exists, then install linting, formatting, and a pre-commit hook that actually enforces them.

Keep Next.js 16's Core Web Vitals and TypeScript ESLint presets as the correctness baseline, with project rules layered on top rather than replacing framework defaults. Prettier owns formatting and `eslint-config-prettier` keeps that responsibility separate from ESLint. A lightweight `simple-git-hooks` pre-commit hook runs the full TypeScript check and uses `lint-staged` to fix and re-stage lint and formatting changes; `npm run check` is the full-repository quality gate for local work and CI. No test runner or browser automation is added, in keeping with the project-wide tooling decision.

- [x] Decide the approach
- [x] Add project lint and formatting configuration
- [x] Add scripts and an enforced pre-commit hook
- [x] Write the coding standards document
- [x] Verify formatting, lint, typecheck, the hook path, and a production build

### 3. Data model

The core things every feature depends on: users tied to Clerk, threads, each model's own messages inside a thread, and votes. A vote should only ever be possible on a turn where two or more models actually answered.

Use a turn as the shared prompt boundary inside a thread, with one independently stateful response per selected OpenRouter model. Keep the Clerk user ID as the application's user key; snapshot each model's ID and display name on its response so history remains truthful if the live catalog changes. Persist raw token counts and timing measurements, then derive totals, speed, win rate, and leaderboard aggregates rather than storing values that can drift. A vote belongs to one user, one turn, and one of that turn's completed responses. PostgreSQL enforces both the response/turn relationship and the rule that at least two responses must be complete before the vote is inserted or changed.

- [x] Decide the approach
- [x] Build it
  - [x] Model users, threads, ordered turns, independent model responses, usage, timing, and votes
  - [x] Add the initial migration and database voting invariant
  - [x] Generate the client and validate the schema, migration, and full project quality gates

### 4. Design & look

A warm ivory and cream background, not neutral gray or stark white. One accent color, rust, is used only for things you interact with—buttons, links, focus states, and the win-rate bar—never as decoration. The rust must stay clearly darker and more saturated than its surrounding surface so controls remain unmistakable. Blue, indigo, and purple are never the accent, under any circumstance. Green is reserved only for marking a winner, red only for errors, never reused for anything else. The application uses this light theme only; there is no dark mode or theme toggle.

The visual direction is a **coffeehouse scorecard**: warm and editorial enough to feel human, structured and precise enough to make model comparisons trustworthy. It should feel like a focused evaluation workspace, not a generic SaaS dashboard or a neon AI demo. Use flat color, clear rules, compact data, and generous reading space; avoid gradients, glows, glass effects, oversized pills, and decorative illustrations.

Use one light theme with these semantic tokens, adjusting only if implementation-level visual checks expose a real problem:

| Role             | Value     |
| ---------------- | --------- |
| Page             | `#F7F0E8` |
| Surface          | `#FFF9F4` |
| Raised surface   | `#F1E5DA` |
| Border           | `#D8C3B4` |
| Primary text     | `#2C1A13` |
| Secondary text   | `#725C50` |
| Interactive rust | `#B44318` |
| Winner only      | `#287446` |
| Error only       | `#B43A32` |

The core text pairs have WCAG AA contrast, including secondary copy and rust links; filled rust buttons use the light surface color for text. Focus rings use rust and must remain visible outside the control boundary. Do not use color as the only signal for winner, error, selection, loading, or rank.

Keep Geist as the main typeface. Use a restrained display treatment—larger Geist with tight tracking and strong weight—for page titles and the wordmark rather than adding a novelty font. Use Geist Mono only for measurements, token counts, latency, rank, and compact model identifiers. Default body copy stays at 15–16px with comfortable line height; model responses prioritize readability over dashboard density.

Use an 8px spacing base, 12px control corners, and 16px panel corners. Borders, spacing, and type weight establish hierarchy; shadows are rare and shallow. Use one consistent open-source outline icon set at 16–20px, with text labels for primary navigation. Model avatars are neutral initials, never provider colors, so presentation cannot bias a vote.

Preserve the sketches' information architecture: fixed sidebar, compact top bar, scrollable conversation, and a prompt composer anchored to the bottom. The arena is the visual centerpiece, not the navigation. On wide screens, answers form equal-width columns with aligned headers and metric footers. On smaller screens, the sidebar becomes a drawer and answer cards stack in full; nothing shrinks below a readable response width. The composer stays reachable but must not cover the final lines of an answer.

Response cards share the same neutral treatment before voting. Their streaming, complete, failed, and selected states differ through labels, icons, border treatment, and color where permitted. Voting is a clear rust action only after at least two responses complete. Once cast, the selected response gets a winner label and restrained green border; losing responses remain fully legible. Metrics are collapsed by default and reveal a compact aligned row for time to first token, speed, and total tokens.

The leaderboard should read like a publication table, not a collection of cards: strong rank and win record, quiet secondary performance measures, fine row dividers, and a restrained raised surface for first place. The models catalog may use cards because each model is an independent browseable object, but keep their heights, label positions, and numeric columns consistent.

Motion is functional and short: 120–180ms state transitions, a subtle streaming caret, and no entrance choreography. Respect reduced-motion preferences.

- [x] Decide the approach
- [x] Build it
  - [x] Create the Superdesign design system and Arena workspace draft
  - [x] Implement the responsive app shell, comparison cards, composer, and theme
  - [x] Add accessible voting, model-chip, metrics, navigation, and mobile states
  - [x] Verify formatting, lint, typecheck, production build, and local response

## Slice 1: Core arena loop

### 5. Model picker

An "Add model" popover pulling OpenRouter's live free-tier list, sorted by context window, capped at three models, defaulting to all three selected, with removable chips next to the prompt box. Also render that same catalog as a simple `/models` page, name, context window, and pricing for each one, so anyone can browse the full list without opening the picker.

The Arena and `/models` share one server-owned catalog contract. OpenRouter results are limited to zero-price model IDs that accept text and return text only, then cached for five minutes and sorted by context window. The authenticated Arena page sends only the compact picker metadata into its client boundary. It prefers the three established Arena models when they are still live, fills any missing slots from the ordered catalog, and retains those three as a safe fallback if the catalog cannot be reached. Selection remains local to the current Arena session, always contains at least one model, and never exceeds three.

The picker uses shadcn's Radix popover and command primitives for keyboard search and selection. Model identity is separate from the original demo-answer fixtures, so any live model selected from the catalog can render in a new response card without requiring hard-coded presentation data.

- [x] Decide the approach
- [x] Build it
  - [x] Share catalog types, display helpers, and free-model eligibility with the response endpoint
  - [x] Pass a compact live catalog from the authenticated Server Component into the Arena
  - [x] Add deterministic three-model defaults and a resilient catalog-error fallback
  - [x] Build the searchable, keyboard-accessible popover with one-to-three selection rules
  - [x] Reuse the same filtered catalog on `/models`
  - [x] Verify formatting, lint, typecheck, webpack production build, protected-route rendering, and the live catalog filter

### 6. Send a prompt, parallel streams, and voting

The heart of the product. One prompt goes to every selected model at once, each streaming and failing independently, so one being slow or down never blocks the others. Each answer shows its own real time-to-first-token, tokens per second, and total tokens. No cost shown, every model here is free tier, so it would always read zero. A vote only exists once two or more models have answered, and picking one writes exactly one vote and marks that answer as the winner, while every answer stays visible the whole time. A follow-up continues each model's own separate conversation.

Arcjet sits in front of this endpoint before any model is ever called: rate limiting, bot protection, and a shield against prompt injection, plus a real limit on how much one person can use across all three models at once, not just a limit on the endpoint overall.

Every prompt sent, every answer finishing, and every vote cast should be tracked as a real PostHog event, so there's an honest funnel from prompt to answer to vote. A model failing should also be logged properly on the server, not just shown to the user and forgotten. Separately from that funnel, every actual model call should also be wrapped so PostHog captures its own real tokens, cost, and latency per call, that's PostHog's own LLM analytics, not the same thing as the funnel events or the numbers already shown on the response card.

Create the turn and its one-to-three response records in a serializable database transaction before starting any model call. The browser then fans those response IDs out into independent HTTP streams, preserving the per-model failure and retry boundary decided in Feature 1. A response ID is an authorization capability only for its owning signed-in user and is atomically claimed before generation, so duplicate retries cannot start duplicate provider calls. The server, not the browser, reconstructs each model's conversation from that model's completed responses in earlier turns; client-supplied history is never trusted.

Each stream persists its final text, provider token counts, duration, time to first token, and terminal state from AI SDK lifecycle callbacks. The same real measurements return in typed UI-message metadata for the response card, then the client confirms the terminal state against an owner-authorized database read after the stream closes. A response is only presented as complete when that persistence succeeds. Reasoning-only generations with no visible text are failed rather than made voteable. Failed and aborted calls retain a safe retry boundary; attempt timestamps let abandoned streams be reclaimed without allowing an older request to overwrite a newer retry, while provider details stay in server logs. Arcjet evaluates every individual model call against the same user-keyed token bucket, so selecting three models consumes three units without coupling their streams.

Voting uses its own authenticated route. The route checks thread ownership and upserts the turn's single vote, while the existing PostgreSQL trigger remains the final authority that the selected response belongs to the turn, is complete, and has at least one other completed response. Prompt, completed-answer, and vote funnel events are captured on the server; each actual LLM call remains independently wrapped by PostHog AI tracing and linked back to the browser session.

- [x] Decide the approach
- [x] Build it
  - [x] Create persisted turns and per-model response identities before fan-out
  - [x] Stream up to three model calls concurrently with independent failure and retry boundaries
  - [x] Reconstruct each model's follow-up context from server-owned completed history
  - [x] Persist response content, status, real TTFT, output speed inputs, and token usage
  - [x] Enforce owner-only, one-per-turn voting after at least two completed answers
  - [x] Capture prompt, completed-answer, vote, and traced LLM-call telemetry, with structured server failure logs
  - [x] Guard duplicate submissions, retries, stale completions, and concurrent vote races
  - [x] Verify formatting, lint, typecheck, and the webpack production build

## Slice 2: App shell & thread history

### 7. App shell & thread history

The frame everything else sits inside: a top bar and sidebar that stay in place while the page scrolls, plus the thread's name. Win records belong on the leaderboard, where the full model name and "won X of Y" context make them understandable; do not compress them into initials and fractions in the Arena header. The sidebar lists a signed-in user's own past threads so the tool actually feels usable across visits, not just in one sitting.

- [x] Decide the approach
- [x] Build it

## Slice 3: Public visibility & sharing

### 8. Public thread visibility & sharing

Anyone should be able to open a thread's link and see it, without an account, that's what actually makes it shareable. Only sending a prompt and voting need sign-in. A made-up or deleted thread just shows a plain not-found page either way. The thread's real owner sees everything everyone else sees, plus the ability to actually use it.

Keep the existing `?thread=` permalink as the public sharing contract. Thread reads look up the opaque thread ID without requiring Clerk, but return only the comparison content and a `canInteract` capability computed for the current viewer; the owner's identity is never exposed. Every write path remains authenticated and owner-scoped at the database query, so a public link grants visibility but no mutation authority. The Arena renders the same saved rounds for everyone, hides voting, retry, and composer controls from non-owners, and offers owners their normal interactive workspace. Invalid IDs and absent records both terminate through Next.js's not-found boundary.

Public reads use one Arcjet policy before either the server-rendered permalink or JSON endpoint can query PostgreSQL. Shield blocks common malicious web-request patterns; ordinary shared links are unchanged, while a denial appears in Arcjet as a Shield decision with its request details. Bot detection blocks scrapers and scripted clients but permits social, Slack, and link-preview bots, so normal readers and shared-link previews remain invisible to the rule; detected bot identity and category appear in the Arcjet dashboard when it fires. A per-IP sliding window allows 60 reads per minute, which normal browsing never approaches, while sustained refreshes and database-hammering scripts receive a denial; the dashboard records the rate-limit decision and client fingerprint.

- [x] Decide the approach
- [x] Build it
  - [x] Make thread reads public without exposing owner identity
  - [x] Add read-only Arena states and a working share-link action
  - [x] Render invalid and deleted thread links through a plain not-found page
  - [x] Verify anonymous reads, owner-only writes, quality gates, and production build
  - [x] Protect both public read paths with Arcjet Shield, bot detection, and per-IP rate limiting
  - [x] Verify Arcjet decisions, quality gates, and the production build

## Slice 4: Leaderboard

### 9. Leaderboard: global & personal

Two leaderboards from the same votes, one for everyone, one just for the signed-in user. Each row's win rate is the big, bold number, in the accent color, with a small bar next to it, always written as "won 4 of 5," never a bare percentage or a made-up score. Smaller, quieter numbers underneath for average speed and time-to-first-token, each clearly labeled. No cost or "cheapest" stat, every model is free, so that number never means anything here. First place gets a subtle highlight, nobody else does.

- [ ] Decide the approach
- [ ] Build it

## Not doing right now

Kept here so the plan stays honest about what's deliberately left out.

- A "fastest" label on the leaderboard, tagging whichever model already has the best average speed, only for models with enough votes to mean anything. Nice to have, not required.
- Giving each model's own little icon a distinct look instead of plain gray. Nice to have, not required.
- Privacy policy and terms pages.
- Rich link previews when a thread gets shared somewhere.
- Any kind of admin or moderation page.
- A public API for the leaderboard data. Nobody's asked for this.
