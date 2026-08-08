export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/features/model-connection/server/env");
  }
}
