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
        <h2 className="section-title">ログイン</h2>
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
      </div>
    </div>
  );
}
