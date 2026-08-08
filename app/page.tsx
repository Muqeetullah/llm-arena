import { auth } from "@clerk/nextjs/server";

import { ArenaPage } from "@/features/arena/components/arena-page";

export default async function Home() {
  await auth.protect();

  return <ArenaPage />;
}
