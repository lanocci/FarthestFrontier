import { goalLogs, goalTemplates, players } from "@/lib/mock-data";

export function GoalBoard() {
  const latestEntries = goalLogs
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((log) => {
      const player = players.find((item) => item.id === log.playerId);
      const goal = goalTemplates.find((item) => item.id === log.goalId);

      return {
        id: log.id,
        playerName: player?.name ?? "不明",
        goalTitle: goal?.title ?? "未設定",
        date: log.date,
        note: log.note,
      };
    });

  return (
    <div className="stack">
      <div className="goal-actions">
        {goalTemplates.map((goal) => (
          <button className="goal-tile" key={goal.id} type="button">
            <strong>
              {goal.emoji} {goal.title}
            </strong>
            <span>{goal.prompt}</span>
          </button>
        ))}
      </div>

      <div>
        <div className="divider" />
        <h3 className="section-title">さいきんの目標</h3>
        <div className="mini-list">
          {latestEntries.map((entry) => (
            <article className="activity-card" key={entry.id}>
              <strong>
                {entry.playerName}: {entry.goalTitle}
              </strong>
              <div className="subtle">{entry.date}</div>
              {entry.note ? <div className="subtle">{entry.note}</div> : null}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
