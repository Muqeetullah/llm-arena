import "server-only";

import { APICallError, RetryError } from "ai";

import type { ModelResponseErrorCode } from "@/features/arena/types";

type ModelErrorContext = Readonly<{
  error: unknown;
  model: string;
  traceId: string;
  userId: string;
}>;

const errorDetails = (error: unknown): Readonly<Record<string, unknown>> => {
  if (error instanceof Error) {
    return Object.freeze({
      message: error.message,
      name: error.name,
      stack: error.stack,
    });
  }

  return Object.freeze({ value: String(error) });
};

export const logModelError = ({
  error,
  model,
  traceId,
  userId,
}: ModelErrorContext): void => {
  console.error("Model generation failed", {
    error: errorDetails(error),
    event: "model_generation_failed",
    model,
    traceId,
    userId,
  });
};

const errorMessage = (error: unknown): string =>
  error instanceof Error
    ? error.message.toLowerCase()
    : String(error).toLowerCase();

export const classifyModelError = (error: unknown): ModelResponseErrorCode => {
  const cause = RetryError.isInstance(error) ? error.lastError : error;

  if (APICallError.isInstance(cause)) {
    if (cause.statusCode === 408) return "TIMEOUT";
    if (cause.statusCode === 429) return "RATE_LIMITED";
    if (cause.statusCode === 404 || cause.statusCode === 422) {
      return "MODEL_UNAVAILABLE";
    }
  }

  const message = errorMessage(cause);
  if (
    message.includes("deadline_exceeded") ||
    message.includes("timed out") ||
    message.includes("timeout")
  ) {
    return "TIMEOUT";
  }
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "RATE_LIMITED";
  }
  if (
    message.includes("no endpoints") ||
    message.includes("model not found") ||
    message.includes("model unavailable")
  ) {
    return "MODEL_UNAVAILABLE";
  }

  return "PROVIDER_ERROR";
};
