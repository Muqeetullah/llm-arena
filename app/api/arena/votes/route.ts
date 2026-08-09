import { auth } from "@clerk/nextjs/server";

import { castVote } from "@/features/arena/server/data";
import { parseVote } from "@/features/arena/server/input";
import { postHogServer } from "@/features/model-connection/server/posthog";

const jsonError = (error: string, status: number): Response =>
  Response.json({ error }, { status });

export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId) return jsonError("Sign in to vote.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("The vote was not valid.", 400);
  }

  const input = parseVote(body);
  if (!input) return jsonError("The vote was not valid.", 400);

  try {
    const vote = await castVote(userId, input);
    if (!vote) return jsonError("That comparison was not found.", 404);

    postHogServer.capture({
      distinctId: userId,
      event: "vote_cast",
      properties: {
        response_id: input.responseId,
        turn_id: input.turnId,
      },
    });
    return Response.json({ responseId: vote.responseId });
  } catch (error) {
    console.error("Unable to save vote", { error, userId, ...input });
    return jsonError("A vote needs at least two completed answers.", 409);
  }
}
