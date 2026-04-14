# Farthest Frontier

小学生のフラッグフットボールチーム向けに、目標設定と資料共有を支える Next.js MVP です。

## 想定スタック

- Next.js (App Router)
- Vercel
- Supabase Auth / Database
- Google Slides / Sheets をリンク管理

## 画面の意図

- ログイン: Magic Link / Googleログインを想定
- 選手一覧: 追加削除や在籍管理の入口
- 今日の目標: 低学年でも選べる大きいボタン中心
- 共有資料: Google資料のURLと公開対象を管理

## セットアップ

```bash
npm install
cp .env.example .env.local
npm run dev
```

## 環境変数

`.env.local` に以下を設定します。

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

環境変数が未設定でも、現時点ではローカル体験モードで画面表示と `localStorage` 保存ができます。

## Supabase 反映の入口

- SQL は [schema.sql](</Users/lanocci/dev/src/github.com/lanocci/ FarthestFrontier/supabase/schema.sql>) に置いてあります
- まずは `players`, `goal_templates`, `goal_logs`, `materials` の4テーブルで運用開始できます
- Google資料はDBにURLだけ持たせて、共有権限はGoogle Drive側でも制御する想定です

## 認証の動作

- `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を設定すると Magic Link / Google ログインが使えます
- 未設定のときはローカル体験モードで動作し、選手や資料の編集内容はブラウザの `localStorage` に保存されます
