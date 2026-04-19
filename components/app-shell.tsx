"use client";

import { AudiovisualRoom } from "@/components/audiovisual-room";
import { GlobalHeader } from "@/components/global-header";
import { MastersAdmin } from "@/components/masters-admin";
import { MaterialsLibrary } from "@/components/materials-library";
import { MaterialsRoom } from "@/components/materials-room";
import { PendingApprovalScreen } from "@/components/pending-approval-screen";
import { PlayerPracticeEditor } from "@/components/player-practice-editor";
import { SeasonGoalEditor } from "@/components/season-goal-editor";
import { SettingsRoom } from "@/components/settings-room";
import { TeamAdmin } from "@/components/team-admin";
import { TeamDashboard } from "@/components/team-dashboard";
import { useTeam } from "@/lib/team-context";

type AppShellProps = {
  view?: "dashboard" | "players" | "masters" | "materials" | "audiovisual" | "materials-manage" | "settings" | "player-goal" | "player-reflection" | "player-season-goal";
  playerId?: string;
  practiceDate?: string;
};

export function AppShell({ view = "dashboard", playerId, practiceDate }: AppShellProps) {
  const {
    players, setPlayers,
    materials, setMaterials,
    filmRoomVideos, setFilmRoomVideos,
    formationMasters, setFormationMasters,
    goalTemplates, setGoalTemplates,
    penaltyTypeMasters, setPenaltyTypeMasters,
    playTypeMasters, setPlayTypeMasters,
    positionMasters, setPositionMasters,
    seasons, setSeasons,
    seasonGoals, setSeasonGoals,
    session, teamRole, membershipStatus,
    linkedPlayerIds, registrationMessage, setRegistrationMessage,
    membershipResolved, authResolved, dataLoading,
    syncing, setSyncing,
    teamMessage, setTeamMessage,
    supabase, authEnabled, usingRemoteData,
    canManageAdmin, canEditPractice,
    resetLocalMode, handleSignOut,
  } = useTeam();

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
    return (
      <PendingApprovalScreen
        registrationMessage={registrationMessage}
        onMessageSaved={(msg) => setRegistrationMessage(msg)}
      />
    );
  }

  return (
    <main className="page-shell">
      <GlobalHeader view={view} onSignOut={authEnabled && session ? handleSignOut : undefined} />

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
          formationMasters={formationMasters}
          penaltyTypeMasters={penaltyTypeMasters}
          players={players}
          playTypeMasters={playTypeMasters}
          positionMasters={positionMasters}
          setFormationMasters={setFormationMasters}
          setGoalTemplates={setGoalTemplates}
          setPenaltyTypeMasters={setPenaltyTypeMasters}
          setPlayTypeMasters={setPlayTypeMasters}
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
          materials={materials}
          teamMessage={teamMessage}
        />
      ) : view === "audiovisual" ? (
        <AudiovisualRoom
          canManageTeam={canManageAdmin}
          dataLoading={dataLoading}
          filmRoomVideos={filmRoomVideos}
          formationMasters={formationMasters}
          penaltyTypeMasters={penaltyTypeMasters}
          players={players}
          playTypeMasters={playTypeMasters}
          positionMasters={positionMasters}
          setFilmRoomVideos={setFilmRoomVideos}
          setTeamMessage={setTeamMessage}
          supabase={supabase}
          syncing={syncing}
          setSyncing={setSyncing}
          teamMessage={teamMessage}
          usingRemoteData={usingRemoteData}
          onResetLocalMode={resetLocalMode}
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
          seasons={seasons}
          setSeasons={setSeasons}
          syncing={syncing}
          setSyncing={setSyncing}
          usingRemoteData={usingRemoteData}
        />
      ) : view === "player-goal" ? (
        <PlayerPracticeEditor
          mode="goal"
          initialPracticeDate={practiceDate}
          canManageTeam={canEditPractice}
          canEditPlayer={!authEnabled || teamRole === "coach" || linkedPlayerIds.includes(playerId ?? "")}
          linkedPlayerIds={linkedPlayerIds}
          goalTemplates={goalTemplates}
          player={players.find((player) => player.id === playerId) ?? null}
          positionMasters={positionMasters}
          seasons={seasons}
          seasonGoals={seasonGoals}
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
          canEditPlayer={!authEnabled || teamRole === "coach" || linkedPlayerIds.includes(playerId ?? "")}
          linkedPlayerIds={linkedPlayerIds}
          goalTemplates={goalTemplates}
          player={players.find((player) => player.id === playerId) ?? null}
          positionMasters={positionMasters}
          seasons={seasons}
          seasonGoals={seasonGoals}
          setPlayers={setPlayers}
          setTeamMessage={setTeamMessage}
          supabase={supabase}
          syncing={syncing}
          setSyncing={setSyncing}
          teamMessage={teamMessage}
          usingRemoteData={usingRemoteData}
        />
      ) : view === "player-season-goal" ? (
        <SeasonGoalEditor
          canEditPlayer={!authEnabled || teamRole === "coach" || linkedPlayerIds.includes(playerId ?? "")}
          player={players.find((player) => player.id === playerId) ?? null}
          positionMasters={positionMasters}
          seasons={seasons}
          seasonGoals={seasonGoals}
          setSeasonGoals={setSeasonGoals}
          setTeamMessage={setTeamMessage}
          supabase={supabase}
          syncing={syncing}
          setSyncing={setSyncing}
          teamMessage={teamMessage}
          usingRemoteData={usingRemoteData}
          linkedPlayerIds={linkedPlayerIds}
        />
      ) : (
        <TeamDashboard
          players={players}
          positionMasters={positionMasters}
          linkedPlayerIds={linkedPlayerIds}
          teamRole={teamRole}
          teamMessage={teamMessage}
          usingRemoteData={usingRemoteData}
          seasons={seasons}
          seasonGoals={seasonGoals}
          onResetLocalMode={resetLocalMode}
        />
      )}
    </main>
  );
}
