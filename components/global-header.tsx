"use client";

import { BookOpen, Clapperboard, Home, LogOut, Settings } from "lucide-react";
import Link from "next/link";

type GlobalHeaderProps = {
  view: "dashboard" | "players" | "masters" | "materials" | "audiovisual" | "materials-manage" | "settings" | "player-goal" | "player-reflection" | "player-season-goal";
  teamRole?: "coach" | "guardian" | null;
  onSignOut?: () => void;
};

const navItems = [
  { href: "/", label: "ホーム", icon: Home, view: "dashboard", coachOnly: false },
  { href: "/materials", label: "資料室", icon: BookOpen, view: "materials", coachOnly: false },
  { href: "/videos", label: "ビデオ (β)", icon: Clapperboard, view: "audiovisual", coachOnly: false },
  { href: "/settings", label: "設定", icon: Settings, view: "settings", coachOnly: false },
] as const;

export function GlobalHeader({ view, teamRole, onSignOut }: GlobalHeaderProps) {
  const isCoach = !teamRole || teamRole === "coach";
  const visibleItems = navItems.filter((item) => !item.coachOnly || isCoach);

  return (
    <header className="global-header">
      <div>
        <p className="header-eyebrow">Flag Football Team Hub</p>
        <h1 className="header-title">FFFC 2025</h1>
      </div>

      <nav className="header-nav" aria-label="グローバルナビゲーション">
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            className={`tab-link ${view === item.view || ((view === "player-goal" || view === "player-reflection" || view === "player-season-goal") && item.view === "dashboard") || ((view === "players" || view === "masters" || view === "materials-manage") && item.view === "settings") ? "is-active" : ""}`}
            href={item.href}
          >
            <item.icon size={18} aria-hidden="true" />
            {item.label}
          </Link>
        ))}
        {onSignOut ? (
          <button className="tab-link" type="button" onClick={onSignOut}>
            <LogOut size={18} aria-hidden="true" />
            ログアウト
          </button>
        ) : null}
      </nav>
    </header>
  );
}
