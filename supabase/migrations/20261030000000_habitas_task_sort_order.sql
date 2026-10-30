-- Habitas 1.4.0: 記録画面で、習慣・タスクを自分で並べ替える(並び順「自分で並べる」)
-- 小さいほど上。並べ替えたことのないものは null(優先度順で、並べたものの下に出る)
alter table habitas.tasks
  add column sort_order double precision;
