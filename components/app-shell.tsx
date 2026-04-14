"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { GlobalHeader } from "@/components/global-header";
import { LoginPanel } from "@/components/login-panel";
import { MastersAdmin } from "@/components/masters-admin";
import { PlayerPracticeEditor } from "@/components/player-practice-editor";
import { SetupPanel } from "@/components/setup-panel";
import { TeamAdmin } from "@/components/team-admin";
import { TeamDashboard } from "@/components/team-dashboard";
import { fetchTeamSnapshot, getFallbackTeamSnapshot } from "@/lib/data-store";
import { getSupabaseClient } from "@/lib/supabase";
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
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
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
      setAuthLoading(false);
      setAuthMessage("Supabase未設定のため、ローカル体験モードで動作中です。");
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) {
        return;
      }

      if (error) {
        setAuthMessage("セッション確認に失敗しました。");
      } else {
        setSession(data.session);
      }

      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
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

  async function sendMagicLink(email: string) {
    if (!supabase) {
      setAuthMessage("Supabaseが未設定です。.env.local を設定するとMagic Linkが使えます。");
      return;
    }

    const redirectTo = typeof window === "undefined" ? undefined : `${window.location.origin}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    setAuthMessage(error ? error.message : "ログインリンクを送信しました。メールを確認してください。");
  }

  async function signInWithGoogle() {
    if (!supabase) {
      setAuthMessage("Supabaseが未設定です。.env.local を設定するとGoogleログインが使えます。");
      return;
    }

    const redirectTo = typeof window === "undefined" ? undefined : `${window.location.origin}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (error) {
      setAuthMessage(error.message);
    }
  }

  async function signOut() {
    if (!supabase) {
      setSession(null);
      setAuthMessage("ローカル体験モードです。");
      return;
    }

    const { error } = await supabase.auth.signOut();
    setAuthMessage(error ? error.message : "ログアウトしました。");
  }

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

  const activePlayerCount = players.filter((player) => player.active).length;
  const reflectionCompletedCount = players.filter(
    (player) => player.offenseReflection?.trim() && player.defenseReflection?.trim(),
  ).length;
  const sharedMaterialCount = materials.length;
  const canManageTeam = !authEnabled || Boolean(session);

  return (
    <main className="page-shell">
      <GlobalHeader view={view} />

      <section className="hero">
        <span className="eyebrow">Flag Football Team Hub</span>
        <h2>目標をえらぶ、のこす、みんなで伸びる。</h2>
        <p>
          小学生のフラッグフットボールチーム向けに、練習の目標設定と資料共有をひとつにまとめたMVPです。簡単入力のまま、選手管理やマスター管理は別ページに切り分けています。
        </p>

        <div className="stats">
          <div className="stat-card">
            <strong>{activePlayerCount}</strong>
            <span>在籍中の選手</span>
          </div>
          <div className="stat-card">
            <strong>{reflectionCompletedCount}</strong>
            <span>振り返り完了</span>
          </div>
          <div className="stat-card">
            <strong>{sharedMaterialCount}</strong>
            <span>共有資料</span>
          </div>
        </div>

        {view === "dashboard" ? null : (
          <div className="hero-grid">
            <LoginPanel
              authEnabled={authEnabled}
              authLoading={authLoading}
              authMessage={authMessage}
              session={session}
              onSendMagicLink={sendMagicLink}
              onSignInWithGoogle={signInWithGoogle}
              onSignOut={signOut}
            />
            <SetupPanel />
          </div>
        )}
      </section>

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
          canManageTeam={canManageTeam}
          dataLoading={dataLoading}
          goalLogs={goalLogs}
          goalTemplates={goalTemplates}
          materials={materials}
          players={players}
          positionMasters={positionMasters}
          setTeamMessage={setTeamMessage}
          setGoalLogs={setGoalLogs}
          setMaterials={setMaterials}
          setPlayers={setPlayers}
          supabase={supabase}
          syncing={syncing}
          setSyncing={setSyncing}
          teamMessage={teamMessage}
          usingRemoteData={usingRemoteData}
          onResetLocalMode={resetLocalMode}
        />
      )}
    </main>
  );
}
