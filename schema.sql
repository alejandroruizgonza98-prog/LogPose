-- Log Pose · esquema de Supabase
-- Pégalo entero en Supabase → SQL Editor → Run.
-- Cada tripulación se identifica por su CÓDIGO secreto. La app envía el código en la cabecera
-- "x-crew"; la base de datos guarda solo su hash SHA-256 y las reglas (RLS) dejan leer y escribir
-- únicamente las filas cuyo hash coincide. Sin el código no se ve nada.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.crew_hash() returns text
language sql stable as $$
  select encode(extensions.digest(coalesce(current_setting('request.headers', true)::json->>'x-crew', ''), 'sha256'), 'hex')
$$;

create table if not exists public.players (
  id text primary key,
  crew text not null,
  name text not null check (char_length(name) between 1 and 30),
  emoji text not null default '🏴‍☠️',
  color text not null default '#c0392b',
  leader_code text not null default '',
  leader_name text not null default '',
  leader_colors text[] not null default '{}',
  deck text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id text primary key,
  crew text not null,
  name text not null check (char_length(name) between 1 and 60),
  date date not null,
  city text not null default '',
  rounds int not null default 0 check (rounds between 0 and 20),
  mins int not null default 35 check (mins between 5 and 120),
  updated_at timestamptz not null default now()
);

create table if not exists public.matches (
  id text primary key,
  crew text not null,
  event_id text not null references public.events(id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade,
  round int not null default 0 check (round between 0 and 20),
  stage text not null default '',
  result text not null check (result in ('W','L','D')),
  went_first boolean,
  my_leader_code text not null default '',
  my_leader_name text not null default '',
  my_colors text[] not null default '{}',
  opp_leader_code text not null default '',
  opp_leader_name text not null default '',
  opp_colors text[] not null default '{}',
  opp_name text not null default '',
  notes text not null default '' check (char_length(notes) <= 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.misplays (
  id text primary key,
  crew text not null,
  player_id text not null references public.players(id) on delete cascade,
  event_id text references public.events(id) on delete set null,
  round int not null default 0,
  text text not null check (char_length(text) between 1 and 400),
  reported_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.misplay_votes (
  id text primary key,            -- "<misplay_id>:<voter_id>", un voto por persona
  crew text not null,
  misplay_id text not null references public.misplays(id) on delete cascade,
  voter_id text not null references public.players(id) on delete cascade,
  score int not null check (score between 1 and 5),
  updated_at timestamptz not null default now()
);

create index if not exists players_crew on public.players(crew);
create index if not exists events_crew on public.events(crew);
create index if not exists matches_crew on public.matches(crew);
create index if not exists misplays_crew on public.misplays(crew);
create index if not exists votes_crew on public.misplay_votes(crew);

do $$
declare t text;
begin
  foreach t in array array['players','events','matches','misplays','misplay_votes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists crew_rw on public.%I', t);
    execute format('create policy crew_rw on public.%I for all to anon, authenticated using (crew = public.crew_hash()) with check (crew = public.crew_hash())', t);
  end loop;
end $$;
