-- Heróis da Escola Room — Migration inicial
-- Cole este SQL no Supabase → SQL Editor → New query

create type staff_role as enum ('teacher','supervisor','vice_director','director','admin');
create type segment as enum ('fund1','fund2','medio');
create type event_type as enum ('saida_sala','retorno_sala','disciplina','participacao','pontualidade');
create type patrimony_status as enum ('aberto','em_andamento','resolvido');

create table room_schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  city        text not null,
  state       text not null,
  access_code text not null unique,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table room_staff (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references room_schools(id) on delete cascade,
  name             text not null,
  email            text not null,
  password_hash    text not null,
  role             staff_role not null,
  telegram_chat_id text,
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

create table room_classrooms (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references room_schools(id) on delete cascade,
  name           text not null,
  segment        segment not null,
  hero_name      text,
  hero_image_url text,
  xp             integer not null default 0,
  level          integer not null default 1,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table room_classroom_staff (
  id             uuid primary key default gen_random_uuid(),
  classroom_id   uuid not null references room_classrooms(id) on delete cascade,
  staff_id       uuid not null references room_staff(id) on delete cascade,
  subject        text,
  is_responsible boolean not null default false
);

create table room_classroom_events (
  id           uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references room_classrooms(id) on delete cascade,
  staff_id     uuid not null references room_staff(id),
  type         event_type not null,
  student_ref  text,
  notes        text,
  xp_value     integer not null default 0,
  created_at   timestamptz not null default now()
);

create table room_classroom_xp_log (
  id           uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references room_classrooms(id) on delete cascade,
  xp_delta     integer not null,
  source_type  text not null,
  created_at   timestamptz not null default now()
);

create table room_content_diary (
  id                uuid primary key default gen_random_uuid(),
  classroom_id      uuid not null references room_classrooms(id) on delete cascade,
  staff_id          uuid not null references room_staff(id),
  subject           text not null,
  date              text not null,
  content_planned   text,
  content_delivered text not null,
  notes             text,
  created_at        timestamptz not null default now()
);

create table room_patrimony_records (
  id           uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references room_classrooms(id) on delete cascade,
  staff_id     uuid not null references room_staff(id),
  description  text not null,
  photo_url    text,
  status       patrimony_status not null default 'aberto',
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

create table room_supervisor_validations (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references room_classroom_events(id) on delete cascade,
  supervisor_id uuid not null references room_staff(id),
  validated     boolean,
  notes         text,
  created_at    timestamptz not null default now()
);

create table room_weekly_rankings (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references room_schools(id) on delete cascade,
  week_start text not null,
  rankings   text not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table room_schools              enable row level security;
alter table room_staff                enable row level security;
alter table room_classrooms           enable row level security;
alter table room_classroom_staff      enable row level security;
alter table room_classroom_events     enable row level security;
alter table room_classroom_xp_log     enable row level security;
alter table room_content_diary        enable row level security;
alter table room_patrimony_records    enable row level security;
alter table room_supervisor_validations enable row level security;
alter table room_weekly_rankings      enable row level security;
