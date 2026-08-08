import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "@/features/model-connection/server/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const createPrismaClient = (): PrismaClient => {
  const adapter = new PrismaPg({ connectionString: serverEnv.databaseUrl });
  return new PrismaClient({ adapter });
};

export const database = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = database;
}
