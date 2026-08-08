import { auth } from "@clerk/nextjs/server";
import {
  convertToModelMessages,
  streamText,
} from "ai";
import { logModelError } from "@/features/model-connection/server/errors";
import { parseModelRequest } from "@/features/model-connection/server/input";
import { createTracedModel } from "@/features/model-connection/server/model";
import { protectModelRequest } from "@/features/model-connection/server/security";

const SAFE_MODEL_ERROR =
  "That model could not finish its answer. Please try again.";
const MAX_ANALYTICS_SESSION_ID_LENGTH = 200;

export const maxDuration = 60;
export const runtime = "nodejs";

const jsonError = (error: string, status: number): Response =>
  Response.json({ error }, { status });

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return jsonError("Sign in to send a prompt.", 401);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("The prompt request was not valid.", 400);
  }

  const input = await parseModelRequest(body);

  if (!input) {
    return jsonError("Choose a free model and enter a valid prompt.", 400);
  }

  const traceId = crypto.randomUUID();
  const decision = await protectModelRequest({
    correlationId: traceId,
    promptText: input.promptText,
    request,
    userId,
  });

  if (decision.isErrored()) {
    console.error("Arcjet protection failed open", {
      event: "arcjet_protection_error",
      reason: decision.reason.message,
      traceId,
      userId,
    });
  }

  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return jsonError("You have reached today’s model-call limit.", 429);
    }

    if (decision.reason.isPromptInjection()) {
      return jsonError("Please rephrase that prompt and try again.", 400);
    }

    if (decision.reason.isBot()) {
      return jsonError("Automated requests are not allowed.", 403);
    }

    return jsonError("That request was blocked for safety.", 403);
  }

  const rawSessionId = request.headers.get("x-posthog-session-id");
  const sessionId =
    rawSessionId && rawSessionId.length <= MAX_ANALYTICS_SESSION_ID_LENGTH
      ? rawSessionId
      : undefined;
  const model = createTracedModel({
    model: input.model,
    sessionId,
    traceId,
    userId,
  });

  const result = streamText({
    abortSignal: request.signal,
    maxOutputTokens: 1_000,
    messages: await convertToModelMessages([...input.messages]),
    model,
    onAbort: () => {
      console.info("Model generation aborted", {
        event: "model_generation_aborted",
        model: input.model,
        traceId,
        userId,
      });
    },
    onError: ({ error }) => {
      logModelError({
        error,
        model: input.model,
        traceId,
        userId,
      });
    },
  });

  return result.toUIMessageStreamResponse({
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "X-Model-Id": input.model,
      "X-Trace-Id": traceId,
    },
    onError: () => SAFE_MODEL_ERROR,
    originalMessages: [...input.messages],
  });
}
