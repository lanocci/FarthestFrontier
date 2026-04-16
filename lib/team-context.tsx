"use client";

import { ensurePendingTeamMember, fetchCurrentTeamMember, fetchTeamSnapshot, getFallbackTeamSnapshot } from "@/lib/data-store";
import {
    clearStorage,
    loadGoalLogs,
    loadGoalTemplates,
    loadMaterials,
    loadPlayers,
    loadPositionMasters,
    loadSeasonGoals,
    loadSeasons,
    saveGoalLogs,
    saveGoalTemplates,
    saveMaterials,
    savePlayers,
    savePositionMasters,
    saveSeasonGoals,
    saveSeasons,
} from "@/lib/storage";
import { getSupabaseClient } from "@/lib/supabase";
import { GoalLog, GoalTemplate, Material, MembershipStatus, Player, PositionMaster, Season, SeasonGoal, TeamRole } from "@/lib/types";
import { filterMaterialsForRole } from "@/lib/utils";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

interface TeamContextValue {
  players: Player[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  goalLogs: GoalLog[];
  setGoalLogs: React.Dispatch<React.SetStateAction<GoalLog[]>>;
  materials: Material[];
  setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
  goalTemplates: GoalTemplate[];
  setGoalTemplates: React.Dispatch<React.SetStateAction<GoalTemplate[]>>;
  positionMasters: PositionMaster[];
  setPositionMasters: React.Dispatch<React.SetStateAction<PositionMaster[]>>;
  seasons: Season[];
  setSeasons: React.Dispatch<React.SetStateAction<Season[]>>;
  seasonGoals: SeasonGoal[];
  setSeasonGoals: React.Dispatch<React.SetStateAction<SeasonGoal[]>>;
  session: Session | null;
  teamRole: TeamRole | null;
  membershipStatus: MembershipStatus | null;
  linkedPlayerIds: string[];
  registrationMessage: string | undefined;
  setRegistrationMessage: React.Dispatch<React.SetStateAction<string | undefined>>;
  membershipResolved: boolean;
  authResolved: boolean;
  dataLoading: boolean;
  syncing: boolean;
  setSyncing: React.Dispatch<React.SetStateAction<boolean>>;
  teamMessage: string | null;
  setTeamMessage: React.Dispatch<React.SetStateAction<string | null>>;
  supabase: SupabaseClient | null;
  authEnabled: boolean;
  usingRemoteData: boolean;
  canManageAdmin: boolean;
  canEditPractice: boolean;
  resetLocalMode: () => void;
  handleSignOut: () => Promise<void>;
}

const TeamContext = createContext<TeamContextValue | null>(null);

export function useTeam(): TeamContextValue {
  const ctx = useContext(TeamContext);
  if (!ctx) {
    throw new Error("useTeam must be used within a TeamProvider");
  }
  return ctx;
}

export function TeamProvider({ children }: { children: ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [goalLogs, setGoalLogs] = useState<GoalLog[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [goalTemplates, setGoalTemplates] = useState<GoalTemplate[]>([]);
  const [positionMasters, setPositionMasters] = useState<PositionMaster[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonGoals, setSeasonGoals] = useState<SeasonGoal[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [teamRole, setTeamRole] = useState<TeamRole | null>(null);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | null>(null);
  const [linkedPlayerIds, setLinkedPlayerIds] = useState<string[]>([]);
  const [registrationMessage, setRegistrationMessage] = useState<string | undefined>(undefined);
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

  // Track whether we've already synced team data for the current session
  const teamSyncedRef = useRef(false);

  // Load local data once on mount
  useEffect(() => {
    setPlayers(loadPlayers());
    setGoalLogs(loadGoalLogs());
    setMaterials(loadMaterials());
    setGoalTemplates(loadGoalTemplates());
    setPositionMasters(loadPositionMasters());
    setSeasons(loadSeasons());
    setSeasonGoals(loadSeasonGoals());
    setLocalReady(true);
    setDataLoading(false);
  }, []);

  // Persist to localStorage when not using remote data
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
    if (localReady && !usingRemoteData) {
      saveSeasons(seasons);
      saveSeasonGoals(seasonGoals);
    }
  }, [localReady, seasonGoals, seasons, usingRemoteData]);

  // Auth: resolve session once, then listen for changes
  useEffect(() => {
    if (!supabase) {
      setAuthResolved(true);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (!error) setSession(data.session);
      setAuthResolved(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // If the session identity changed, allow a fresh team sync
      setSession((prev) => {
        if (prev?.user?.id !== nextSession?.user?.id) {
          teamSyncedRef.current = false;
        }
        return nextSession;
      });
      setAuthResolved(true);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [supabase]);

  // Redirect to login when auth is enabled but no session
  useEffect(() => {
    if (!authEnabled || !authResolved || session) return;
    const next = pathname && pathname !== "/" ? pathname : "/";
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [authEnabled, authResolved, pathname, router, session]);

  // Sync team data only once per session (not on every navigation)
  useEffect(() => {
    if (!supabase || !session) {
      setTeamRole(null);
      setMembershipStatus(null);
      setLinkedPlayerIds([]);
      setMembershipResolved(!authEnabled || !session);
      setTeamMessage(null);
      teamSyncedRef.current = false;
      return;
    }

    // Skip if we already synced for this session
    if (teamSyncedRef.current) return;

    const client: NonNullable<typeof supabase> = supabase;
    let mounted = true;

    async function syncTeam() {
      setDataLoading(true);
      setMembershipResolved(false);

      try {
        const member = (await fetchCurrentTeamMember(client)) ?? (await ensurePendingTeamMember(client));
        const snapshot = await fetchTeamSnapshot(client);

        if (!mounted) return;

        setTeamRole(member?.role ?? null);
        setMembershipStatus(member?.status ?? null);
        setLinkedPlayerIds(member?.playerIds ?? []);
        setRegistrationMessage(member?.registrationMessage);
        setMembershipResolved(true);
        setPlayers(snapshot.players);
        setGoalLogs(snapshot.goalLogs);
        setMaterials(filterMaterialsForRole(snapshot.materials, member?.role ?? null));
        setGoalTemplates(snapshot.goalTemplates);
        setPositionMasters(snapshot.positionMasters);
        setSeasons(snapshot.seasons);
        setSeasonGoals(snapshot.seasonGoals);
        teamSyncedRef.current = true;
      } catch (error) {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : "チームデータの読み込みに失敗しました。";
        setMembershipResolved(true);
        setTeamMessage(`Supabase読込に失敗したため、直前のローカル状態を表示しています。${message}`);
      } finally {
        if (mounted) setDataLoading(false);
      }
    }

    syncTeam();

    return () => { mounted = false; };
  }, [authEnabled, session, supabase]);

  function resetLocalMode() {
    const fallback = getFallbackTeamSnapshot();
    clearStorage();
    setPlayers(fallback.players);
    setGoalLogs(fallback.goalLogs);
    setMaterials(fallback.materials);
    setGoalTemplates(fallback.goalTemplates);
    setPositionMasters(fallback.positionMasters);
    setSeasons(fallback.seasons);
    setSeasonGoals(fallback.seasonGoals);
    setTeamMessage("ローカル体験モードを初期データに戻しました。");
  }

  async function handleSignOut() {
    if (!supabase) return;
    teamSyncedRef.current = false;
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const canManageAdmin = !authEnabled || teamRole === "coach";
  const canEditPractice = !authEnabled || Boolean(session);

  const value: TeamContextValue = {
    players, setPlayers,
    goalLogs, setGoalLogs,
    materials, setMaterials,
    goalTemplates, setGoalTemplates,
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
  };

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}
