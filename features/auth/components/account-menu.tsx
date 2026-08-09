"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { LogIn } from "lucide-react";
import Link from "next/link";

export function AccountMenu() {
  const { isLoaded, user } = useUser();
  const displayName =
    user?.fullName ??
    user?.firstName ??
    user?.primaryEmailAddress?.emailAddress ??
    "Your account";

  if (isLoaded && !user) {
    return (
      <Link className="signed-out-account" href="/sign-in">
        <span className="signed-out-account-icon" aria-hidden="true">
          <LogIn size={16} />
        </span>
        <span className="account-copy">
          <strong>Sign in</strong>
          <small>Send prompts and vote</small>
        </span>
      </Link>
    );
  }

  return (
    <div className="account-menu">
      <UserButton
        fallback={<span className="account-avatar-skeleton" />}
        showName={false}
      />
      <span className="account-copy">
        <strong>{isLoaded ? displayName : "Loading account"}</strong>
        <small>
          {isLoaded ? "Manage account or sign out" : "Checking session…"}
        </small>
      </span>
    </div>
  );
}
