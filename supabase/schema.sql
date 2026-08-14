create table if not exists public.presentations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  presentation jsonb not null,
  slide_count integer generated always as (
    jsonb_array_length(presentation -> 'slides')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint presentations_slides_array
    check (jsonb_typeof(presentation -> 'slides') = 'array')
);

create index if not exists presentations_user_updated_index
  on public.presentations (user_id, updated_at desc);

create or replace function public.set_presentations_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists presentations_set_updated_at on public.presentations;
create trigger presentations_set_updated_at
before update on public.presentations
for each row execute function public.set_presentations_updated_at();

alter table public.presentations enable row level security;

drop policy if exists "Users can read their presentations" on public.presentations;
create policy "Users can read their presentations"
on public.presentations
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their presentations" on public.presentations;
create policy "Users can create their presentations"
on public.presentations
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their presentations" on public.presentations;
create policy "Users can update their presentations"
on public.presentations
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their presentations" on public.presentations;
create policy "Users can delete their presentations"
on public.presentations
for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.presentations to authenticated;
revoke all on public.presentations from anon;
