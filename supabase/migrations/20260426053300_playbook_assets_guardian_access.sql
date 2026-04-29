-- 保護者アカウントにもプレーブックアセットの閲覧を許可する。
-- 従来は audience = 'coaches' のアセットはコーチのみ参照できたが、
-- 保護者がビデオルームでプレーを視聴する際に自動表示プレーブックが必要なため、
-- 承認済みチームメンバーであれば audience 問わずすべて読み取れるよう変更する。
-- 書き込み権限は引き続きコーチ専用のポリシー (playbook_assets_manage_coaches) で制限する。

drop policy if exists "playbook_assets_select_team_members" on public.playbook_assets;
create policy "playbook_assets_select_team_members"
on public.playbook_assets
for select
to authenticated
using (public.is_team_member());
