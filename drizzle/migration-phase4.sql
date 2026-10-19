-- Heróis da Escola Room — Migration Phase 4
-- Cole no Supabase → SQL Editor → New query

-- Votos para nome do herói da turma
create table if not exists room_hero_votes (
  id           uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references room_classrooms(id) on delete cascade,
  student_name text not null,
  hero_name    text not null,
  created_at   timestamptz not null default now()
);

-- Cartas ganhas por turma no ranking semanal
create table if not exists room_classroom_cards (
  id           uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references room_classrooms(id) on delete cascade,
  school_id    uuid not null references room_schools(id) on delete cascade,
  card_type    text not null check (card_type in ('bronze','silver','gold','legendary')),
  week_number  integer not null,
  year         integer not null,
  earned_at    timestamptz not null default now(),
  unique (classroom_id, week_number, year)
);

-- Períodos da grade horária
create table if not exists room_periods (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references room_schools(id) on delete cascade,
  day_of_week   integer not null check (day_of_week between 0 and 6),
  period_number integer not null,
  start_time    text not null,
  end_time      text not null,
  name          text not null default 'Aula',
  is_break      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- telegram_chat_id já existe em room_staff — apenas garantir
alter table room_staff add column if not exists telegram_chat_id text;
