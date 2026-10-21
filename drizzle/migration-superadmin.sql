-- Bloco 3 — Super Admin (Heróis da Escola)

-- 1. Adicionar super_admin ao enum de roles
ALTER TYPE staff_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. Permitir school_id nulo (super_admin não pertence a uma escola específica)
ALTER TABLE room_staff ALTER COLUMN school_id DROP NOT NULL;

-- 3. Criar conta super_admin da empresa Heróis da Escola
--    Senha: heroesadmin2024  (alterar após o primeiro acesso)
INSERT INTO room_staff (name, email, password_hash, role, school_id, active)
VALUES (
  'Heróis da Escola',
  'admin@heroisdaescola.com.br',
  '$2a$10$QVewXCQ2NnA1ZsPVfL19beX2gLcIW2E9QdwKTaMvAZZleokzAkmdC',
  'super_admin',
  NULL,
  true
)
ON CONFLICT (email) DO NOTHING;
