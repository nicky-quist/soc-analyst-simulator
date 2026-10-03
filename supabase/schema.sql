-- SEA SOC online leaderboard schema.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: every statement is idempotent.
--
-- Design:
--   * One row of standings per player (blue, red, fast triage, secrets). The
--     app ranks them with the same comparators as the offline roster.
--   * No client can write to a table directly. Every write goes through a
--     SECURITY DEFINER function that validates its input.
--   * The only public read is get_standings(): display names and standings.
--     Emails live in auth.users and are never exposed.
--   * Club-only ranking is gated by a club code you set (see the bottom).

-- ── Tables ──────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null,
  club_member   boolean not null default false,
  hidden        boolean not null default false,   -- moderation: hide from boards
  created_at    timestamptz not null default now(),
  constraint display_name_format check (display_name ~ '^[A-Za-z0-9_ .-]{3,20}$')
);
create unique index if not exists profiles_display_name_ci
  on public.profiles (lower(display_name));

create table if not exists public.standings (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  blue_rank          integer not null default 0 check (blue_rank between 0 and 2),
  blue_cleared       integer not null default 0 check (blue_cleared between 0 and 100),
  blue_avg           numeric check (blue_avg between 0 and 100),
  red_rank           integer not null default 0 check (red_rank between 0 and 2),
  red_cleared        integer not null default 0 check (red_cleared between 0 and 100),
  red_ghosts         integer not null default 0 check (red_ghosts between 0 and 1000),
  red_best           integer check (red_best between 0 and 100),
  fast_best          integer check (fast_best between 0 and 100),
  fast_avg_seconds   numeric check (fast_avg_seconds between 0 and 3600),
  fast_runs          integer not null default 0 check (fast_runs between 0 and 1000),
  secrets            integer not null default 0 check (secrets between 0 and 200),
  updated_at         timestamptz not null default now()
);

create table if not exists public.app_settings (
  key    text primary key,
  value  text not null
);

-- ── Row level security: lock everything down ───────────────────────────

alter table public.profiles      enable row level security;
alter table public.standings     enable row level security;
alter table public.app_settings  enable row level security;

revoke all on public.profiles, public.standings, public.app_settings
  from anon, authenticated;

-- A signed-in user may read only their own rows. Nothing is writable.
grant select on public.profiles, public.standings to authenticated;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "read own standing" on public.standings;
create policy "read own standing" on public.standings
  for select to authenticated using (user_id = auth.uid());

-- app_settings has no policies: unreadable to every client.

-- ── Functions (the only write path) ────────────────────────────────────

-- Create or rename your profile.
create or replace function public.set_display_name(p_name text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  p_name := btrim(p_name);
  if p_name !~ '^[A-Za-z0-9_ .-]{3,20}$' then
    raise exception 'Display name must be 3-20 characters: letters, numbers, spaces, . _ -';
  end if;
  if exists (select 1 from public.profiles
             where lower(display_name) = lower(p_name) and id <> auth.uid()) then
    raise exception 'That name is taken';
  end if;
  insert into public.profiles (id, display_name) values (auth.uid(), p_name)
  on conflict (id) do update set display_name = excluded.display_name;
end;
$$;

-- Join the club ranking with the shared code.
create or replace function public.join_club(p_code text)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare expected text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select value into expected from public.app_settings where key = 'club_code';
  if expected is null or lower(btrim(p_code)) <> lower(expected) then
    return false;
  end if;
  update public.profiles set club_member = true where id = auth.uid();
  return found;
end;
$$;

-- Publish your standings. The table's check constraints reject out-of-range
-- values; nulls mean "no data yet" (for example, no Fast Triage run).
create or replace function public.submit_standing(p_standing jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare s jsonb := coalesce(p_standing, '{}'::jsonb);
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Choose a display name first';
  end if;
  insert into public.standings as t (
    user_id, blue_rank, blue_cleared, blue_avg, red_rank, red_cleared, red_ghosts,
    red_best, fast_best, fast_avg_seconds, fast_runs, secrets, updated_at
  ) values (
    auth.uid(),
    coalesce((s->>'blue_rank')::int, 0),
    coalesce((s->>'blue_cleared')::int, 0),
    (s->>'blue_avg')::numeric,
    coalesce((s->>'red_rank')::int, 0),
    coalesce((s->>'red_cleared')::int, 0),
    coalesce((s->>'red_ghosts')::int, 0),
    (s->>'red_best')::int,
    (s->>'fast_best')::int,
    (s->>'fast_avg_seconds')::numeric,
    coalesce((s->>'fast_runs')::int, 0),
    coalesce((s->>'secrets')::int, 0),
    now()
  )
  on conflict (user_id) do update set
    blue_rank = excluded.blue_rank, blue_cleared = excluded.blue_cleared,
    blue_avg = excluded.blue_avg, red_rank = excluded.red_rank,
    red_cleared = excluded.red_cleared, red_ghosts = excluded.red_ghosts,
    red_best = excluded.red_best, fast_best = excluded.fast_best,
    fast_avg_seconds = excluded.fast_avg_seconds, fast_runs = excluded.fast_runs,
    secrets = excluded.secrets, updated_at = now()
  -- Throttle: at most one write per player every two seconds.
  where t.updated_at < now() - interval '2 seconds';
end;
$$;

-- Public read: display names and standings only. Players with no standing yet
-- are not listed.
create or replace function public.get_standings(p_club_only boolean default false)
returns table (
  display_name text, club_member boolean, is_me boolean,
  blue_rank integer, blue_cleared integer, blue_avg numeric,
  red_rank integer, red_cleared integer, red_ghosts integer, red_best integer,
  fast_best integer, fast_avg_seconds numeric, fast_runs integer,
  secrets integer
)
language sql stable security definer set search_path = public
as $$
  select p.display_name, p.club_member, (p.id = auth.uid()),
         s.blue_rank, s.blue_cleared, s.blue_avg,
         s.red_rank, s.red_cleared, s.red_ghosts, s.red_best,
         s.fast_best, s.fast_avg_seconds, s.fast_runs,
         s.secrets
    from public.profiles p
    join public.standings s on s.user_id = p.id
   where not p.hidden
     and (not p_club_only or p.club_member)
   order by s.updated_at desc
   limit 200;
$$;

revoke all on function public.set_display_name(text), public.join_club(text),
  public.submit_standing(jsonb), public.get_standings(boolean)
  from public;
grant execute on function public.set_display_name(text)  to authenticated;
grant execute on function public.join_club(text)         to authenticated;
grant execute on function public.submit_standing(jsonb)  to authenticated;
grant execute on function public.get_standings(boolean)  to anon, authenticated;

-- ── Set your club code (change it any time) ────────────────────────────
insert into public.app_settings (key, value) values ('club_code', 'CHANGE-ME')
on conflict (key) do nothing;
-- To change it later:
--   update public.app_settings set value = 'NEW-CODE' where key = 'club_code';
--
-- Moderation: hide someone from the boards
--   update public.profiles set hidden = true where display_name = 'BadName';
