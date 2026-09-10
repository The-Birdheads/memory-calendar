-- 予定の思い出(写真)刷新: 1ユーザー1予定につき1枚まで、サムネイルは1予定につき1枚まで、
-- サムネイルの選択はカレンダーメンバーなら誰でもでき、削除は自分の写真のみできることを検証する

begin;
select plan(9);

select has_column('public', 'event_photos', 'is_thumbnail', 'event_photos.is_thumbnail 列が存在すること');

-- セットアップ: owner + memberが所属するカレンダーと実施済み予定
set local role postgres;
insert into auth.users (id) values
  ('66666666-7777-8888-9999-000000000001'), -- owner
  ('66666666-7777-8888-9999-000000000002'); -- 同じカレンダーの別メンバー

set local role authenticated;
set local request.jwt.claim.sub = '66666666-7777-8888-9999-000000000001';
insert into public.calendars (name) values ('思い出刷新検証用') returning id \gset cal43_
insert into public.events (calendar_id, title, start_at, end_at)
  values (:'cal43_id', '実施済み予定', '2026-01-01T10:00:00+00', '2026-01-01T11:00:00+00')
  returning id \gset event43_

set local role postgres;
insert into public.calendar_members (calendar_id, user_id, role)
  values (:'cal43_id'::uuid, '66666666-7777-8888-9999-000000000002', 'viewer');
set local role authenticated;
set local request.jwt.claim.sub = '66666666-7777-8888-9999-000000000001';

-- ownerが1枚追加する
insert into public.event_photos (event_id, storage_path)
  values (:'event43_id', :'event43_id' || '/owner.jpg')
  returning id \gset photoOwner43_

-- 同じユーザーが同じ予定にもう1枚追加しようとすると一意制約違反になる(1人1枚まで)
select throws_ok(
  format(
    $$ insert into public.event_photos (event_id, storage_path) values (%L, %L) $$,
    :'event43_id'::uuid,
    :'event43_id' || '/owner2.jpg'
  ),
  '23505',
  null,
  '同じユーザーが同じ予定に2枚目を追加しようとすると一意制約で拒否されること(1人1枚まで)'
);

-- 別メンバーは同じ予定に自分の1枚を追加できる
set local request.jwt.claim.sub = '66666666-7777-8888-9999-000000000002';
insert into public.event_photos (event_id, storage_path)
  values (:'event43_id', :'event43_id' || '/member.jpg')
  returning id \gset photoMember43_

select is(
  (select count(*) from public.event_photos where event_id = :'event43_id'::uuid),
  2::bigint,
  '別メンバーは同じ予定に自分の分の1枚を追加できること'
);

-- 別メンバーでも(自分の写真でなくても)カレンダーメンバーならサムネイルを設定できる
update public.event_photos set is_thumbnail = true where id = :'photoOwner43_id'::uuid;
select is(
  (select is_thumbnail from public.event_photos where id = :'photoOwner43_id'::uuid),
  true,
  '自分の写真でなくてもカレンダーメンバーならサムネイルに設定できること'
);

-- 同じ予定でもう1枚をサムネイルにしようとすると、先に解除しないと一意制約違反になる
select throws_ok(
  format(
    $$ update public.event_photos set is_thumbnail = true where id = %L $$,
    :'photoMember43_id'::uuid
  ),
  '23505',
  null,
  '解除せずに別の写真をサムネイルにしようとすると一意制約で拒否されること(1予定1枚まで)'
);

-- 正しい手順(解除してから設定)ならサムネイルを切り替えられる
update public.event_photos set is_thumbnail = false where id = :'photoOwner43_id'::uuid;
update public.event_photos set is_thumbnail = true where id = :'photoMember43_id'::uuid;
select is(
  (select count(*) from public.event_photos where event_id = :'event43_id'::uuid and is_thumbnail),
  1::bigint,
  '解除してから設定すればサムネイルを1枚だけに切り替えられること'
);
select is(
  (select is_thumbnail from public.event_photos where id = :'photoMember43_id'::uuid),
  true,
  '切り替え後、新しい方がサムネイルになっていること'
);

-- 自分の写真は自分で削除できる
set local request.jwt.claim.sub = '66666666-7777-8888-9999-000000000001';
delete from public.event_photos where id = :'photoOwner43_id'::uuid;
select is(
  (select count(*) from public.event_photos where id = :'photoOwner43_id'::uuid),
  0::bigint,
  '自分の写真を自分で削除できること'
);

-- 他人の写真は削除できない(削除ポリシーは uploaded_by = auth.uid() のみが対象で、
-- RLS上は対象行が存在しないのと同じ扱いになるため、エラーにはならず0件削除になる)
delete from public.event_photos where id = :'photoMember43_id'::uuid;
select is(
  (select count(*) from public.event_photos where id = :'photoMember43_id'::uuid),
  1::bigint,
  '他人の写真は削除ポリシーの対象外で実際には削除されないこと'
);

select * from finish();
rollback;
