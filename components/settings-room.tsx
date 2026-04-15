"use client";

import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MemberApprovals } from "@/components/member-approvals";
import { Section } from "@/components/section";

type SettingsRoomProps = {
  canManageAdmin: boolean;
  supabase: SupabaseClient | null;
  teamMessage: string | null;
  setTeamMessage: (message: string | null) => void;
};

export function SettingsRoom({ canManageAdmin, supabase, teamMessage, setTeamMessage }: SettingsRoomProps) {
  return (
    <div className="dashboard dashboard-wide">
      <div className="stack">
        <Section
          title="設定"
          copy="ふだんは使わない管理系の画面を、ここにまとめています。選手、資料、マスターの編集が必要なときだけ開いてください。"
        >
          <div className="status-strip">
            {teamMessage ? <span className="subtle">{teamMessage}</span> : null}
          </div>

          {canManageAdmin ? (
            <div className="settings-grid">
              <Link className="settings-card" href="/materials/manage">
                <strong>資料管理</strong>
                <span>共有資料の追加や確認を行います。Google 資料の URL もここから登録します。</span>
              </Link>

              <Link className="settings-card" href="/players">
                <strong>選手管理</strong>
                <span>選手の追加、背番号、学年、攻守ポジション、在籍状態を変更します。</span>
              </Link>

              <Link className="settings-card" href="/masters">
                <strong>マスター管理</strong>
                <span>ポジションや目標テンプレートの候補を調整します。</span>
              </Link>
            </div>
          ) : (
            <p className="empty-state">この画面はコーチ権限のあるアカウントだけが利用できます。</p>
          )}
        </Section>

        {canManageAdmin ? (
          <MemberApprovals
            supabase={supabase}
            teamMessage={teamMessage}
            setTeamMessage={setTeamMessage}
          />
        ) : null}
      </div>
    </div>
  );
}
