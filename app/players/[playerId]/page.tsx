import { redirect } from "next/navigation";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;

  redirect(`/players/${playerId}/goals`);
}
