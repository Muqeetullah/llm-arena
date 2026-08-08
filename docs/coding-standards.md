# Coding standards

These conventions are the working agreement for LLM Arena. The automated rules
are intentionally small: formatting is mechanical, correctness rules are strict,
and architecture remains visible enough to review by eye.

## Quality gate

Use Node.js 20.9 or newer and install the repository's pinned npm dependencies.
Before handing off a change, run:

```bash
npm run check
npm run build
```

`npm run check` verifies formatting, ESLint, and TypeScript; type-checking first
generates the ignored Prisma client and Next.js route types. `npm run format` and
`npm run lint:fix` apply safe mechanical fixes. Production builds remain a
separate check because they may require the environment documented in
`.env.example`.

Running `npm install` configures the repository's pre-commit hook. On commit it
type-checks the whole project, then runs ESLint and Prettier on staged files.
Fixes made by those tools are added back to the commit by `lint-staged`. Do not
bypass the hook to merge a failing change.

## TypeScript and functions

- Keep TypeScript in strict mode. Use `unknown` at untrusted boundaries, narrow
  it with a schema or type guard, and never introduce `any`.
- Prefer pure functions, immutable inputs, `const`, and `readonly` types. Push
  network, database, logging, analytics, and environment access to the edges.
- Model expected states in return values. Throw only for broken invariants or
  failures that the current layer cannot handle.
- Validate all request and provider data at the boundary. Never use a type
  assertion as a substitute for runtime validation.
- Use named types for domain concepts and options passed across modules. Keep
  short, local component props inline when that is clearer.
- Name booleans as questions (`isLoaded`, `hasAccess`, `canVote`) and functions
  as actions. Constants that encode limits or policy use `UPPER_SNAKE_CASE`.

## Project structure

- Organize domain code under `features/<feature>`. Keep its server-only modules,
  components, schemas, and utilities with the feature that owns them.
- Reserve `app` for App Router entry points such as pages, layouts, loading and
  error boundaries, metadata, and route handlers. A route handler should parse
  and authorize, call feature code, and translate the result to HTTP.
- Import across top-level directories with the `@/` alias. Use relative imports
  within one small feature folder when the relationship is clearer.
- Prefer one primary exported component or operation per file. Extract code when
  it has its own policy, boundary, or meaningful name, not merely to shorten a
  file.

## Next.js and React

- Server Components are the default. Add `"use client"` only at the smallest
  interactive boundary; never put secrets, privileged clients, or server-only
  modules below that boundary.
- Read the installed Next.js 16 documentation in `node_modules/next/dist/docs`
  before relying on a framework API. Route props and request APIs may be async.
- Start independent data work together and await it together. Avoid serial data
  waterfalls unless one operation genuinely depends on the previous result.
- Use semantic HTML, visible focus, keyboard-operable interactions, and real
  labels. Use `next/image`, `next/font`, and App Router metadata conventions.
- Keep repeated visual values in `app/globals.css` and repeated UI patterns in a
  shared component owned by the relevant feature.

## Boundaries, errors, and observability

- Read environment variables through a validated server or client environment
  module. Only `NEXT_PUBLIC_` values may cross into browser code, and those values
  must be safe to expose.
- Authenticate and apply abuse protection before performing expensive work.
  Forward request cancellation to downstream calls when supported.
- Return short, actionable, safe errors to users. Log the original failure on the
  server with stable event names and the identifiers needed to trace it; never
  expose raw exceptions, provider responses, credentials, or personal data.
- Keep analytics event names and properties stable. Record honest measured values
  and do not silently substitute estimates.

## Formatting and review

Prettier owns whitespace, quotes, semicolons, line wrapping, and trailing commas.
ESLint owns correctness and framework rules. Do not add hand-formatted exceptions
or formatting rules to ESLint. Prisma schema files use `npx prisma format` because
Prettier does not format Prisma syntax.

Review should still check what tools cannot: feature ownership, server/client
boundaries, accessibility, safe errors, cancellation, immutable data flow, and
whether a new abstraction is simpler than the duplication it replaces.

There is intentionally no automated test runner or browser automation framework.
Verify behavior with the lightest real flow that proves the change: a running app
and browser for UI, or a focused `curl`/live integration check for an endpoint.
