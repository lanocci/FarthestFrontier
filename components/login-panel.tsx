"use client";

import type { Session } from "@supabase/supabase-js";
import { useState } from "react";

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
  authLoading,
  session,
  onSendMagicLink,
  onSignInWithGoogle,
  onSignOut,
}: LoginPanelProps) {
  const [email, setEmail] = useState("");

  return (
    <div className="panel">
      <div className="panel-body">
        <h2 className="section-title">FFFC2025 ログイン</h2>
        <p className="section-copy">
          メールアドレスもしくはGoogleアカウントでログインしてください。
        </p>
        <p className="section-copy" style={{ fontSize: "0.8rem", opacity: 0.7 }}>
          ※ メールアドレスでのログインの場合は、入力されたメールアドレス宛にログインリンクが送信されます。
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
      </div>
    </div>
  );
}
