import { auth } from "@clerk/nextjs/server";

export default async function ModelsLayout({
  children,
}: LayoutProps<"/models">) {
  await auth.protect();

  return children;
}
