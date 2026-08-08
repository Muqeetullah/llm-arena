# Page dependency trees

## `/` — Arena workspace

Entry: `app/page.tsx`

Dependencies:

- `app/page.tsx`
  - `features/arena/components/arena-page.tsx`
    - `features/auth/components/account-menu.tsx` (Clerk user menu)
    - `next/link` (framework component)
    - `lucide-react` (icons)
- `app/layout.tsx`
  - `features/analytics/posthog-identity.tsx` (non-visual identity integration)
  - `app/globals.css`

## `/leaderboard` — Model rankings

Entry: `app/leaderboard/page.tsx`

Dependencies:

- `app/leaderboard/page.tsx`
  - `features/leaderboard/components/leaderboard-page.tsx`
    - `features/auth/components/account-menu.tsx` (Clerk user menu)
    - `next/link` (framework component)
    - `lucide-react` (icons)
- `app/layout.tsx`
  - `features/analytics/posthog-identity.tsx` (non-visual identity integration)
  - `app/globals.css`

## `/models` — Available model catalog

Entry: `app/models/page.tsx`

Dependencies:

- `app/models/page.tsx`
  - `features/model-catalog/server/get-available-models.ts` (OpenRouter catalog)
  - `features/model-catalog/components/models-catalog.tsx` (search and catalog UI)
  - `next/link` (framework component)
  - `lucide-react` (icons)
- `app/layout.tsx`
  - `features/analytics/posthog-identity.tsx` (non-visual identity integration)
  - `app/globals.css`

## `/sign-in/[[...sign-in]]` — Authentication

Entry: `app/sign-in/[[...sign-in]]/page.tsx`

Dependencies:

- `@clerk/nextjs` (`SignIn`)
- `next/link` (framework component)
- `lucide-react` (icons)
- `app/globals.css`

## `/sign-up/[[...sign-up]]` — Registration

Entry: `app/sign-up/[[...sign-up]]/page.tsx`

Dependencies:

- `@clerk/nextjs` (`SignUp`)
- `next/link` (framework component)
- `lucide-react` (icons)
- `app/globals.css`
