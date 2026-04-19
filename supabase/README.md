# Supabase Workflow

このリポジトリでは、Supabase の正本は `supabase/migrations/` です。

## 現在の基準

- baseline migration: `supabase/migrations/20260419025848_remote_schema.sql`
- 参照用スナップショット: `supabase/schema.snapshot.sql`
- 退避済み旧初期案: `supabase/migrations_archive/20260419130000_initial_schema.sql`

## 今後の運用

1. 新しい変更は `supabase migration new <name>` で migration を作る
2. SQL を `supabase/migrations/<timestamp>_<name>.sql` に書く
3. `npm run db:push:dry` で確認する
4. 問題なければ `npm run db:push` で反映する

## 既存本番から移行した経緯

- 本番DBは先に SQL 直実行で運用されていました
- `supabase db pull` で remote schema を baseline migration として取り込みました
- `supabase migration repair 20260419025848 --status applied` で remote migration history を同期済みです

## 注意

- `supabase/schema.snapshot.sql` は参照用です。今後の変更はここへ直接積みません
- `supabase/migrations_archive/` のファイルは本番へ push しません
