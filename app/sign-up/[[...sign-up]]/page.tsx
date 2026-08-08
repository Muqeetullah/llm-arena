import { SignUp } from "@clerk/nextjs";
import { Swords } from "lucide-react";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="auth-heading">
        <Link className="auth-brand" href="/sign-up">
          <span className="brand-mark" aria-hidden="true">
            <Swords size={19} strokeWidth={2.2} />
          </span>
          <span>LLM Arena</span>
        </Link>
        <div className="auth-copy">
          <span className="eyebrow">Create your account</span>
          <h1 id="auth-heading">Build your own model rankings</h1>
          <p>
            Save comparisons and turn every head-to-head vote into a personal
            leaderboard.
          </p>
        </div>
      </section>
      <section className="auth-card-wrap" aria-label="Sign up form">
        <SignUp />
      </section>
    </main>
  );
}
