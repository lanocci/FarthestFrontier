"use client";

import { useMemo, useState } from "react";
import { updateRegistrationMessage } from "@/lib/data-store";
import { getSupabaseClient } from "@/lib/supabase";

type PendingApprovalScreenProps = {
  registrationMessage?: string;
  onMessageSaved?: (message: string) => void;
};

export function PendingApprovalScreen({
  registrationMessage,
  onMessageSaved,
}: PendingApprovalScreenProps) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  async function handleSubmitMessage() {
    if (!supabase || !message.trim()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await updateRegistrationMessage(supabase, message.trim());
      onMessageSaved?.(message.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "メッセージの保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  const hasMessage = Boolean(registrationMessage);

  return (
    <main className="page-shell login-page-shell">
      <div className="panel">
        <div className="panel-body">
          <h2 className="section-title">
            {hasMessage ? "承認待ちです" : "登録メッセージを入力してください"}
          </h2>

          {hasMessage ? (
            <>
              <p className="section-copy">
                サインアップは完了しています。コーチが承認すると利用できるようになります。
              </p>
              <div className="registration-message-display">
                <span className="registration-message-label">送信済みメッセージ:</span>
                <p className="registration-message-text">{registrationMessage}</p>
              </div>
            </>
          ) : (
            <>
              <p className="section-copy">
                コーチがどなたの保護者かわかるよう、お子さまのお名前などをお書きください。
              </p>
              <div className="form-field">
                <textarea
                  id="registration-message"
                  className="form-textarea"
                  placeholder="例: 〇〇の父です"
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={saving}
                />
              </div>
              {error ? <p className="form-error">{error}</p> : null}
              <div className="card-actions">
                <button
                  className="button primary"
                  type="button"
                  onClick={handleSubmitMessage}
                  disabled={saving || !message.trim()}
                >
                  {saving ? "送信中…" : "送信する"}
                </button>
              </div>
            </>
          )}

          <div className="card-actions" style={{ marginTop: "var(--space-md)" }}>
            <button className="button secondary" type="button" onClick={handleSignOut}>
              ログアウト
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

