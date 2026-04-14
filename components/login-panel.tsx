export function LoginPanel() {
  return (
    <div className="panel">
      <div className="panel-body">
        <h2 className="section-title">かんたんログイン</h2>
        <p className="section-copy">
          選手本人ではなく、まずは保護者やコーチが使う前提です。SupabaseのMagic LinkかGoogleログインに差し替えやすい形にしています。
        </p>
        <div className="login-card">
          <input type="email" placeholder="メールアドレス" aria-label="メールアドレス" />
          <button className="button" type="button">
            ログインリンクを送る
          </button>
          <button className="button secondary" type="button">
            Googleでログイン
          </button>
        </div>
        <p className="footer-note">
          低学年チーム向けなので、選手が自分でIDとパスワードを覚える運用は避ける想定です。
        </p>
      </div>
    </div>
  );
}
