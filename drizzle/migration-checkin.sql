-- Migration 002 — Check-in de professores + turno nas salas
-- Cole no Supabase → SQL Editor → New query

alter table room_classrooms add column if not exists shift text not null default 'manha';

create table if not exists room_teacher_checkins (
  id             uuid primary key default gen_random_uuid(),
  classroom_id   uuid not null references room_classrooms(id) on delete cascade,
  staff_id       uuid not null references room_staff(id) on delete cascade,
  school_id      uuid not null references room_schools(id) on delete cascade,
  checked_in_at  timestamptz not null default now(),
  checked_out_at timestamptz,
  notes          text
);

alter table room_teacher_checkins enable row level security;

-- Índice para busca rápida de professores ativos (checked_out_at null)
create index if not exists idx_checkins_active
  on room_teacher_checkins (staff_id, checked_out_at)
  where checked_out_at is null;
