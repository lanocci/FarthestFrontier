"use client";

import { useMemo } from "react";
import { getSupabaseClient } from "@/lib/supabase";

export function PendingApprovalScreen() {
  const supabase = useMemo(() => getSupabaseClient(), []);

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="page-shell login-page-shell">
      <div className="panel">
        <div className="panel-body">
          <h2 className="section-title">承認待ちです</h2>
          <p className="section-copy">
            サインアップは完了しています。コーチが承認すると利用できるようになります。
          </p>
          <div className="card-actions">
            <button className="button secondary" type="button" onClick={handleSignOut}>
              ログアウト
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
