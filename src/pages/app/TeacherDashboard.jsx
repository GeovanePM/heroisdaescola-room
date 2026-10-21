import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { trpc } from '../../lib/trpc'

const SHIFT_LABEL = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
const EXIT_REASONS = ['Banheiro', 'Secretaria', 'Direção', 'Atendimento', 'Outro']

const EVENT_LABELS = {
  participacao: { label: 'Participou',    icon: '⚡', xp: +10, color: '#00ff88' },
  pontualidade: { label: 'Pontual',       icon: '⏱️', xp: +5,  color: '#FFD700' },
  saida_sala:   { label: 'Saiu da sala',  icon: '🚪', xp: 0,   color: '#aaa' },
  retorno_sala: { label: 'Retornou',      icon: '↩️', xp: 0,   color: '#aaa' },
  disciplina:   { label: 'Disciplina',    icon: '⚠️', xp: -5,  color: '#FF4444' },
}

const FOCUS_LABEL = { fracoes: 'Frações', problemas: 'Problemas', logica: 'Lógica' }
const TYPE_LABEL  = { tarefa: 'Tarefa', prova: 'Estudo p/ Prova' }
const STATUS_LABEL = { active: 'Ativa', completed: 'Concluída', expired: 'Expirada' }

const GUARDIOES_URL = import.meta.env.VITE_GUARDIOES_URL ?? 'https://guardioes-dos-numeros-silk.vercel.app'

function roomLabel(room) {
  if (!room) return ''
  const shift = SHIFT_LABEL[room.shift] ?? room.shift
  return room.hero_name ? `${room.name} ${shift} · ${room.hero_name}` : `${room.name} ${shift}`
}

// ── Aba Sala ──────────────────────────────────────────────────────────────────

const STATUS_SALA = {
  verde:    { label: 'Normal',         cor: '#00ff88', bg: 'rgba(0,255,136,0.08)'  },
  amarelo:  { label: 'Aluno fora',     cor: '#FFD700', bg: 'rgba(255,215,0,0.08)'  },
  laranja:  { label: 'Atenção',        cor: '#FF8C00', bg: 'rgba(255,140,0,0.08)'  },
  vermelho: { label: 'Intervenção',    cor: '#FF4444', bg: 'rgba(255,68,68,0.08)'  },
}

function calcularStatus(allEvents) {
  const sorted = [...allEvents].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const exits  = {}
  let intervencao = false

  for (const ev of sorted) {
    if (ev.type === 'intervencao')           intervencao = true
    if (ev.type === 'intervencao_encerrada') intervencao = false
    if (ev.type === 'saida_sala'   && ev.student_ref) exits[ev.student_ref] = ev
    if (ev.type === 'retorno_sala' && ev.student_ref) delete exits[ev.student_ref]
  }

  if (intervencao) return 'vermelho'
  const alunosFora = Object.values(exits)
  if (alunosFora.length === 0) return 'verde'
  const maisAntigo = Math.max(...alunosFora.map(e => Date.now() - new Date(e.created_at)))
  return maisAntigo >= 5 * 60 * 1000 ? 'laranja' : 'amarelo'
}

function SalaTab({ status, rooms, refetchStatus, classroomId, refetchEvents, events, wsEvents }) {
  const navigate = useNavigate()
  const [studentRef, setStudentRef] = useState('')
  const [exitPanel, setExitPanel]   = useState(false)

  const activeRoom = status?.room_classrooms ?? null

  const exitMutation = trpc.checkin.exit.useMutation({
    onSuccess() { refetchStatus() },
  })
  const registerMutation = trpc.event.register.useMutation({
    onSuccess() { refetchEvents() },
  })

  function register(type) {
    if (!classroomId) return
    if (type === 'saida_sala') { setExitPanel(true); return }
    registerMutation.mutate({ classroomId, type, studentRef: studentRef || undefined })
    setStudentRef('')
  }

  function registerExit(reason) {
    if (!classroomId) return
    registerMutation.mutate({ classroomId, type: 'saida_sala', studentRef: studentRef || undefined, notes: reason })
    setStudentRef('')
    setExitPanel(false)
  }

  const allEvents = [...wsEvents, ...events].slice(0, 30)
  const statusKey  = activeRoom ? calcularStatus(allEvents) : 'verde'
  const statusInfo = STATUS_SALA[statusKey]
  const emIntervencao = statusKey === 'vermelho'

  if (!activeRoom) return (
    <div className="checkin-prompt">
      <div className="checkin-prompt-icon">📱</div>
      <h2 className="checkin-prompt-title">Sem sala ativa</h2>
      <p className="checkin-prompt-desc">
        Escaneie o QR Code afixado na sala para registrar sua entrada.
      </p>
      {rooms.length > 0 && (
        <>
          <p className="checkin-prompt-or">ou selecione manualmente:</p>
          <div className="room-manual-list">
            {rooms.map(r => (
              <button
                key={r.id}
                className="room-manual-btn"
                onClick={() => navigate(`/check-in/${r.id}`)}
              >
                {roomLabel(r)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  return (
    <>
      <div className="active-room-bar" style={{ borderColor: statusInfo.cor + '55', background: statusInfo.bg }}>
        <div className="active-room-info">
          <span className="active-room-dot" style={{ background: statusInfo.cor }} />
          <span className="active-room-label">{roomLabel(activeRoom)}</span>
          <span className="room-status-badge" style={{ color: statusInfo.cor, borderColor: statusInfo.cor + '44', background: statusInfo.cor + '18' }}>
            {statusInfo.label}
          </span>
          <span className="active-room-since">
            desde {new Date(status.checked_in_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {emIntervencao ? (
            <button
              className="btn-intervencao-encerrar"
              onClick={() => registerMutation.mutate({ classroomId, type: 'intervencao_encerrada' })}
              disabled={registerMutation.isPending}
            >
              ✅ Encerrar intervenção
            </button>
          ) : (
            <button
              className="btn-intervencao"
              onClick={() => { if (confirm('Solicitar intervenção da supervisão?')) registerMutation.mutate({ classroomId, type: 'intervencao' }) }}
              disabled={registerMutation.isPending}
            >
              🚨 Solicitar intervenção
            </button>
          )}
          <button
            className="btn-checkout"
            onClick={() => exitMutation.mutate()}
            disabled={exitMutation.isPending}
          >
            🚪 Sair
          </button>
        </div>
      </div>

      <div className="sala-grid">
        <div className="sala-card xp-card">
          <div className="xp-card-inner">
            <span className="xp-number">{activeRoom.xp ?? 0}</span>
            <span className="xp-label">XP total</span>
            <div className="xp-level-badge">Nível {activeRoom.level ?? 1}</div>
          </div>
          {activeRoom.hero_name && (
            <div className="hero-name-display">Herói: {activeRoom.hero_name}</div>
          )}
        </div>

        <div className="sala-card event-card">
          <h2 className="card-title">Registrar evento</h2>
          <input
            type="text"
            className="student-ref-input"
            placeholder="Aluno (opcional)"
            value={studentRef}
            onChange={e => setStudentRef(e.target.value)}
          />
          <div className="event-buttons">
            {Object.entries(EVENT_LABELS).map(([type, info]) => (
              <button
                key={type}
                className="event-btn"
                style={{ '--ec': info.color }}
                onClick={() => register(type)}
                disabled={registerMutation.isPending}
              >
                <span className="event-btn-icon">{info.icon}</span>
                <span className="event-btn-label">{info.label}</span>
                {info.xp !== 0 && (
                  <span className="event-btn-xp" style={{ color: info.xp > 0 ? '#00ff88' : '#FF4444' }}>
                    {info.xp > 0 ? '+' : ''}{info.xp} XP
                  </span>
                )}
              </button>
            ))}
          </div>

          {exitPanel && (
            <div className="exit-reason-panel">
              <div className="exit-reason-header">
                <span>Motivo da saída{studentRef ? ` — ${studentRef}` : ''}:</span>
                <button className="exit-reason-close" onClick={() => setExitPanel(false)}>×</button>
              </div>
              <div className="exit-reason-buttons">
                {EXIT_REASONS.map(r => (
                  <button key={r} className="exit-reason-btn" onClick={() => registerExit(r)}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sala-card log-card">
          <h2 className="card-title">Eventos recentes</h2>
          {allEvents.length === 0 ? (
            <p className="log-empty">Nenhum evento ainda.</p>
          ) : (
            <ul className="event-log">
              {allEvents.map((ev, i) => {
                const info = EVENT_LABELS[ev.type]
                return (
                  <li key={ev.id ?? i} className="log-item">
                    <span className="log-icon">{info?.icon}</span>
                    <span className="log-label">{info?.label}</span>
                    {ev.student_ref && <span className="log-student">— {ev.student_ref}</span>}
                    {ev.notes && <span className="log-reason">({ev.notes})</span>}
                    {ev.xp_value !== 0 && (
                      <span className="log-xp" style={{ color: ev.xp_value > 0 ? '#00ff88' : '#FF4444' }}>
                        {ev.xp_value > 0 ? '+' : ''}{ev.xp_value}
                      </span>
                    )}
                    <span className="log-time">{new Date(ev.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}

// ── Aba Tarefas ───────────────────────────────────────────────────────────────

function TasksTab({ rooms }) {
  const utils = trpc.useUtils()
  const { data: tasks = [], isLoading } = trpc.task.list.useQuery({})
  const [modal, setModal]   = useState(false)
  const [detailTask, setDetailTask] = useState(null)
  const [form, setForm]     = useState({ classroomId: '', title: '', type: 'tarefa', focus: ['fracoes'], targetCount: 30, xpReward: 50, deadline: '' })
  const [err, setErr]       = useState('')

  const { data: completions = [] } = trpc.task.completions.useQuery(
    { taskId: detailTask?.id ?? '' },
    { enabled: !!detailTask }
  )

  const createMut = trpc.task.create.useMutation({
    onSuccess() { utils.task.list.invalidate(); setModal(false) },
    onError(e)  { setErr(e.message) },
  })
  const deleteMut = trpc.task.delete.useMutation({
    onSuccess() { utils.task.list.invalidate() },
  })

  function toggleFocus(f) {
    setForm(prev => ({
      ...prev,
      focus: prev.focus.includes(f)
        ? prev.focus.filter(x => x !== f)
        : [...prev.focus, f],
    }))
  }

  function submit() {
    if (!form.classroomId) { setErr('Selecione a turma'); return }
    if (!form.title.trim()) { setErr('Título obrigatório'); return }
    if (form.focus.length === 0) { setErr('Selecione ao menos um conteúdo'); return }
    createMut.mutate({
      ...form,
      deadline: form.deadline || null,
    })
  }

  function taskLink(task) {
    return `${GUARDIOES_URL}?taskId=${task.id}`
  }

  function copyLink(task) {
    navigator.clipboard.writeText(taskLink(task))
      .then(() => alert('Link copiado!'))
      .catch(() => alert(taskLink(task)))
  }

  const statusColor = { active: '#00ff88', completed: '#FFD700', expired: '#FF4444' }

  return (
    <div className="tasks-page">
      <div className="tasks-header">
        <h2 className="section-label">Tarefas / Estudos</h2>
        <button className="btn-admin-add" onClick={() => { setErr(''); setModal(true) }}>+ Nova Tarefa</button>
      </div>

      <p className="tasks-hint">
        Crie tarefas vinculadas ao jogo Guardiões dos Números. Compartilhe o link com os alunos. A turma ganha XP proporcionalmente às conclusões.
      </p>

      {isLoading ? (
        <p className="empty-state">Carregando...</p>
      ) : tasks.length === 0 ? (
        <p className="empty-state">Nenhuma tarefa criada ainda.</p>
      ) : (
        <div className="task-list">
          {tasks.map(task => {
            const pct = task.target_count > 0
              ? Math.min(Math.round((task.completion_count / task.target_count) * 100), 100)
              : 0
            const color = statusColor[task.status] ?? '#aaa'
            return (
              <div key={task.id} className="task-card">
                <div className="task-card-top">
                  <div>
                    <span className="task-title">{task.title}</span>
                    <span className="task-type-badge">{TYPE_LABEL[task.type]}</span>
                  </div>
                  <span className="task-status-badge" style={{ color, borderColor: `${color}44`, background: `${color}11` }}>
                    {STATUS_LABEL[task.status]}
                  </span>
                </div>

                <div className="task-meta">
                  <span className="task-room">{task.room_classrooms?.name}</span>
                  <span className="task-focus">
                    {(task.focus ?? []).map(f => (
                      <span key={f} className="focus-chip">{FOCUS_LABEL[f]}</span>
                    ))}
                  </span>
                  {task.deadline && (
                    <span className="task-deadline">
                      Prazo: {new Date(task.deadline).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                  <span className="task-xp">⚡ {task.xp_reward} XP</span>
                </div>

                <div className="task-progress-wrap">
                  <div className="task-progress-bar">
                    <div className="task-progress-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <span className="task-progress-label">{task.completion_count}/{task.target_count} alunos</span>
                </div>

                <div className="task-actions">
                  {task.status === 'active' && (
                    <button className="btn-sm btn-sm-ghost" onClick={() => copyLink(task)}>
                      Copiar link
                    </button>
                  )}
                  <button className="btn-sm btn-sm-ghost" onClick={() => setDetailTask(task)}>
                    Ver conclusões ({task.completion_count})
                  </button>
                  <button
                    className="btn-sm btn-sm-danger"
                    onClick={() => { if (confirm('Remover tarefa?')) deleteMut.mutate({ id: task.id }) }}
                    disabled={deleteMut.isPending}
                  >
                    Remover
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal criar tarefa */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nova Tarefa</h3>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {err && <p className="form-error">{err}</p>}
              <div className="form-group">
                <label className="form-label">Turma</label>
                <select className="form-select" value={form.classroomId} onChange={e => setForm(f => ({ ...f, classroomId: e.target.value }))}>
                  <option value="">— selecione —</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name} · {SHIFT_LABEL[r.shift] ?? r.shift}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Título</label>
                <input className="form-input" placeholder="Ex: Estudar frações para a prova" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="tarefa">Tarefa</option>
                  <option value="prova">Estudo para Prova</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Conteúdo (o jogo vai focar nisso)</label>
                <div className="focus-toggle-group">
                  {['fracoes', 'problemas', 'logica'].map(f => (
                    <button
                      key={f}
                      type="button"
                      className={`focus-toggle-btn ${form.focus.includes(f) ? 'focus-toggle-on' : ''}`}
                      onClick={() => toggleFocus(f)}
                    >
                      {FOCUS_LABEL[f]}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Meta (nº de alunos)</label>
                  <input className="form-input" type="number" min="1" value={form.targetCount} onChange={e => setForm(f => ({ ...f, targetCount: Number(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">XP de recompensa</label>
                  <input className="form-input" type="number" min="0" step="5" value={form.xpReward} onChange={e => setForm(f => ({ ...f, xpReward: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Prazo (opcional)</label>
                <input className="form-input" type="datetime-local" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-cancel" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-modal-confirm" onClick={submit} disabled={createMut.isPending}>
                {createMut.isPending ? 'Criando...' : 'Criar Tarefa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalhe / conclusões */}
      {detailTask && (
        <div className="modal-overlay" onClick={() => setDetailTask(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{detailTask.title}</h3>
              <button className="modal-close" onClick={() => setDetailTask(null)}>×</button>
            </div>
            <div className="modal-body">
              <p className="form-hint" style={{ marginBottom: '0.75rem' }}>
                {completions.length} de {detailTask.target_count} alunos concluíram.
                {completions.length < detailTask.target_count && ' Verifique pessoalmente os demais.'}
              </p>
              {completions.length === 0 ? (
                <p className="empty-state">Nenhuma conclusão registrada ainda.</p>
              ) : (
                <ul className="completions-list">
                  {completions.map((c, i) => (
                    <li key={i} className="completion-item">
                      <span className="completion-name">{c.student_name}</span>
                      <span className="completion-time">
                        {new Date(c.completed_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-modal-confirm" onClick={() => setDetailTask(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function TeacherDashboard() {
  const { token } = useAuth()
  const [tab, setTab]       = useState('sala')
  const [wsEvents, setWsEvents] = useState([])
  const wsRef = useRef(null)

  const { data: status, refetch: refetchStatus } = trpc.checkin.myStatus.useQuery()
  const { data: rooms = [] } = trpc.classroom.myRooms.useQuery()

  const activeRoom   = status?.room_classrooms ?? null
  const classroomId  = activeRoom?.id

  const { data: events = [], refetch: refetchEvents } = trpc.event.list.useQuery(
    { classroomId: classroomId ?? '' },
    { enabled: !!classroomId }
  )

  useEffect(() => {
    if (!classroomId) { wsRef.current?.close(); return }
    const apiBase = (import.meta.env.VITE_API_URL ?? import.meta.env.API_URL ?? 'http://localhost:3001').replace(/^http/, 'ws')
    const ws = new WebSocket(`${apiBase}/ws?roomId=${classroomId}`)
    wsRef.current = ws
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'event') setWsEvents(prev => [data.event, ...prev.slice(0, 19)])
      } catch {}
    }
    return () => ws.close()
  }, [classroomId])

  return (
    <div className="teacher-page">
      <header className="page-header">
        <h1 className="page-title">Minha Sala</h1>
        <p className="page-subtitle">
          {activeRoom
            ? `Você está em: ${roomLabel(activeRoom)}`
            : 'Escaneie o QR Code da sala para fazer check-in'}
        </p>
      </header>

      <div className="teacher-tabs">
        <button className={`teacher-tab ${tab === 'sala' ? 'teacher-tab-active' : ''}`} onClick={() => setTab('sala')}>
          Sala
        </button>
        <button className={`teacher-tab ${tab === 'tarefas' ? 'teacher-tab-active' : ''}`} onClick={() => setTab('tarefas')}>
          Tarefas
        </button>
      </div>

      {tab === 'sala' && (
        <SalaTab
          status={status}
          rooms={rooms}
          refetchStatus={refetchStatus}
          classroomId={classroomId}
          refetchEvents={refetchEvents}
          events={events}
          wsEvents={wsEvents}
        />
      )}

      {tab === 'tarefas' && <TasksTab rooms={rooms} />}
    </div>
  )
}
