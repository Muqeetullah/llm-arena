import { Database, LayoutGrid, Swords, Trophy } from "lucide-react";
import Link from "next/link";

export default function ModelsLoading() {
  return (
    <div className="arena-app models-app models-loading-page">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Swords size={19} strokeWidth={2.2} />
          </span>
          <span>LLM Arena</span>
        </div>
        <nav className="primary-nav" aria-label="Primary navigation">
          <Link className="nav-link" href="/">
            <LayoutGrid size={18} /> Arena
          </Link>
          <Link className="nav-link" href="/leaderboard">
            <Trophy size={18} /> Leaderboard
          </Link>
          <Link className="nav-link is-active" href="/models">
            <Database size={18} /> Models
          </Link>
        </nav>
      </aside>
      <section className="arena-shell">
        <header className="topbar">
          <div className="thread-heading">
            <div>
              <span className="breadcrumb">LLM Arena / Catalog</span>
              <h1>Models</h1>
            </div>
          </div>
        </header>
        <main className="models-main" aria-busy="true">
          <div className="models-intro">
            <div>
              <span className="eyebrow">Free model catalog</span>
              <h2>Loading available models…</h2>
            </div>
          </div>
          <div className="catalog-loading-list" aria-label="Loading models">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="catalog-loading-row" key={index}>
                <span />
                <div>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ))}
          </div>
        </main>
      </section>
    </div>
  );
}
