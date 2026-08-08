# Routes

## `/`

- Entry: `app/page.tsx`
- Layout: `app/layout.tsx`
- Access: protected by Clerk at the page boundary.
- Current UI: interactive Arena workspace with the shared navigation shell, model response comparison, voting states, metrics, prompt composer, and authenticated account menu.

## `/leaderboard`

- Entry: `app/leaderboard/page.tsx`
- Layout: `app/layout.tsx`
- Access: protected by Clerk at the page boundary.
- Current UI: global and personal ranking table with full model names, explicit win records, win-rate bars, time-to-first-token, and response speed.

## `/models`

- Entry: `app/models/page.tsx`
- Layout: `app/layout.tsx`
- Access: protected by Clerk at both the route layout and page boundary.
- Current UI: searchable live catalog of free OpenRouter text models, ordered by context window with model IDs, providers, modalities, capabilities, and pricing state.

## `/sign-in/[[...sign-in]]`

- Entry: `app/sign-in/[[...sign-in]]/page.tsx`
- Access: public.
- Current UI: light-mode Clerk sign-in flow inside the LLM Arena authentication shell.

## `/sign-up/[[...sign-up]]`

- Entry: `app/sign-up/[[...sign-up]]/page.tsx`
- Access: public.
- Current UI: light-mode Clerk registration flow inside the LLM Arena authentication shell.

## `/api/model-responses`

- Entry: `app/api/model-responses/route.ts`
- Type: authenticated POST route handler; no visual UI.
