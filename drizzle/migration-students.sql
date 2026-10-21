-- Heróis da Escola Room — Alunos e Presença

-- Ficha de alunos por turma
create table if not exists room_students (
  id           uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references room_classrooms(id) on delete cascade,
  school_id    uuid not null references room_schools(id) on delete cascade,
  name         text not null,
  call_number  integer,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists idx_students_classroom on room_students(classroom_id);

-- Presença diária
create table if not exists room_attendance (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references room_students(id) on delete cascade,
  classroom_id uuid not null references room_classrooms(id) on delete cascade,
  school_id   uuid not null references room_schools(id) on delete cascade,
  date        date not null default current_date,
  status      text not null check (status in ('presente', 'falta', 'falta_justificada')),
  reason      text,
  recorded_by uuid references room_staff(id),
  created_at  timestamptz not null default now(),
  unique (student_id, date)
);

create index if not exists idx_attendance_classroom_date on room_attendance(classroom_id, date);
