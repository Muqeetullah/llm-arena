import { auth } from "@clerk/nextjs/server";
import { consumeStream, streamText } from "ai";
import {
  claimResponse,
  failResponse,
  finishResponse,
  getResponseResult,
} from "@/features/arena/server/data";
import { parseResponseId } from "@/features/arena/server/input";
import type {
  ArenaUIMessage,
  ModelResponseErrorCode,
} from "@/features/arena/types";
import {
  classifyModelError,
  logModelError,
} from "@/features/model-connection/server/errors";
import { createTracedModel } from "@/features/model-connection/server/model";
import { postHogServer } from "@/features/model-connection/server/posthog";
import { protectModelRequest } from "@/features/model-connection/server/security";

const SAFE_MODEL_ERROR =
  "That model could not finish its answer. Please try again.";
const MAX_ANALYTICS_SESSION_ID_LENGTH = 200;

export const maxDuration = 60;
export const runtime = "nodejs";

const jsonError = (error: string, status: number): Response =>
  Response.json({ error }, { status });

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return jsonError("Sign in to view a response.", 401);

  const responseId = parseResponseId({
    responseId: new URL(request.url).searchParams.get("id"),
  });
  if (!responseId) return jsonError("Choose a valid model response.", 400);

  const result = await getResponseResult(userId, responseId);
  if (!result) return jsonError("That response was not found.", 404);

  return Response.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}

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

  const responseId = parseResponseId(body);

  if (!responseId) {
    return jsonError("Choose a valid model response.", 400);
  }

  const claimedResponse = await claimResponse(userId, responseId);
  if (!claimedResponse) {
    return jsonError("That response is unavailable or already running.", 409);
  }

  const persistFailure = async ({
    content,
    durationMs,
    errorCode,
    timeToFirstTokenMs,
  }: Readonly<{
    content: string;
    durationMs: number;
    errorCode: ModelResponseErrorCode;
    timeToFirstTokenMs: number | null;
  }>) => {
    try {
      const saved = await failResponse(
        claimedResponse.responseId,
        claimedResponse.attemptStartedAt,
        { content, durationMs, errorCode, timeToFirstTokenMs },
      );
      if (saved.count !== 1) {
        console.warn("Model failure state was already finalized", {
          errorCode,
          event: "model_failure_state_conflict",
          responseId: claimedResponse.responseId,
          userId,
        });
      }
    } catch (error) {
      console.error("Unable to persist model failure", {
        error,
        errorCode,
        event: "model_failure_persistence_failed",
        responseId: claimedResponse.responseId,
        userId,
      });
    }
  };

  const traceId = crypto.randomUUID();
  let decision: Awaited<ReturnType<typeof protectModelRequest>>;
  try {
    decision = await protectModelRequest({
      correlationId: traceId,
      promptText: claimedResponse.promptText,
      request,
      userId,
    });
  } catch (error) {
    await persistFailure({
      content: "",
      durationMs: 0,
      errorCode: "PROVIDER_ERROR",
      timeToFirstTokenMs: null,
    });
    console.error("Arcjet protection could not run", {
      error,
      event: "arcjet_protection_failed",
      traceId,
      userId,
    });
    return jsonError("The safety check is temporarily unavailable.", 503);
  }

  if (decision.isErrored()) {
    console.error("Arcjet protection failed open", {
      event: "arcjet_protection_error",
      reason: decision.reason.message,
      traceId,
      userId,
    });
  }

  if (decision.isDenied()) {
    await persistFailure({
      content: "",
      durationMs: 0,
      errorCode: decision.reason.isRateLimit()
        ? "RATE_LIMITED"
        : "REQUEST_BLOCKED",
      timeToFirstTokenMs: null,
    });

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
    model: claimedResponse.modelId,
    sessionId,
    traceId,
    userId,
  });
  const startedAt = Date.now();
  let content = "";
  let firstTokenElapsedMs: number | null = null;

  const result = streamText({
    abortSignal: request.signal,
    maxOutputTokens: 1_000,
    messages: claimedResponse.messages,
    model,
    onChunk: ({ chunk }) => {
      if (chunk.type === "text-delta") {
        content += chunk.text;
        firstTokenElapsedMs ??= Date.now() - startedAt;
      }
    },
    onFinish: async ({ text, totalUsage }) => {
      const durationMs = Date.now() - startedAt;
      const timeToFirstTokenMs = firstTokenElapsedMs ?? durationMs;
      if (!text.trim()) {
        await persistFailure({
          content: "",
          durationMs,
          errorCode: "EMPTY_RESPONSE",
          timeToFirstTokenMs: firstTokenElapsedMs,
        });
        console.error("Model completed without a text response", {
          event: "model_generation_empty",
          model: claimedResponse.modelId,
          responseId: claimedResponse.responseId,
          traceId,
          userId,
        });
        return;
      }

      try {
        const saved = await finishResponse(
          claimedResponse.responseId,
          claimedResponse.attemptStartedAt,
          {
            content: text,
            durationMs,
            inputTokens: totalUsage.inputTokens ?? 0,
            outputTokens: totalUsage.outputTokens ?? 0,
            timeToFirstTokenMs,
          },
        );
        if (saved.count !== 1) {
          console.warn("Model response was already finalized", {
            event: "model_completion_state_conflict",
            responseId: claimedResponse.responseId,
            userId,
          });
          return;
        }
        postHogServer.capture({
          distinctId: userId,
          event: "model_response_finished",
          properties: {
            duration_ms: durationMs,
            model_id: claimedResponse.modelId,
            output_tokens: totalUsage.outputTokens,
            response_id: claimedResponse.responseId,
            thread_id: claimedResponse.threadId,
            time_to_first_token_ms: timeToFirstTokenMs,
            trace_id: traceId,
          },
        });
      } catch (error) {
        console.error("Unable to persist completed model response", {
          error,
          event: "model_completion_persistence_failed",
          responseId: claimedResponse.responseId,
          userId,
        });
        await persistFailure({
          content: text,
          durationMs,
          errorCode: "PROVIDER_ERROR",
          timeToFirstTokenMs: firstTokenElapsedMs,
        });
      }
    },
    onAbort: async () => {
      await persistFailure({
        content,
        durationMs: Date.now() - startedAt,
        errorCode: "ABORTED",
        timeToFirstTokenMs: firstTokenElapsedMs,
      });
      console.info("Model generation aborted", {
        event: "model_generation_aborted",
        model: claimedResponse.modelId,
        traceId,
        userId,
      });
    },
    onError: async ({ error }) => {
      await persistFailure({
        content,
        durationMs: Date.now() - startedAt,
        errorCode: classifyModelError(error),
        timeToFirstTokenMs: firstTokenElapsedMs,
      });
      logModelError({
        error,
        model: claimedResponse.modelId,
        traceId,
        userId,
      });
    },
  });

  return result.toUIMessageStreamResponse({
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "X-Model-Id": claimedResponse.modelId,
      "X-Trace-Id": traceId,
    },
    consumeSseStream: consumeStream,
    messageMetadata: ({ part }) => {
      if (part.type !== "finish") return undefined;
      const durationMs = Date.now() - startedAt;
      return {
        metrics: {
          durationMs,
          outputTokens: part.totalUsage.outputTokens ?? 0,
          timeToFirstTokenMs: firstTokenElapsedMs ?? durationMs,
        },
      };
    },
    onError: () => SAFE_MODEL_ERROR,
    originalMessages: [] as ArenaUIMessage[],
  });
}
