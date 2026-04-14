"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";

type LoginPanelProps = {
  authEnabled: boolean;
  authLoading: boolean;
  authMessage: string | null;
  session: Session | null;
  onSendMagicLink: (email: string) => Promise<void>;
  onSignInWithGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
};

export function LoginPanel({
  authEnabled,
  authLoading,
  authMessage,
  session,
  onSendMagicLink,
  onSignInWithGoogle,
  onSignOut,
}: LoginPanelProps) {
  const [email, setEmail] = useState("");
  const accountLabel = session?.user.email ?? "未ログイン";

  return (
    <div className="panel">
      <div className="panel-body">
        <h2 className="section-title">かんたんログイン</h2>
        <p className="section-copy">
          選手本人ではなく、まずは保護者やコーチが使う前提です。SupabaseのMagic LinkかGoogleログインに差し替えやすい形にしています。
        </p>
        <div className="login-card">
          <input
            type="email"
            placeholder="メールアドレス"
            aria-label="メールアドレス"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={authLoading}
          />
          <button
            className="button"
            type="button"
            onClick={() => onSendMagicLink(email)}
            disabled={authLoading || !email.trim()}
          >
            ログインリンクを送る
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={onSignInWithGoogle}
            disabled={authLoading}
          >
            Googleでログイン
          </button>
          {session ? (
            <button className="button ghost" type="button" onClick={onSignOut}>
              ログアウト
            </button>
          ) : null}
        </div>
        <div className="login-status">
          <span className={`chip ${session ? "ok" : authEnabled ? "warn" : ""}`}>
            {authLoading ? "セッション確認中" : authEnabled ? "Supabase認証あり" : "ローカル体験モード"}
          </span>
          <span className="subtle">現在: {accountLabel}</span>
        </div>
        {authMessage ? <p className="footer-note">{authMessage}</p> : null}
        <p className="footer-note">
          低学年チーム向けなので、選手が自分でIDとパスワードを覚える運用は避ける想定です。
        </p>
      </div>
    </div>
  );
}
