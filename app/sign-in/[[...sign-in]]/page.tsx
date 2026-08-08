import { SignIn } from "@clerk/nextjs";
import { Swords } from "lucide-react";
import Link from "next/link";

export default function SignInPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="auth-heading">
        <Link className="auth-brand" href="/sign-in">
          <span className="brand-mark" aria-hidden="true">
            <Swords size={19} strokeWidth={2.2} />
          </span>
          <span>LLM Arena</span>
        </Link>
        <div className="auth-copy">
          <span className="eyebrow">Welcome back</span>
          <h1 id="auth-heading">Sign in to enter the Arena</h1>
          <p>
            Compare models, cast votes, and keep your personal leaderboard tied
            to one secure account.
          </p>
        </div>
      </section>
      <section className="auth-card-wrap" aria-label="Sign in form">
        <SignIn />
      </section>
    </main>
  );
}
