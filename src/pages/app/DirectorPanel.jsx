import React, { useState, useEffect, useRef, useMemo } from 'react'
import { trpc } from '../../lib/trpc'

const SEG_LABEL    = { fund1: 'Fund. I', fund2: 'Fund. II', medio: 'Médio' }

const STATUS_SALA = {
  verde:    { label: 'Normal',      cor: '#00ff88', bg: 'rgba(0,255,136,0.1)'  },
  amarelo:  { label: 'Aluno fora',  cor: '#FFD700', bg: 'rgba(255,215,0,0.1)'  },
  laranja:  { label: 'Atenção',     cor: '#FF8C00', bg: 'rgba(255,140,0,0.1)'  },
  vermelho: { label: 'Intervenção', cor: '#FF4444', bg: 'rgba(255,68,68,0.1)'  },
}

function calcularStatus(events) {
  const sorted = [...events].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const exits  = {}
  let intervencao = false
  for (const ev of sorted) {
    if (ev.type === 'intervencao')           intervencao = true
    if (ev.type === 'intervencao_encerrada') intervencao = false
    if (ev.type === 'saida_sala'   && ev.student_ref) exits[ev.student_ref] = ev
    if (ev.type === 'retorno_sala' && ev.student_ref) delete exits[ev.student_ref]
  }
  if (intervencao) return 'vermelho'
  const fora = Object.values(exits)
  if (fora.length === 0) return 'verde'
  const maisAntigo = Math.max(...fora.map(e => Date.now() - new Date(e.created_at)))
  return maisAntigo >= 5 * 60 * 1000 ? 'laranja' : 'amarelo'
}
const TURNO_LABEL  = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
const TYPE_LABEL   = { tarefa: 'Tarefa', prova: 'Estudo p/ Prova' }
const STATUS_COLOR = { active: '#00ff88', completed: '#FFD700', expired: '#FF4444' }
const STATUS_LABEL = { active: 'Ativa', completed: 'Concluída', expired: 'Expirada' }

// ── Visão Geral ───────────────────────────────────────────────────────────────

function VisaoGeral({ classrooms, ranking, tasks }) {
  const totalXp    = classrooms.reduce((acc, c) => acc + (c.xp ?? 0), 0)
  const totalRooms = classrooms.length

  return (
    <>
      <div className="director-stats">
        <div className="stat-card">
          <span className="stat-value">{totalRooms}</span>
          <span className="stat-label">Turmas ativas</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{totalXp.toLocaleString('pt-BR')}</span>
          <span className="stat-label">XP total acumulado</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{ranking[0]?.name ?? '—'}</span>
          <span className="stat-label">Líder desta semana</span>
        </div>
      </div>

      <section className="director-ranking">
        <h2 className="section-label">Ranking de turmas</h2>
        <div className="ranking-table">
          <div className="ranking-thead">
            <span>#</span><span>Turma</span><span>Segmento</span><span>Nível</span><span>XP</span>
          </div>
          {ranking.map((room, idx) => (
            <div key={room.id} className={`ranking-trow ${idx === 0 ? 'trow-first' : ''}`}>
              <span className="trow-pos">{idx + 1}</span>
              <span className="trow-name">
                {room.name}
                {room.hero_name && <small className="trow-hero"> · {room.hero_name}</small>}
              </span>
              <span className="trow-seg">{SEG_LABEL[room.segment]}</span>
              <span className="trow-level">Nível {room.level}</span>
              <span className="trow-xp">{(room.xp ?? 0).toLocaleString('pt-BR')}</span>
            </div>
          ))}
          {ranking.length === 0 && <p className="empty-state" style={{ padding: '1.5rem', textAlign: 'center' }}>Sem dados ainda.</p>}
        </div>
      </section>

      <section className="director-tasks">
        <h2 className="section-label">Tarefas da Escola</h2>
        {tasks.length === 0 ? (
          <p className="empty-state" style={{ padding: '1rem' }}>Nenhuma tarefa criada.</p>
        ) : (
          <div className="director-task-list">
            {tasks.map(task => {
              const pct   = task.target_count > 0 ? Math.min(Math.round((task.completion_count / task.target_count) * 100), 100) : 0
              const color = STATUS_COLOR[task.status] ?? '#aaa'
              return (
                <div key={task.id} className="director-task-row">
                  <div className="dt-info">
                    <span className="dt-title">{task.title}</span>
                    <span className="dt-room">{task.room_classrooms?.name}</span>
                    <span className="dt-type">{TYPE_LABEL[task.type]}</span>
                  </div>
                  <div className="dt-progress">
                    <div className="task-progress-bar">
                      <div className="task-progress-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="task-progress-label">{task.completion_count}/{task.target_count}</span>
                  </div>
                  <div className="dt-right">
                    <span style={{ color, fontSize: '0.78rem', fontWeight: 600 }}>{STATUS_LABEL[task.status]}</span>
                    <span className="dt-xp">⚡ {task.xp_reward} XP</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}

// ── Turmas ────────────────────────────────────────────────────────────────────

function Turmas({ classrooms }) {
  const [liveEvents, setLiveEvents] = useState([])
  const wsRef = useRef(null)
  const { data: recentEvents = [] } = trpc.supervisor.recentEvents.useQuery({ limit: 200 })

  useEffect(() => {
    const apiBase = (import.meta.env.VITE_API_URL ?? import.meta.env.API_URL ?? 'http://localhost:3001').replace(/^http/, 'ws')
    const ws = new WebSocket(`${apiBase}/ws?roomId=supervisor`)
    wsRef.current = ws
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'event') setLiveEvents(prev => [data.event, ...prev.slice(0, 199)])
      } catch {}
    }
    return () => ws.close()
  }, [])

  const allEvents = useMemo(() => [...liveEvents, ...recentEvents], [liveEvents, recentEvents])

  return (
    <div className="turmas-grid">
      {classrooms.map(room => {
        const evsSala  = allEvents.filter(e => e.classroom_id === room.id)
        const statusKey = calcularStatus(evsSala)
        const s        = STATUS_SALA[statusKey]
        const xpPct    = Math.min(((room.xp ?? 0) % 1000) / 10, 100)

        return (
          <div key={room.id} className="turma-card-dir" style={{ borderColor: s.cor + '55', background: s.bg }}>
            <div className="turma-card-top">
              <div>
                <span className="turma-card-nome">{room.name}</span>
                <span className="turma-card-turno">{TURNO_LABEL[room.shift] ?? room.shift} · {SEG_LABEL[room.segment]}</span>
              </div>
              <span className="turma-status-badge" style={{ color: s.cor, background: s.cor + '22', border: `1px solid ${s.cor}44` }}>
                {statusKey === 'vermelho' && '🚨 '}{s.label}
              </span>
            </div>

            {room.hero_name && (
              <div className="turma-heroi">
                {room.hero_image_url && <img src={room.hero_image_url} className="turma-heroi-img" alt={room.hero_name} />}
                <span className="turma-heroi-nome">⚔️ {room.hero_name}</span>
              </div>
            )}

            <div className="turma-xp-wrap">
              <div className="turma-xp-top">
                <span className="turma-xp-val">⚡ {(room.xp ?? 0).toLocaleString('pt-BR')} XP</span>
                <span className="turma-nivel">Nível {room.level ?? 1}</span>
              </div>
              <div className="turma-xp-bar">
                <div className="turma-xp-fill" style={{ width: `${xpPct}%`, background: `linear-gradient(90deg, ${s.cor}, ${s.cor}aa)` }} />
              </div>
            </div>
          </div>
        )
      })}
      {classrooms.length === 0 && <p className="empty-state">Nenhuma turma cadastrada.</p>}
    </div>
  )
}

// ── Alunos ────────────────────────────────────────────────────────────────────

function Alunos({ classrooms }) {
  const utils = trpc.useUtils()
  const [roomId, setRoomId]     = useState(classrooms[0]?.id ?? '')
  const [modal, setModal]       = useState(false)
  const [editAluno, setEdit]    = useState(null)
  const [form, setForm]         = useState({ name: '', callNumber: '' })
  const [err, setErr]           = useState('')

  const { data: alunos = [], isLoading } = trpc.student.list.useQuery(
    { classroomId: roomId },
    { enabled: !!roomId }
  )

  const createMut = trpc.student.create.useMutation({
    onSuccess() { utils.student.list.invalidate(); fecharModal() },
    onError(e)  { setErr(e.message) },
  })
  const updateMut = trpc.student.update.useMutation({
    onSuccess() { utils.student.list.invalidate(); fecharModal() },
    onError(e)  { setErr(e.message) },
  })
  const removeMut = trpc.student.remove.useMutation({
    onSuccess() { utils.student.list.invalidate() },
  })

  function abrirNovo() {
    setEdit(null)
    setForm({ name: '', callNumber: '' })
    setErr('')
    setModal(true)
  }

  function abrirEditar(a) {
    setEdit(a)
    setForm({ name: a.name, callNumber: a.call_number ?? '' })
    setErr('')
    setModal(true)
  }

  function fecharModal() { setModal(false); setEdit(null) }

  function salvar() {
    if (!form.name.trim()) { setErr('Nome obrigatório'); return }
    const callNumber = form.callNumber ? Number(form.callNumber) : undefined
    if (editAluno) {
      updateMut.mutate({ id: editAluno.id, name: form.name, callNumber: callNumber ?? null })
    } else {
      createMut.mutate({ classroomId: roomId, name: form.name, callNumber })
    }
  }

  const turmaAtual = classrooms.find(c => c.id === roomId)

  return (
    <div className="alunos-section">
      <div className="alunos-header">
        <select className="form-select" value={roomId} onChange={e => setRoomId(e.target.value)} style={{ maxWidth: 280 }}>
          {classrooms.map(c => (
            <option key={c.id} value={c.id}>{c.name} · {TURNO_LABEL[c.shift] ?? c.shift}</option>
          ))}
        </select>
        <button className="btn-admin-add" onClick={abrirNovo}>+ Novo aluno</button>
      </div>

      {turmaAtual && (
        <p className="alunos-count">
          {alunos.length} aluno{alunos.length !== 1 ? 's' : ''} cadastrado{alunos.length !== 1 ? 's' : ''} em <strong>{turmaAtual.name}</strong>
        </p>
      )}

      {isLoading ? (
        <p className="empty-state">Carregando...</p>
      ) : alunos.length === 0 ? (
        <p className="empty-state">Nenhum aluno cadastrado nesta turma.</p>
      ) : (
        <div className="alunos-lista">
          {alunos.map(a => (
            <div key={a.id} className="aluno-row">
              <span className="aluno-num">{a.call_number ?? '—'}</span>
              <span className="aluno-nome">{a.name}</span>
              <div className="aluno-acoes">
                <button className="btn-sm btn-sm-ghost" onClick={() => abrirEditar(a)}>Editar</button>
                <button
                  className="btn-sm btn-sm-danger"
                  onClick={() => { if (confirm(`Remover ${a.name}?`)) removeMut.mutate({ id: a.id }) }}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editAluno ? 'Editar aluno' : 'Novo aluno'}</h3>
              <button className="modal-close" onClick={fecharModal}>×</button>
            </div>
            <div className="modal-body">
              {err && <p className="form-error">{err}</p>}
              <div className="form-group">
                <label className="form-label">Nº Chamada</label>
                <input className="form-input" type="number" min="1" placeholder="Ex: 1" value={form.callNumber} onChange={e => setForm(f => ({ ...f, callNumber: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Nome completo</label>
                <input className="form-input" placeholder="Nome do aluno" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-cancel" onClick={fecharModal}>Cancelar</button>
              <button className="btn-modal-confirm" onClick={salvar} disabled={createMut.isPending || updateMut.isPending}>
                {editAluno ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Principal ─────────────────────────────────────────────────────────────────

export default function DirectorPanel() {
  const [aba, setAba] = useState('visao')

  const { data: classrooms = [] } = trpc.supervisor.allClassrooms.useQuery()
  const { data: ranking = [] }    = trpc.supervisor.weeklyRanking.useQuery()
  const { data: tasks = [] }      = trpc.task.list.useQuery({})

  const ABAS = [
    { id: 'visao',  label: '📊 Visão Geral' },
    { id: 'turmas', label: '🏫 Turmas'      },
    { id: 'alunos', label: '👥 Alunos'      },
  ]

  return (
    <div className="director-page">
      <header className="page-header">
        <h1 className="page-title">Painel da Direção</h1>
        <p className="page-subtitle">Gestão e monitoramento da escola</p>
      </header>

      <div className="teacher-tabs" style={{ marginBottom: '1.5rem' }}>
        {ABAS.map(a => (
          <button
            key={a.id}
            className={`teacher-tab ${aba === a.id ? 'teacher-tab-active' : ''}`}
            onClick={() => setAba(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>

      {aba === 'visao'  && <VisaoGeral classrooms={classrooms} ranking={ranking} tasks={tasks} />}
      {aba === 'turmas' && <Turmas classrooms={classrooms} />}
      {aba === 'alunos' && <Alunos classrooms={classrooms} />}
    </div>
  )
}
