import { auth } from "@clerk/nextjs/server";

import { getRecentThreads, getThread } from "@/features/arena/server/data";
import { parseThreadId } from "@/features/arena/server/input";

const jsonError = (error: string, status: number): Response =>
  Response.json({ error }, { status });

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return jsonError("Sign in to view comparisons.", 401);

  const rawThreadId = new URL(request.url).searchParams.get("id");
  if (!rawThreadId) {
    return Response.json(await getRecentThreads(userId), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const threadId = parseThreadId(rawThreadId);
  if (!threadId) return jsonError("Choose a valid comparison.", 400);

  const thread = await getThread(userId, threadId);
  if (!thread) return jsonError("That comparison was not found.", 404);

  return Response.json(thread, {
    headers: { "Cache-Control": "no-store" },
  });
}
