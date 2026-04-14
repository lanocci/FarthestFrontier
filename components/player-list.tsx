import { Player, PositionMaster } from "@/lib/types";
import { getPositionLabel, getRecentGoalForPlayer } from "@/lib/utils";

type PlayerListProps = {
  players: Player[];
  positionMasters: PositionMaster[];
  selectedPlayerId?: string;
  onSelectPlayer?: (playerId: string) => void;
};

export function PlayerList({
  players,
  positionMasters,
  selectedPlayerId,
  onSelectPlayer,
}: PlayerListProps) {
  if (!players.length) {
    return <p className="empty-state">まだ選手がいません。選手管理ページから最初の1人を追加できます。</p>;
  }

  return (
    <div className="grid-cards">
      {players.map((player) => {
        const recentGoal = getRecentGoalForPlayer(player);

        return (
          <article className={`player-card ${selectedPlayerId === player.id ? "selected-card" : ""}`} key={player.id}>
            <div className="player-row">
              <div>
                <strong>{player.name}</strong>
                <div className="subtle">
                  {player.gradeLabel} / 保護者: {player.guardianName}
                </div>
              </div>
              <span className={`chip ${player.active ? "ok" : "warn"}`}>{player.active ? "在籍中" : "休会"}</span>
            </div>
            <div className="chip-row">
              <span className="chip">とくい: {player.favoriteSkill}</span>
              <span className="chip">オフェンス: {getPositionLabel(player.offensePositionId, positionMasters)}</span>
              <span className="chip">ディフェンス: {getPositionLabel(player.defensePositionId, positionMasters)}</span>
              {recentGoal ? <span className="chip">最近の目標: {recentGoal}</span> : null}
            </div>
            <div className="card-actions">
              <button className="button secondary" type="button" onClick={() => onSelectPlayer?.(player.id)}>
                この選手を選ぶ
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
