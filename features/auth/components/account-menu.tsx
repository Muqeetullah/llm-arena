"use client";

import { UserButton, useUser } from "@clerk/nextjs";

export function AccountMenu() {
  const { isLoaded, user } = useUser();
  const displayName =
    user?.fullName ??
    user?.firstName ??
    user?.primaryEmailAddress?.emailAddress ??
    "Your account";

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
