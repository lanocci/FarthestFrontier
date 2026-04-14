import { AppShell } from "@/components/app-shell";

export default async function PlayerReflectionsPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;

  return <AppShell view="player-reflection" playerId={playerId} />;
}
