-- Tarefas criadas pelo professor (vinculadas ao jogo Guardiões)
create table if not exists room_tasks (
  id            uuid primary key default gen_random_uuid(),
  classroom_id  uuid not null references room_classrooms(id) on delete cascade,
  school_id     uuid not null references room_schools(id) on delete cascade,
  staff_id      uuid not null references room_staff(id) on delete cascade,
  title         text not null,
  type          text not null check (type in ('tarefa','prova')),
  focus         text[] not null,
  target_count  int not null default 1,
  xp_reward     int not null default 0,
  deadline      timestamptz,
  status        text not null default 'active' check (status in ('active','completed','expired')),
  xp_awarded    int not null default 0,
  created_at    timestamptz not null default now()
);

-- Conclusões registradas pelos alunos no jogo
create table if not exists room_task_completions (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references room_tasks(id) on delete cascade,
  student_name text not null,
  completed_at timestamptz not null default now()
);

create index if not exists idx_task_completions_task_id on room_task_completions(task_id);
