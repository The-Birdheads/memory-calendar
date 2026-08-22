-- タスク9.1: todosスキーマと予定へのToDo追加

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  completed_at timestamptz,
  created_by uuid not null default auth.uid() references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.todos enable row level security;

create index todos_event_id_idx on public.todos (event_id);

create trigger set_todos_updated_at
  before update on public.todos
  for each row execute function public.set_current_timestamp_updated_at();

-- todos: calendar_idを直接持たないためevent_id経由でメンバーシップを判定する
create policy todos_select_member
  on public.todos
  for select
  to authenticated
  using (public.is_event_calendar_member(event_id, auth.uid()));

create policy todos_insert_member
  on public.todos
  for insert
  to authenticated
  with check (public.is_event_calendar_member(event_id, auth.uid()));
