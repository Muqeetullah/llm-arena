import { auth } from "@clerk/nextjs/server";

import { LeaderboardPage } from "@/features/leaderboard/components/leaderboard-page";
import { getLeaderboards } from "@/features/leaderboard/server/get-leaderboards";

export default async function Leaderboard() {
  const { userId } = await auth.protect();
  const leaderboards = await getLeaderboards(userId);

  return <LeaderboardPage {...leaderboards} />;
}
