const steps = [
  "Supabaseでプロジェクト作成",
  "Magic Link または Googleログインを有効化",
  "players / goals / materials テーブルを作成",
  "Google資料はURLだけ保存してDrive権限を併用",
  "Vercelに環境変数を設定して公開",
];

export function SetupPanel() {
  return (
    <div className="panel">
      <div className="panel-body">
        <h2 className="section-title">次のセットアップ</h2>
        <p className="section-copy">
          今回のMVPはローカル体験モードでも動きます。Supabase接続を有効にすると、ログイン後に同じ画面からチームデータを共有管理できます。
        </p>
        <div className="mini-list">
          {steps.map((step, index) => (
            <article className="activity-card" key={step}>
              <strong>{index + 1}. {step}</strong>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
