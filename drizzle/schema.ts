import { pgTable, uuid, text, timestamp, boolean, integer, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ── Enums ─────────────────────────────────────────────────────
export const staffRoleEnum   = pgEnum('staff_role',   ['teacher', 'supervisor', 'vice_director', 'director', 'admin'])
export const segmentEnum     = pgEnum('segment',      ['fund1', 'fund2', 'medio'])
export const eventTypeEnum   = pgEnum('event_type',   ['saida_sala', 'retorno_sala', 'disciplina', 'participacao', 'pontualidade'])
export const patrimonyStatus = pgEnum('patrimony_status', ['aberto', 'em_andamento', 'resolvido'])

// ── Schools ───────────────────────────────────────────────────
export const schools = pgTable('room_schools', {
  id:         uuid('id').primaryKey().defaultRandom(),
  name:       text('name').notNull(),
  city:       text('city').notNull(),
  state:      text('state').notNull(),
  accessCode: text('access_code').notNull().unique(),
  active:     boolean('active').notNull().default(true),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
})

// ── Staff (professores, supervisores, vice-diretores, diretores) ──
export const staff = pgTable('room_staff', {
  id:             uuid('id').primaryKey().defaultRandom(),
  schoolId:       uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
  name:           text('name').notNull(),
  email:          text('email').notNull(),
  passwordHash:   text('password_hash').notNull(),
  role:           staffRoleEnum('role').notNull(),
  telegramChatId: text('telegram_chat_id'),
  active:         boolean('active').notNull().default(true),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
})

// ── Classrooms ────────────────────────────────────────────────
export const classrooms = pgTable('room_classrooms', {
  id:           uuid('id').primaryKey().defaultRandom(),
  schoolId:     uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
  name:         text('name').notNull(),       // ex: "6º A"
  segment:      segmentEnum('segment').notNull(),
  heroName:     text('hero_name'),             // nome votado pela turma
  heroImageUrl: text('hero_image_url'),
  xp:           integer('xp').notNull().default(0),
  level:        integer('level').notNull().default(1),
  active:       boolean('active').notNull().default(true),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})

// ── Classroom ↔ Staff (professor pode ter várias salas) ───────
export const classroomStaff = pgTable('room_classroom_staff', {
  id:            uuid('id').primaryKey().defaultRandom(),
  classroomId:   uuid('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  staffId:       uuid('staff_id').notNull().references(() => staff.id, { onDelete: 'cascade' }),
  subject:       text('subject'),              // null = professor responsável fund1
  isResponsible: boolean('is_responsible').notNull().default(false),
})

// ── Classroom Events (dados internos — nunca expostos publicamente) ──
export const classroomEvents = pgTable('room_classroom_events', {
  id:          uuid('id').primaryKey().defaultRandom(),
  classroomId: uuid('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  staffId:     uuid('staff_id').notNull().references(() => staff.id),
  type:        eventTypeEnum('type').notNull(),
  studentRef:  text('student_ref'),            // referência anônima ao aluno
  notes:       text('notes'),
  xpValue:     integer('xp_value').notNull().default(0),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

// ── XP Log (ponte para o sistema público — só números) ────────
export const classroomXpLog = pgTable('room_classroom_xp_log', {
  id:          uuid('id').primaryKey().defaultRandom(),
  classroomId: uuid('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  xpDelta:     integer('xp_delta').notNull(),
  sourceType:  text('source_type').notNull(),  // event | game | content
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

// ── Content Diary ─────────────────────────────────────────────
export const contentDiary = pgTable('room_content_diary', {
  id:               uuid('id').primaryKey().defaultRandom(),
  classroomId:      uuid('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  staffId:          uuid('staff_id').notNull().references(() => staff.id),
  subject:          text('subject').notNull(),
  date:             text('date').notNull(),     // YYYY-MM-DD
  contentPlanned:   text('content_planned'),
  contentDelivered: text('content_delivered').notNull(),
  notes:            text('notes'),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
})

// ── Patrimony ─────────────────────────────────────────────────
export const patrimonyRecords = pgTable('room_patrimony_records', {
  id:          uuid('id').primaryKey().defaultRandom(),
  classroomId: uuid('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  staffId:     uuid('staff_id').notNull().references(() => staff.id),
  description: text('description').notNull(),
  photoUrl:    text('photo_url'),
  status:      patrimonyStatus('status').notNull().default('aberto'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  resolvedAt:  timestamp('resolved_at'),
})

// ── Supervisor Validations (amostragem) ───────────────────────
export const supervisorValidations = pgTable('room_supervisor_validations', {
  id:          uuid('id').primaryKey().defaultRandom(),
  eventId:     uuid('event_id').notNull().references(() => classroomEvents.id, { onDelete: 'cascade' }),
  supervisorId:uuid('supervisor_id').notNull().references(() => staff.id),
  validated:   boolean('validated'),
  notes:       text('notes'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

// ── Weekly Rankings ───────────────────────────────────────────
export const weeklyRankings = pgTable('room_weekly_rankings', {
  id:        uuid('id').primaryKey().defaultRandom(),
  schoolId:  uuid('school_id').notNull().references(() => schools.id, { onDelete: 'cascade' }),
  weekStart: text('week_start').notNull(),     // YYYY-MM-DD (segunda-feira)
  rankings:  text('rankings').notNull(),       // JSON stringified
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// ── Relations ─────────────────────────────────────────────────
export const schoolsRelations = relations(schools, ({ many }) => ({
  staff:      many(staff),
  classrooms: many(classrooms),
  rankings:   many(weeklyRankings),
}))

export const classroomsRelations = relations(classrooms, ({ one, many }) => ({
  school:     one(schools,   { fields: [classrooms.schoolId],   references: [schools.id] }),
  staffLinks: many(classroomStaff),
  events:     many(classroomEvents),
  xpLog:      many(classroomXpLog),
  diary:      many(contentDiary),
  patrimony:  many(patrimonyRecords),
}))

export const staffRelations = relations(staff, ({ one }) => ({
  school: one(schools, { fields: [staff.schoolId], references: [schools.id] }),
}))
