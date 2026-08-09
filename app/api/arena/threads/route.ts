import { auth } from "@clerk/nextjs/server";

import { getRecentThreads, getThread } from "@/features/arena/server/data";
import { parseThreadId } from "@/features/arena/server/input";
import { protectPublicThreadRead } from "@/features/model-connection/server/security";

const jsonError = (error: string, status: number): Response =>
  Response.json({ error }, { status });

export async function GET(request: Request) {
  const rawThreadId = new URL(request.url).searchParams.get("id");
  if (!rawThreadId) {
    const { userId } = await auth();
    if (!userId) return jsonError("Sign in to view your comparisons.", 401);
    return Response.json(await getRecentThreads(userId), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  let decision: Awaited<ReturnType<typeof protectPublicThreadRead>>;
  try {
    decision = await protectPublicThreadRead(request);
  } catch (error) {
    console.error("Arcjet public thread protection could not run", {
      error,
      event: "arcjet_public_thread_protection_failed",
      surface: "api",
    });
    return jsonError("The safety check is temporarily unavailable.", 503);
  }

  if (decision.isDenied()) {
    console.warn("Arcjet blocked a public thread API read", {
      event: "arcjet_public_thread_read_denied",
      reason: decision.reason.type,
      requestId: decision.id,
      surface: "api",
    });
    return decision.reason.isRateLimit()
      ? jsonError("Too many comparison requests. Please try again soon.", 429)
      : jsonError("That comparison request was blocked.", 403);
  }

  if (decision.isErrored()) {
    console.error("Arcjet public thread protection failed", {
      event: "arcjet_public_thread_protection_error",
      reason: decision.reason.message,
      requestId: decision.id,
      surface: "api",
    });
    return jsonError("The safety check is temporarily unavailable.", 503);
  }

  const threadId = parseThreadId(rawThreadId);
  if (!threadId) return jsonError("Choose a valid comparison.", 400);

  const { userId } = await auth();

  const thread = await getThread(userId, threadId);
  if (!thread) return jsonError("That comparison was not found.", 404);

  return Response.json(thread, {
    headers: { "Cache-Control": "no-store" },
  });
}
