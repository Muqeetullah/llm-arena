import { auth } from "@clerk/nextjs/server";

import { LeaderboardPage } from "@/features/leaderboard/components/leaderboard-page";

export default async function Leaderboard() {
  await auth.protect();

  return <LeaderboardPage />;
}
