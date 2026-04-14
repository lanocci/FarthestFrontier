import { GoalLog, GoalTemplate, Player } from "@/lib/types";
import { findGoalTemplate, formatGoalTemplatePreview } from "@/lib/utils";

type GoalBoardProps = {
  goalTemplates: GoalTemplate[];
  goalLogs: GoalLog[];
  players: Player[];
  selectedTemplateId: string;
  goalInput: string;
  onSelectTemplate: (goalId: string) => void;
  onGoalInputChange: (value: string) => void;
  onSubmitGoal: () => void;
  disabled?: boolean;
};

export function GoalBoard({
  goalTemplates,
  goalLogs,
  players,
  selectedTemplateId,
  goalInput,
  onSelectTemplate,
  onGoalInputChange,
  onSubmitGoal,
  disabled,
}: GoalBoardProps) {
  const selectedTemplate = goalTemplates.find((template) => template.id === selectedTemplateId) ?? goalTemplates[0];

  const latestEntries = goalLogs
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((log) => {
      const player = players.find((item) => item.id === log.playerId);
      const goal = findGoalTemplate(log.goalTemplateId, goalTemplates);

      return {
        id: log.id,
        playerName: player?.name ?? "不明",
        goalTitle: log.goalText,
        templateTitle: goal?.title,
        date: log.date,
        note: log.note,
      };
    });

  return (
    <div className="stack">
      <div className="goal-actions">
        {goalTemplates.map((goal) => (
          <button
            className={`goal-tile ${selectedTemplateId === goal.id ? "selected-card" : ""}`}
            key={goal.id}
            type="button"
            onClick={() => onSelectTemplate(selectedTemplateId === goal.id ? "" : goal.id)}
            disabled={disabled}
          >
            <strong>
              {goal.emoji} {goal.title}
            </strong>
            <span>{goal.prompt}</span>
          </button>
        ))}
      </div>

      <div className="goal-composer">
        <div>
          <h3 className="section-title">今日の目標を入力</h3>
          <p className="section-copy">
            {selectedTemplate
              ? "テンプレートを選んでいるので、この入力欄は差し込み用です。テンプレート未選択なら自由入力としてそのまま登録できます。"
              : "テンプレート未選択なので、この入力欄は自由入力としてそのまま登録されます。"}
          </p>
        </div>
        <div className="inline-form inline-form-tight">
          <input
            type="text"
            placeholder={selectedTemplate?.inputPlaceholder ?? "今日の目標を自由入力"}
            value={goalInput}
            onChange={(event) => onGoalInputChange(event.target.value)}
            disabled={disabled}
          />
          <div className="preview-card">
            {selectedTemplate ? formatGoalTemplatePreview(selectedTemplate, goalInput) : goalInput.trim() || "ここに入力内容が表示されます"}
          </div>
          <button className="button" type="button" onClick={onSubmitGoal} disabled={disabled || (!selectedTemplate && !goalInput.trim())}>
            {selectedTemplate ? "テンプレートで登録" : "自由入力で登録"}
          </button>
        </div>
      </div>

      <div>
        <div className="divider" />
        <h3 className="section-title">さいきんの目標</h3>
        {latestEntries.length ? (
          <div className="mini-list">
            {latestEntries.map((entry) => (
              <article className="activity-card" key={entry.id}>
                <strong>
                  {entry.playerName}: {entry.goalTitle}
                </strong>
                {entry.templateTitle ? <div className="subtle">テンプレート: {entry.templateTitle}</div> : null}
                <div className="subtle">{entry.date}</div>
                {entry.note ? <div className="subtle">{entry.note}</div> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">まだ目標登録がありません。テンプレートか自由入力で、今日の目標をすぐ残せます。</p>
        )}
      </div>
    </div>
  );
}
