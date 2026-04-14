"use client";

import Link from "next/link";

type GlobalHeaderProps = {
  view: "dashboard" | "players" | "masters" | "materials" | "materials-manage" | "settings" | "player-goal" | "player-reflection";
};

const navItems = [
  { href: "/", label: "ダッシュボード", view: "dashboard" },
  { href: "/materials", label: "資料室", view: "materials" },
  { href: "/settings", label: "設定", view: "settings" },
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
            className={`tab-link ${view === item.view || ((view === "player-goal" || view === "player-reflection") && item.view === "dashboard") || ((view === "players" || view === "masters" || view === "materials-manage") && item.view === "settings") ? "is-active" : ""}`}
            href={item.href}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
