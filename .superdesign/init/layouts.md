# Shared layouts

## `app/layout.tsx`

Root App Router layout. It loads Geist Sans and Geist Mono, provides Clerk authentication context, initializes PostHog identity, and renders the route content.

```tsx
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PostHogIdentity } from "@/features/analytics/posthog-identity";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LLM Arena",
  description: "Compare real answers from free AI models.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <PostHogIdentity />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
```

## `features/analytics/posthog-identity.tsx`

Non-visual client component rendered by the root layout to synchronize Clerk identity with PostHog.

```tsx
"use client";

import { useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import { useEffect } from "react";

export function PostHogIdentity() {
  const { isLoaded, user } = useUser();

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    if (user) {
      posthog.identify(user.id);
      return;
    }

    posthog.reset();
  }, [isLoaded, user]);

  return null;
}
```
