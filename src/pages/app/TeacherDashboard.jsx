import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { trpc } from '../../lib/trpc'

const SHIFT_LABEL = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

const EVENT_LABELS = {
  participacao: { label: 'Participou',    icon: '⚡', xp: +10, color: '#00ff88' },
  pontualidade: { label: 'Pontual',       icon: '⏱️', xp: +5,  color: '#FFD700' },
  saida_sala:   { label: 'Saiu da sala',  icon: '🚪', xp: 0,   color: '#aaa' },
  retorno_sala: { label: 'Retornou',      icon: '↩️', xp: 0,   color: '#aaa' },
  disciplina:   { label: 'Disciplina',    icon: '⚠️', xp: -5,  color: '#FF4444' },
}

function roomLabel(room) {
  if (!room) return ''
  const shift = SHIFT_LABEL[room.shift] ?? room.shift
  return room.hero_name ? `${room.name} ${shift} · ${room.hero_name}` : `${room.name} ${shift}`
}

export default function TeacherDashboard() {
  const { token } = useAuth()
  const navigate  = useNavigate()
  const [studentRef, setStudentRef] = useState('')
  const [wsEvents,  setWsEvents]    = useState([])
  const wsRef = useRef(null)

  const { data: status, refetch: refetchStatus } = trpc.checkin.myStatus.useQuery()
  const { data: rooms = [] } = trpc.classroom.myRooms.useQuery()

  const activeRoom = status?.room_classrooms ?? null
  const classroomId = activeRoom?.id

  const { data: events = [], refetch: refetchEvents } = trpc.event.list.useQuery(
    { classroomId: classroomId ?? '' },
    { enabled: !!classroomId }
  )

  const exitMutation = trpc.checkin.exit.useMutation({
    onSuccess() { refetchStatus(); setWsEvents([]) },
  })

  const registerMutation = trpc.event.register.useMutation({
    onSuccess() { refetchEvents() },
  })

  // WebSocket conectado à sala ativa
  useEffect(() => {
    if (!classroomId) { wsRef.current?.close(); return }
    const apiBase = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/^http/, 'ws')
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

  function register(type) {
    if (!classroomId) return
    registerMutation.mutate({ classroomId, type, studentRef: studentRef || undefined })
    setStudentRef('')
  }

  const allEvents = [...wsEvents, ...events].slice(0, 30)

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

      {/* Status de check-in */}
      {!activeRoom ? (
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
      ) : (
        <>
          {/* Cabeçalho da sala ativa */}
          <div className="active-room-bar">
            <div className="active-room-info">
              <span className="active-room-dot" />
              <span className="active-room-label">{roomLabel(activeRoom)}</span>
              <span className="active-room-since">
                desde {new Date(status.checked_in_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <button
              className="btn-checkout"
              onClick={() => exitMutation.mutate()}
              disabled={exitMutation.isPending}
            >
              🚪 Sair da sala
            </button>
          </div>

          <div className="sala-grid">
            {/* XP da turma */}
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

            {/* Registrar evento */}
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
            </div>

            {/* Log de eventos */}
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
      )}
    </div>
  )
}
