-- Run this migration in the Supabase SQL Editor before deploying the static app.
-- It preserves existing data and makes browser access safe through RLS.

create extension if not exists pgcrypto;

alter table public.profiles
  alter column sex set default 'male',
  alter column age set default 30,
  alter column height_cm set default 175,
  alter column weight_kg set default 75,
  alter column activity_level set default 'moderate',
  alter column weight_frequency set default 3,
  alter column theme set default 'dark';

create index if not exists weight_logs_user_id_idx on public.weight_logs(user_id);
create index if not exists ingredients_user_id_idx on public.ingredients(user_id);
create index if not exists day_entries_user_id_idx on public.day_entries(user_id);
create index if not exists meal_templates_user_id_idx on public.meal_templates(user_id);

alter table public.profiles enable row level security;
alter table public.weight_logs enable row level security;
alter table public.ingredients enable row level security;
alter table public.day_entries enable row level security;
alter table public.meal_templates enable row level security;

revoke all on public.profiles from anon;
revoke all on public.weight_logs from anon;
revoke all on public.ingredients from anon;
revoke all on public.day_entries from anon;
revoke all on public.meal_templates from anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.weight_logs to authenticated;
grant select, insert, update, delete on public.ingredients to authenticated;
grant select, insert, update, delete on public.day_entries to authenticated;
grant select, insert, update, delete on public.meal_templates to authenticated;

-- Remove previous app policies so no permissive legacy rule remains active.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'weight_logs', 'ingredients', 'day_entries', 'meal_templates')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  end loop;
end
$$;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "weight_logs_select_own" on public.weight_logs;
drop policy if exists "weight_logs_insert_own" on public.weight_logs;
drop policy if exists "weight_logs_update_own" on public.weight_logs;
drop policy if exists "weight_logs_delete_own" on public.weight_logs;

create policy "weight_logs_select_own"
  on public.weight_logs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "weight_logs_insert_own"
  on public.weight_logs for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "weight_logs_update_own"
  on public.weight_logs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "weight_logs_delete_own"
  on public.weight_logs for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "ingredients_select_visible" on public.ingredients;
drop policy if exists "ingredients_insert_own" on public.ingredients;
drop policy if exists "ingredients_update_own" on public.ingredients;
drop policy if exists "ingredients_delete_own" on public.ingredients;

create policy "ingredients_select_visible"
  on public.ingredients for select to authenticated
  using (is_public = true or (select auth.uid()) = user_id);

create policy "ingredients_insert_own"
  on public.ingredients for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "ingredients_update_own"
  on public.ingredients for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "ingredients_delete_own"
  on public.ingredients for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "day_entries_select_own" on public.day_entries;
drop policy if exists "day_entries_insert_own" on public.day_entries;
drop policy if exists "day_entries_update_own" on public.day_entries;
drop policy if exists "day_entries_delete_own" on public.day_entries;

create policy "day_entries_select_own"
  on public.day_entries for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "day_entries_insert_own"
  on public.day_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "day_entries_update_own"
  on public.day_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "day_entries_delete_own"
  on public.day_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "meal_templates_select_own" on public.meal_templates;
drop policy if exists "meal_templates_insert_own" on public.meal_templates;
drop policy if exists "meal_templates_update_own" on public.meal_templates;
drop policy if exists "meal_templates_delete_own" on public.meal_templates;

create policy "meal_templates_select_own"
  on public.meal_templates for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "meal_templates_insert_own"
  on public.meal_templates for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "meal_templates_update_own"
  on public.meal_templates for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "meal_templates_delete_own"
  on public.meal_templates for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'Usuario')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
