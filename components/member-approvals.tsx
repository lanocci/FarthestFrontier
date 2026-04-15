"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Section } from "@/components/section";
import { fetchPendingTeamMembers, updateTeamMemberStatus, type TeamMember } from "@/lib/data-store";
import type { TeamRole } from "@/lib/types";

type MemberApprovalsProps = {
  supabase: SupabaseClient | null;
  teamMessage: string | null;
  setTeamMessage: (message: string | null) => void;
};

export function MemberApprovals({ supabase, teamMessage, setTeamMessage }: MemberApprovalsProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    fetchPendingTeamMembers(supabase)
      .then((pendingMembers) => {
        setMembers(pendingMembers.filter((member) => member.status === "pending"));
      })
      .catch((error) => {
        setTeamMessage(error instanceof Error ? error.message : "承認待ち一覧の取得に失敗しました。");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [setTeamMessage, supabase]);

  async function handleUpdate(userId: string, status: "approved" | "rejected", role: TeamRole) {
    if (!supabase) {
      return;
    }

    try {
      setSavingUserId(userId);
      await updateTeamMemberStatus(supabase, userId, status, role);
      setMembers((current) => current.filter((member) => member.userId !== userId));
      setTeamMessage(status === "approved" ? "ユーザーを承認しました。" : "ユーザーを却下しました。");
    } catch (error) {
      setTeamMessage(error instanceof Error ? error.message : "承認更新に失敗しました。");
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <Section
      title="利用承認"
      copy="新しくサインアップしたユーザーは、ここで承認すると利用できるようになります。"
    >
      <div className="status-strip">
        <span className="chip">{loading ? "読込中" : `承認待ち ${members.length}件`}</span>
        {teamMessage ? <span className="subtle">{teamMessage}</span> : null}
      </div>

      {members.length ? (
        <div className="admin-player-list">
          {members.map((member) => (
            <div className="admin-player-item" key={member.userId}>
              <strong>{member.userId}</strong>
              <span>{member.role === "coach" ? "コーチ" : "保護者"}</span>
              <div className="card-actions">
                <button
                  className="button secondary button-compact"
                  type="button"
                  onClick={() => handleUpdate(member.userId, "approved", member.role)}
                  disabled={savingUserId === member.userId}
                >
                  承認
                </button>
                <button
                  className="button ghost button-compact"
                  type="button"
                  onClick={() => handleUpdate(member.userId, "rejected", member.role)}
                  disabled={savingUserId === member.userId}
                >
                  却下
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty-state">承認待ちのユーザーはいません。</p>
      )}
    </Section>
  );
}
