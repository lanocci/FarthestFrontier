import { players } from "@/lib/mock-data";
import { getRecentGoalForPlayer } from "@/lib/utils";

export function PlayerList() {
  return (
    <div className="grid-cards">
      {players.map((player) => {
        const recentGoal = getRecentGoalForPlayer(player);

        return (
          <article className="player-card" key={player.id}>
            <div className="player-row">
              <div>
                <strong>{player.name}</strong>
                <div className="subtle">
                  {player.gradeLabel} / 保護者: {player.guardianName}
                </div>
              </div>
              <span className={`chip ${player.active ? "ok" : "warn"}`}>
                {player.active ? "在籍中" : "休会"}
              </span>
            </div>
            <div className="chip-row">
              <span className="chip">とくい: {player.favoriteSkill}</span>
              {recentGoal ? <span className="chip">最近の目標: {recentGoal.title}</span> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
