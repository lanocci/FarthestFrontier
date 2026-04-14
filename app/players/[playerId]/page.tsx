import { AppShell } from "@/components/app-shell";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;

  return <AppShell view="player" playerId={playerId} />;
}
