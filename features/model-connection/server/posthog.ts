import "server-only";

import { PostHog } from "posthog-node";
import { serverEnv } from "./env";

export const postHogServer = new PostHog(serverEnv.postHogProjectToken, {
  flushAt: 1,
  flushInterval: 0,
  host: serverEnv.postHogHost,
});
