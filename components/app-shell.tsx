"use client";

import type { Session } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GlobalHeader } from "@/components/global-header";
import { MaterialsLibrary } from "@/components/materials-library";
import { MastersAdmin } from "@/components/masters-admin";
import { MaterialsRoom } from "@/components/materials-room";
import { PendingApprovalScreen } from "@/components/pending-approval-screen";
import { PlayerPracticeEditor } from "@/components/player-practice-editor";
import { SettingsRoom } from "@/components/settings-room";
import { TeamAdmin } from "@/components/team-admin";
import { TeamDashboard } from "@/components/team-dashboard";
import { fetchCurrentTeamMember, fetchTeamSnapshot, getFallbackTeamSnapshot } from "@/lib/data-store";
import {
  clearStorage,
  loadGoalLogs,
  loadGoalTemplates,
  loadMaterials,
  loadPlayers,
  loadPositionMasters,
  saveGoalLogs,
  saveGoalTemplates,
  saveMaterials,
  savePlayers,
  savePositionMasters,
} from "@/lib/storage";
import { getSupabaseClient } from "@/lib/supabase";
import { GoalLog, GoalTemplate, Material, MembershipStatus, Player, PositionMaster, TeamRole } from "@/lib/types";
import { filterMaterialsForRole } from "@/lib/utils";

type AppShellProps = {
  view?: "dashboard" | "players" | "masters" | "materials" | "materials-manage" | "settings" | "player-goal" | "player-reflection";
  playerId?: string;
  practiceDate?: string;
};

export function AppShell({ view = "dashboard", playerId, practiceDate }: AppShellProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [goalLogs, setGoalLogs] = useState<GoalLog[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [goalTemplates, setGoalTemplates] = useState<GoalTemplate[]>([]);
  const [positionMasters, setPositionMasters] = useState<PositionMaster[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [teamRole, setTeamRole] = useState<TeamRole | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | null>(null);
  const [membershipResolved, setMembershipResolved] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [teamMessage, setTeamMessage] = useState<string | null>(null);
  const [localReady, setLocalReady] = useState(false);

  const supabase = useMemo(() => getSupabaseClient(), []);
  const router = useRouter();
  const pathname = usePathname();
  const authEnabled = Boolean(supabase);
  const usingRemoteData = authEnabled && Boolean(session);

  useEffect(() => {
    setPlayers(loadPlayers());
    setGoalLogs(loadGoalLogs());
    setMaterials(loadMaterials());
    setGoalTemplates(loadGoalTemplates());
    setPositionMasters(loadPositionMasters());
    setLocalReady(true);
    setDataLoading(false);
  }, []);

  useEffect(() => {
    if (localReady && !usingRemoteData) {
      savePlayers(players);
    }
  }, [localReady, players, usingRemoteData]);

  useEffect(() => {
    if (localReady && !usingRemoteData) {
      saveGoalLogs(goalLogs);
    }
  }, [goalLogs, localReady, usingRemoteData]);

  useEffect(() => {
    if (localReady && !usingRemoteData) {
      saveMaterials(materials);
    }
  }, [localReady, materials, usingRemoteData]);

  useEffect(() => {
    if (localReady && !usingRemoteData) {
      saveGoalTemplates(goalTemplates);
      savePositionMasters(positionMasters);
    }
  }, [goalTemplates, localReady, positionMasters, usingRemoteData]);

  useEffect(() => {
    if (!supabase) {
      setAuthResolved(true);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) {
        return;
      }

      if (!error) {
        setSession(data.session);
      }

      setAuthResolved(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthResolved(true);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!authEnabled || !authResolved || session) {
      return;
    }

    const next = pathname && pathname !== "/" ? pathname : "/";
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [authEnabled, authResolved, pathname, router, session]);

  useEffect(() => {
    if (!supabase || !session) {
      setTeamRole(null);
      setMembershipStatus(null);
      setMembershipResolved(!authEnabled || !session);
      setTeamMessage(
        authEnabled
          ? "ログインするとSupabaseのチームデータを読み込みます。"
          : "ローカル体験モードではブラウザに保存されます。",
      );
      return;
    }

    const client: NonNullable<typeof supabase> = supabase;
    let mounted = true;

    async function syncTeam() {
      setDataLoading(true);
      setMembershipResolved(false);

      try {
        const member = await fetchCurrentTeamMember(client);
        const snapshot = await fetchTeamSnapshot(client);

        if (!mounted) {
          return;
        }

        setTeamRole(member?.role ?? null);
        setMembershipStatus(member?.status ?? null);
        setMembershipResolved(true);
        setPlayers(snapshot.players);
        setGoalLogs(snapshot.goalLogs);
        setMaterials(filterMaterialsForRole(snapshot.materials, member?.role ?? null));
        setGoalTemplates(snapshot.goalTemplates);
        setPositionMasters(snapshot.positionMasters);
        setTeamMessage("Supabaseのチームデータを読み込みました。");
      } catch (error) {
        if (!mounted) {
          return;
        }

        const message = error instanceof Error ? error.message : "チームデータの読み込みに失敗しました。";
        setMembershipResolved(true);
        setTeamMessage(`Supabase読込に失敗したため、直前のローカル状態を表示しています。${message}`);
      } finally {
        if (mounted) {
          setDataLoading(false);
        }
      }
    }

    syncTeam();

    return () => {
      mounted = false;
    };
  }, [authEnabled, session, supabase]);

  function resetLocalMode() {
    const fallback = getFallbackTeamSnapshot();
    clearStorage();
    setPlayers(fallback.players);
    setGoalLogs(fallback.goalLogs);
    setMaterials(fallback.materials);
    setGoalTemplates(fallback.goalTemplates);
    setPositionMasters(fallback.positionMasters);
    setTeamMessage("ローカル体験モードを初期データに戻しました。");
  }

  const canManageAdmin = !authEnabled || teamRole === "coach";
  const canEditPractice = !authEnabled || Boolean(session);

  if (authEnabled && (!authResolved || !session || !membershipResolved)) {
    return (
      <main className="page-shell">
        <div className="panel">
          <div className="panel-body">
            <h2 className="section-title">ログインを確認しています</h2>
            <p className="section-copy">セッションと利用状態を確認しています。</p>
          </div>
        </div>
      </main>
    );
  }

  if (authEnabled && session && membershipStatus !== "approved") {
    return <PendingApprovalScreen />;
  }

  return (
    <main className="page-shell">
      <GlobalHeader view={view} />

      {view === "players" ? (
        <TeamAdmin
          canManageTeam={canManageAdmin}
          dataLoading={dataLoading}
          players={players}
          positionMasters={positionMasters}
          setPlayers={setPlayers}
          setTeamMessage={setTeamMessage}
          supabase={supabase}
          syncing={syncing}
          setSyncing={setSyncing}
          teamMessage={teamMessage}
          usingRemoteData={usingRemoteData}
          onResetLocalMode={resetLocalMode}
        />
      ) : view === "masters" ? (
        <MastersAdmin
          canManageTeam={canManageAdmin}
          dataLoading={dataLoading}
          goalTemplates={goalTemplates}
          players={players}
          positionMasters={positionMasters}
          setGoalTemplates={setGoalTemplates}
          setPositionMasters={setPositionMasters}
          setTeamMessage={setTeamMessage}
          supabase={supabase}
          syncing={syncing}
          setSyncing={setSyncing}
          teamMessage={teamMessage}
          usingRemoteData={usingRemoteData}
          onResetLocalMode={resetLocalMode}
        />
      ) : view === "materials" ? (
        <MaterialsLibrary
          dataLoading={dataLoading}
          materials={materials}
          teamMessage={teamMessage}
        />
      ) : view === "materials-manage" ? (
        <MaterialsRoom
          canManageTeam={canManageAdmin}
          dataLoading={dataLoading}
          materials={materials}
          setMaterials={setMaterials}
          setTeamMessage={setTeamMessage}
          supabase={supabase}
          syncing={syncing}
          setSyncing={setSyncing}
          teamMessage={teamMessage}
          usingRemoteData={usingRemoteData}
          onResetLocalMode={resetLocalMode}
        />
      ) : view === "settings" ? (
        <SettingsRoom
          canManageAdmin={canManageAdmin}
          supabase={supabase}
          teamMessage={teamMessage}
          setTeamMessage={setTeamMessage}
        />
      ) : view === "player-goal" ? (
        <PlayerPracticeEditor
          mode="goal"
          initialPracticeDate={practiceDate}
          canManageTeam={canEditPractice}
          goalTemplates={goalTemplates}
          player={players.find((player) => player.id === playerId) ?? null}
          positionMasters={positionMasters}
          setPlayers={setPlayers}
          setTeamMessage={setTeamMessage}
          supabase={supabase}
          syncing={syncing}
          setSyncing={setSyncing}
          teamMessage={teamMessage}
          usingRemoteData={usingRemoteData}
        />
      ) : view === "player-reflection" ? (
        <PlayerPracticeEditor
          mode="reflection"
          initialPracticeDate={practiceDate}
          canManageTeam={canEditPractice}
          goalTemplates={goalTemplates}
          player={players.find((player) => player.id === playerId) ?? null}
          positionMasters={positionMasters}
          setPlayers={setPlayers}
          setTeamMessage={setTeamMessage}
          supabase={supabase}
          syncing={syncing}
          setSyncing={setSyncing}
          teamMessage={teamMessage}
          usingRemoteData={usingRemoteData}
        />
      ) : (
        <TeamDashboard
          dataLoading={dataLoading}
          players={players}
          positionMasters={positionMasters}
          teamMessage={teamMessage}
          usingRemoteData={usingRemoteData}
          onResetLocalMode={resetLocalMode}
        />
      )}
    </main>
  );
}
