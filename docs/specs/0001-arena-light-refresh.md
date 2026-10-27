# Arena inspired light refresh

**Date**: 2026-10-27
**Status**: In Progress

## Summary

Use Arena.ai as visual inspiration for a light LLM Arena. The user requested research and implementation while retaining the existing functionality.

## Requirements

AC-1: Use a warm off white canvas, charcoal text, green actions, restrained borders and editorial serif headings throughout the app.
AC-2: The new comparison screen groups its introduction, composer and clickable prompt starters in one central workspace.
AC-3: Preserve existing model selection, streams, voting, thread history, sharing, catalogue filters, rankings and authentication states.
AC-4: Keep navigation and the composer usable on narrow screens and respect reduced motion.

## Decision

Translate the observed Arena.ai charcoal and green visual language into a light canvas. Reuse Geist for controls and Georgia for editorial headings. Reuse the existing Lucide icons and existing page structure. No new dependencies or image assets are needed. The current user request supersedes the rust palette in docs/scope.md.

## Feature design

The sidebar retains labelled navigation, recent threads and the account menu. The main welcome area presents a small comparison label, an editorial headline with green emphasis, supporting copy, the existing model composer, three prompt starters and an honest model accuracy note. Existing conversations retain the response grid and docked composer. Catalogue, leaderboard, auth and error surfaces share the revised tokens.

Value sourcing: all model names, history, results, metrics and rankings retain their existing sources. Starter titles and prompts are static editorial copy in arena-page.tsx; clicking fills the existing prompt state without sending it. Authentication continues through Clerk. No API, data model or security changes.

## Build plan

- [x] Update shared colours, typography and shell styling (AC-1, AC-3).
- [x] Recompose the welcome screen and connect prompt starters (AC-2).
- [ ] Verify responsive layout, navigation, starter input, lint and types (AC-3, AC-4).

## Consequences

The light palette intentionally differs from the dark reference. Georgia substitutes for the proprietary reference heading font. Existing backend behavior stays in place.

## Research

Arena.ai was visited on 2026-10-27. Its rendered page uses a charcoal background (rgb 37, 37, 35), Plantijn serif headings, green headline emphasis, a central composer, starter cards and a quiet navigation rail.

## Verification

Lint and TypeScript checks pass. The browser confirms the welcome layout, starter input and the updated sign in page. Catalogue and leaderboard require authentication in this browser. `npm run check` and `npm run build -- --webpack` pass. The default Turbopack build hits an environment restriction while binding a local port. Narrow screen rules were inspected, but a mobile viewport and authenticated flows were not exercised.
