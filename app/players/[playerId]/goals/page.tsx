import { AppShell } from "@/components/app-shell";

export default async function PlayerGoalsPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;

  return <AppShell view="player-goal" playerId={playerId} />;
}
