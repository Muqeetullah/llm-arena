import "server-only";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { withTracing } from "@posthog/ai";
import { postHogServer } from "./posthog";
import { serverEnv } from "./env";

const openRouter = createOpenRouter({
  apiKey: serverEnv.openRouterApiKey,
});

type TracedModelOptions = Readonly<{
  model: string;
  sessionId?: string;
  traceId: string;
  userId: string;
}>;

export const createTracedModel = ({
  model,
  sessionId,
  traceId,
  userId,
}: TracedModelOptions) =>
  withTracing(
    openRouter.chat(model, {
      usage: { include: true },
    }),
    postHogServer,
    {
      posthogCaptureImmediate: true,
      posthogDistinctId: userId,
      posthogProperties: {
        $ai_session_id: traceId,
        ...(sessionId ? { $session_id: sessionId } : {}),
      },
      posthogProviderOverride: "openrouter",
      posthogTraceId: traceId,
    },
  );
