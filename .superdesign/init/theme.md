# Theme

## Compact token summary

- Framework: Next.js 16.3 App Router with React 19 and TypeScript
- Styling: Tailwind CSS 4 imported from `app/globals.css`
- Fonts: Geist Sans (`--font-geist-sans`) and Geist Mono (`--font-geist-mono`)
- Current page colors: white `#ffffff` background and `#171717` text; system dark mode uses `#0a0a0a` and `#ededed`
- Current radii, spacing, shadows, and breakpoints: Tailwind defaults; no project-specific tokens yet
- Component library: none currently implemented

## Raw theme source

### `app/globals.css`

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

### `postcss.config.mjs`

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```
