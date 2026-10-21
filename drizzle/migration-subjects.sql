-- Bloco 5 — Guardiões por Matéria

-- Matérias escolhidas pela escola
CREATE TABLE IF NOT EXISTS room_school_subjects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES room_schools(id) ON DELETE CASCADE,
  name        text NOT NULL,
  icon        text NOT NULL DEFAULT '📚',
  description text,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Tópicos dentro de cada matéria
CREATE TABLE IF NOT EXISTS room_subject_topics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  uuid NOT NULL REFERENCES room_school_subjects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text,
  difficulty  integer NOT NULL DEFAULT 1,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Questões geradas por IA para cada tópico
CREATE TABLE IF NOT EXISTS room_subject_questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id    uuid NOT NULL REFERENCES room_subject_topics(id) ON DELETE CASCADE,
  school_id   uuid NOT NULL REFERENCES room_schools(id) ON DELETE CASCADE,
  question    text NOT NULL,
  options     jsonb NOT NULL,
  correct     integer NOT NULL,
  explanation text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Vincular tarefa a um tópico de matéria
ALTER TABLE room_tasks ADD COLUMN IF NOT EXISTS subject_topic_id uuid REFERENCES room_subject_topics(id);
