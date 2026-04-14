import { AppShell } from "@/components/app-shell";

export default async function PlayerReflectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { playerId } = await params;
  const { date } = await searchParams;

  return <AppShell view="player-reflection" playerId={playerId} practiceDate={date} />;
}
