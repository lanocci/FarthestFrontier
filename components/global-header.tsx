"use client";

import Link from "next/link";

type GlobalHeaderProps = {
  view: "dashboard" | "players" | "masters" | "player";
};

const navItems = [
  { href: "/", label: "ダッシュボード", view: "dashboard" },
  { href: "/players", label: "選手管理", view: "players" },
  { href: "/masters", label: "マスター管理", view: "masters" },
] as const;

export function GlobalHeader({ view }: GlobalHeaderProps) {
  return (
    <header className="global-header">
      <div>
        <p className="header-eyebrow">Flag Football Team Hub</p>
        <h1 className="header-title">FFFC 2025</h1>
      </div>

      <nav className="header-nav" aria-label="グローバルナビゲーション">
        {navItems.map((item) => (
          <Link
            key={item.href}
            className={`tab-link ${view === item.view || (view === "player" && item.view === "dashboard") ? "is-active" : ""}`}
            href={item.href}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
