"use client";

import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { GlobalHeader } from "@/components/global-header";
import { MastersAdmin } from "@/components/masters-admin";
import { PlayerPracticeEditor } from "@/components/player-practice-editor";
import { TeamAdmin } from "@/components/team-admin";
import { TeamDashboard } from "@/components/team-dashboard";
import { fetchTeamSnapshot, getFallbackTeamSnapshot } from "@/lib/data-store";
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
import { GoalLog, GoalTemplate, Material, Player, PositionMaster } from "@/lib/types";

type AppShellProps = {
  view?: "dashboard" | "players" | "masters" | "player";
  playerId?: string;
};

export function AppShell({ view = "dashboard", playerId }: AppShellProps) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [goalLogs, setGoalLogs] = useState<GoalLog[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [goalTemplates, setGoalTemplates] = useState<GoalTemplate[]>([]);
  const [positionMasters, setPositionMasters] = useState<PositionMaster[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [teamMessage, setTeamMessage] = useState<string | null>(null);
  const [localReady, setLocalReady] = useState(false);

  const supabase = useMemo(() => getSupabaseClient(), []);
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
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !session) {
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

      try {
        const snapshot = await fetchTeamSnapshot(client);

        if (!mounted) {
          return;
        }

        setPlayers(snapshot.players);
        setGoalLogs(snapshot.goalLogs);
        setMaterials(snapshot.materials);
        setGoalTemplates(
          snapshot.goalTemplates.length ? snapshot.goalTemplates : getFallbackTeamSnapshot().goalTemplates,
        );
        setPositionMasters(
          snapshot.positionMasters.length
            ? snapshot.positionMasters
            : getFallbackTeamSnapshot().positionMasters,
        );
        setTeamMessage("Supabaseのチームデータを読み込みました。");
      } catch (error) {
        if (!mounted) {
          return;
        }

        const message = error instanceof Error ? error.message : "チームデータの読み込みに失敗しました。";
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

  const canManageTeam = !authEnabled || Boolean(session);

  return (
    <main className="page-shell">
      <GlobalHeader view={view} />

      {view === "players" ? (
        <TeamAdmin
          canManageTeam={canManageTeam}
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
          canManageTeam={canManageTeam}
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
      ) : view === "player" ? (
        <PlayerPracticeEditor
          canManageTeam={canManageTeam}
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
