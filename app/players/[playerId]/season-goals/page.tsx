import { AppShell } from "@/components/app-shell";

export default async function PlayerSeasonGoalsPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;

  return <AppShell view="player-season-goal" playerId={playerId} />;
}
