import "server-only";

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
