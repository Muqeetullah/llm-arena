import { ArrowLeft, Swords } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <div className="not-found-card">
        <span className="brand-mark" aria-hidden="true">
          <Swords size={20} strokeWidth={2.2} />
        </span>
        <p className="eyebrow">404 · Not found</p>
        <h1>That thread isn’t here.</h1>
        <p>
          The link may be incorrect, or the comparison may have been deleted.
        </p>
        <Link href="/">
          <ArrowLeft size={16} aria-hidden="true" />
          Return to the Arena
        </Link>
      </div>
    </main>
  );
}
