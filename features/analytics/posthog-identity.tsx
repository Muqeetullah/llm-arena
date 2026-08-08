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
