import React, { useEffect, useRef, useState, useMemo } from 'react'
import { trpc } from '../../lib/trpc'

const SEG_LABEL   = { fund1: 'Fund. I', fund2: 'Fund. II', medio: 'Médio' }
const SHIFT_LABEL = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
const EVENT_LABEL = {
  participacao:          { label: 'Participou',        icon: '⚡', color: '#00ff88' },
  pontualidade:          { label: 'Pontual',           icon: '⏱️', color: '#FFD700' },
  saida_sala:            { label: 'Saiu da sala',      icon: '🚪', color: '#FF8C00' },
  retorno_sala:          { label: 'Retornou',          icon: '↩️', color: '#aaa'    },
  disciplina:            { label: 'Disciplina',        icon: '⚠️', color: '#FF4444' },
  intervencao:           { label: 'Intervenção',       icon: '🚨', color: '#FF4444' },
  intervencao_encerrada: { label: 'Interv. encerrada', icon: '✅', color: '#00ff88' },
}

const STATUS_COR = {
  verde:    { cor: '#00ff88', label: 'Normal'      },
  amarelo:  { cor: '#FFD700', label: 'Aluno fora'  },
  laranja:  { cor: '#FF8C00', label: 'Atenção'     },
  vermelho: { cor: '#FF4444', label: 'Intervenção' },
}

function calcularStatusSala(events) {
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

function roomName(room) {
  const shift = SHIFT_LABEL[room.shift] ?? room.shift ?? ''
  return room.hero_name
    ? `${room.name} ${shift} · ${room.hero_name}`
    : `${room.name} ${shift}`
}

function elapsed(since) {
  const mins = Math.floor((Date.now() - new Date(since)) / 60000)
  if (mins < 60) return `${mins}min`
  return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}`
}

// Timer ao vivo para aluno fora da sala
function ExitTimer({ exit }) {
  const [secs, setSecs] = useState(() =>
    Math.floor((Date.now() - new Date(exit.created_at)) / 1000)
  )
  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const mins = Math.floor(secs / 60)
  const s    = secs % 60
  const display = mins > 0 ? `${mins}min ${String(s).padStart(2, '0')}s` : `${secs}s`
  const alert   = mins >= 5

  return (
    <div className={`exit-timer ${alert ? 'exit-timer-alert' : ''}`}>
      <span className="exit-timer-name">🚪 {exit.student_ref ?? 'Aluno'}{exit.notes ? ` · ${exit.notes}` : ''}</span>
      <span className={`exit-timer-clock ${alert ? 'exit-clock-alert' : ''}`}>
        {display}
      </span>
    </div>
  )
}

export default function SupervisorDashboard() {
  const [liveEvents, setLiveEvents] = useState([])
  const wsRef = useRef(null)

  const { data: classrooms = [], refetch: refetchRooms }     = trpc.supervisor.allClassrooms.useQuery()
  const { data: occupancy  = [], refetch: refetchOccupancy } = trpc.checkin.occupancy.useQuery()
  const { data: recentEvents = [] }                          = trpc.supervisor.recentEvents.useQuery({ limit: 100 })

  // Mapa de salas ocupadas
  const occupiedMap = useMemo(() => {
    const m = {}
    occupancy.forEach(o => { m[o.classroom_id] = o })
    return m
  }, [occupancy])

  // Alunos fora da sala: calcula a partir dos eventos (ao vivo + histórico)
  const exitsByRoom = useMemo(() => {
    const all    = [...recentEvents, ...liveEvents]
    const sorted = [...all].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const map    = {}   // key: `classroomId:studentRef` → event

    for (const ev of sorted) {
      if (!ev.student_ref) continue
      const key = `${ev.classroom_id}:${ev.student_ref}`
      if (ev.type === 'saida_sala')   map[key] = ev
      if (ev.type === 'retorno_sala') delete map[key]
    }

    const byRoom = {}
    Object.values(map).forEach(ev => {
      if (!byRoom[ev.classroom_id]) byRoom[ev.classroom_id] = []
      byRoom[ev.classroom_id].push(ev)
    })
    return byRoom
  }, [recentEvents, liveEvents])

  useEffect(() => {
    const apiBase = (import.meta.env.VITE_API_URL ?? import.meta.env.API_URL ?? 'http://localhost:3001').replace(/^http/, 'ws')
    const ws = new WebSocket(`${apiBase}/ws?roomId=supervisor`)
    wsRef.current = ws
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'event') {
          setLiveEvents(prev => [data.event, ...prev.slice(0, 99)])
          refetchRooms()
        }
        if (data.type === 'checkin' || data.type === 'checkout') {
          refetchOccupancy()
        }
      } catch {}
    }
    return () => ws.close()
  }, [])

  const allEvents = useMemo(() =>
    [...liveEvents, ...recentEvents].slice(0, 50),
    [liveEvents, recentEvents]
  )

  const totalOut = Object.values(exitsByRoom).reduce((acc, arr) => acc + arr.length, 0)

  return (
    <div className="supervisor-page">
      <header className="page-header">
        <h1 className="page-title">Supervisão</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="sup-badge-green">{occupancy.length} sala(s) ativas</span>
          {totalOut > 0 && (
            <span className="sup-badge-orange">🚪 {totalOut} aluno(s) fora</span>
          )}
        </div>
      </header>

      {/* Grade de salas */}
      <div className="classrooms-grid" style={{ marginBottom: '2.5rem' }}>
        {classrooms.map(room => {
          const occ       = occupiedMap[room.id]
          const exits     = exitsByRoom[room.id] ?? []
          const evsSala   = allEvents.filter(e => e.classroom_id === room.id)
          const statusKey = occ ? calcularStatusSala(evsSala) : 'verde'
          const status    = STATUS_COR[statusKey]

          return (
            <div key={room.id} className={`classroom-card ${occ ? 'classroom-occupied' : ''} ${exits.length > 0 ? 'classroom-has-exits' : ''}`}
              style={{ borderColor: occ ? status.cor + '66' : undefined }}>

              {/* Status */}
              <div className="cc-status">
                <span className={`cc-dot ${occ ? 'cc-dot-on' : 'cc-dot-off'}`} style={{ background: occ ? status.cor : undefined }} />
                <span className="cc-status-label">{occ ? status.label : 'Vazia'}</span>
                {statusKey === 'vermelho' && <span className="cc-intervencao-badge">🚨 INTERVENÇÃO</span>}
              </div>

              {/* Nome */}
              <div className="cc-info">
                <span className="cc-name">{roomName(room)}</span>
                <span className="cc-seg">{SEG_LABEL[room.segment]}</span>
              </div>

              {/* Professor */}
              {occ ? (
                <div className="cc-teacher-info">
                  <span className="cc-teacher-name">👨‍🏫 {occ.room_staff?.name}</span>
                  <span className="cc-teacher-since">
                    {new Date(occ.checked_in_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {' '}· {elapsed(occ.checked_in_at)}
                  </span>
                </div>
              ) : (
                <span className="cc-empty-label">Sem professor</span>
              )}

              {/* Timers de alunos fora */}
              {exits.length > 0 && (
                <div className="exits-list">
                  {exits.map(ex => <ExitTimer key={ex.id} exit={ex} />)}
                </div>
              )}

              {/* XP */}
              <div className="cc-xp-wrap" style={{ marginTop: 'auto' }}>
                <span className="cc-xp">{(room.xp ?? 0).toLocaleString('pt-BR')}</span>
                <span className="cc-xp-label">XP · Nível {room.level}</span>
              </div>
            </div>
          )
        })}
        {classrooms.length === 0 && <p className="empty-state">Nenhuma sala cadastrada.</p>}
      </div>

      {/* Eventos ao vivo */}
      <section>
        <h2 className="section-label">
          Eventos ao vivo
          {liveEvents.length > 0 && <span className="live-dot">● AO VIVO</span>}
        </h2>
        <div className="feed-list">
          {allEvents.map((ev, i) => {
            const info = EVENT_LABEL[ev.type] ?? { label: ev.type, icon: '•', color: '#aaa' }
            const isNew = liveEvents.some(l => l.id === ev.id)
            return (
              <div key={ev.id ?? i} className={`feed-item ${isNew ? 'feed-item-new' : ''}`}>
                <span className="feed-icon">{info.icon}</span>
                <span className="feed-type" style={{ color: info.color }}>{info.label}</span>
                <span className="feed-room">{ev.room_classrooms?.name ?? '—'}</span>
                {ev.student_ref && <span className="feed-student">{ev.student_ref}</span>}
                {ev.notes && <span className="feed-reason">({ev.notes})</span>}
                <span className={`feed-xp ${ev.xp_value > 0 ? 'xp-pos' : ev.xp_value < 0 ? 'xp-neg' : 'xp-neutral'}`}>
                  {ev.xp_value !== 0 ? (ev.xp_value > 0 ? `+${ev.xp_value}` : ev.xp_value) : '—'}
                </span>
                <span className="feed-time">
                  {new Date(ev.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )
          })}
          {allEvents.length === 0 && <p className="empty-state">Sem eventos ainda.</p>}
        </div>
      </section>
    </div>
  )
}
