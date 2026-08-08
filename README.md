# LLM Arena

Send one prompt to free OpenRouter models, compare their independently streamed answers, and vote for the best one.

## Local setup

1. Copy `.env.example` to `.env.local` and provide Clerk, OpenRouter, Arcjet, PostHog, and PostgreSQL credentials.
2. Install dependencies with `npm install`.
3. Generate the Prisma client with `npm run prisma:generate`.
4. Start the app with `npm run dev`.

## Development

Run the complete local quality gate before handing off a change:

```bash
npm run check
npm run build
```

`npm install` configures a pre-commit hook that type-checks the project and fixes
lint and formatting issues in staged files. See
[`docs/coding-standards.md`](docs/coding-standards.md) for the architectural,
TypeScript, Next.js, accessibility, error-handling, and review conventions.

The model endpoint is `POST /api/model-responses`. It requires a Clerk session and accepts one free OpenRouter model per request. Multiple models must be called with separate concurrent requests so their streams fail and cancel independently.

The Arena, Leaderboard, Models catalog, and model-response API require a Clerk session. `/sign-in` and `/sign-up` are the public authentication routes. Clerk redirect URLs are configured in `.env.example` and should also be added to the deployment environment.

## Getting Started

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
