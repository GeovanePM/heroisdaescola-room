import React, { useEffect, useRef, useState, useMemo } from 'react'
import { trpc } from '../lib/trpc'

const SHIFT_LABEL = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
const MEDAL       = ['🏆', '🥈', '🥉']
const COLORS      = ['#FFD700','#C0C0C0','#CD7F32','#00BFFF','#FF4444','#CC44FF','#00ff88','#FF8C00']

function useNow() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function ExitTimer({ exit }) {
  const [secs, setSecs] = useState(() =>
    Math.floor((Date.now() - new Date(exit.created_at)) / 1000)
  )
  useEffect(() => {
    const id = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const mins  = Math.floor(secs / 60)
  const s     = secs % 60
  const label = mins > 0 ? `${mins}m${String(s).padStart(2,'0')}s` : `${secs}s`
  const alert = mins >= 5
  return (
    <div className={`tv-exit-timer ${alert ? 'tv-exit-alert' : ''}`}>
      <span>{exit.student_ref ?? 'Aluno'}</span>
      <span>{label}</span>
    </div>
  )
}

function elapsed(since) {
  const mins = Math.floor((Date.now() - new Date(since)) / 60000)
  return mins < 60 ? `${mins}min` : `${Math.floor(mins/60)}h${String(mins%60).padStart(2,'0')}`
}

export default function DirectorTV() {
  const now = useNow()
  const wsRef = useRef(null)

  const { data: classrooms  = [], refetch: refRooms }    = trpc.supervisor.allClassrooms.useQuery()
  const { data: occupancy   = [], refetch: refOccupancy } = trpc.checkin.occupancy.useQuery()
  const { data: ranking     = [] }                        = trpc.supervisor.weeklyRanking.useQuery()
  const { data: recentEvents = [] }                       = trpc.supervisor.recentEvents.useQuery({ limit: 200 })
  const [liveEvents, setLiveEvents]                       = useState([])

  const occupiedMap = useMemo(() => {
    const m = {}
    occupancy.forEach(o => { m[o.classroom_id] = o })
    return m
  }, [occupancy])

  const exitsByRoom = useMemo(() => {
    const all    = [...recentEvents, ...liveEvents]
    const sorted = [...all].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const map    = {}
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
        if (data.type === 'event')   setLiveEvents(prev => [data.event, ...prev.slice(0,99)])
        if (data.type === 'checkin' || data.type === 'checkout') refOccupancy()
      } catch {}
    }
    const refInterval = setInterval(() => refRooms(), 30000)
    return () => { ws.close(); clearInterval(refInterval) }
  }, [])

  const maxXp = ranking[0]?.xp ?? 1

  return (
    <div className="tv-page">
      <header className="tv-header">
        <img src="/assets/logo.png" alt="Herois da Escola" className="tv-logo" />
        <div className="tv-header-info">
          <h1 className="tv-title">Painel da Diretoria</h1>
          <p className="tv-subtitle">
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        </div>
        <span className="tv-live">AO VIVO</span>
        <span className="tv-clock">
          {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </header>

      <div className="tv-body">
        {/* Lado esquerdo: salas */}
        <div className="tv-left">
          <p className="tv-section-label">Salas ({occupancy.length} ocupadas)</p>
          <div className="tv-rooms-grid">
            {classrooms.map(room => {
              const occ   = occupiedMap[room.id]
              const exits = exitsByRoom[room.id] ?? []
              const shift = SHIFT_LABEL[room.shift] ?? room.shift
              return (
                <div
                  key={room.id}
                  className={`tv-room-card ${occ ? 'occupied' : ''} ${exits.length ? 'has-exits' : ''}`}
                >
                  <span className="tv-room-name">{room.name} {shift}</span>
                  {occ ? (
                    <>
                      <span className="tv-room-teacher">{occ.room_staff?.name}</span>
                      <span className="tv-room-since">
                        desde {new Date(occ.checked_in_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
                        {' '}· {elapsed(occ.checked_in_at)}
                      </span>
                    </>
                  ) : (
                    <span className="tv-room-empty">Sem professor</span>
                  )}
                  {exits.length > 0 && (
                    <div className="tv-exits">
                      {exits.map(ex => <ExitTimer key={ex.id} exit={ex} />)}
                    </div>
                  )}
                  <span className="tv-room-xp">{(room.xp ?? 0).toLocaleString('pt-BR')} XP · Nv {room.level}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Lado direito: ranking */}
        <div className="tv-right">
          <p className="tv-section-label">Ranking Semanal</p>
          <div className="tv-rank-list">
            {ranking.map((room, idx) => {
              const color = COLORS[idx % COLORS.length]
              const pct   = maxXp > 0 ? Math.round((room.xp / maxXp) * 100) : 0
              return (
                <div key={room.id} className="tv-rank-row">
                  <span className="tv-rank-pos">
                    {idx < 3 ? MEDAL[idx] : `#${idx+1}`}
                  </span>
                  {room.hero_image_url
                    ? <img src={room.hero_image_url} alt={room.hero_name} className="tv-rank-hero" />
                    : <div className="tv-rank-hero-ph" style={{ background: color }}>{(room.hero_name ?? room.name)[0]}</div>
                  }
                  <div className="tv-rank-info">
                    <span className="tv-rank-name">{room.name}</span>
                    {room.hero_name && <span className="tv-rank-hero-name">{room.hero_name}</span>}
                    <div className="tv-rank-bar">
                      <div className="tv-rank-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                  <span className="tv-rank-xp" style={{ color }}>{(room.xp??0).toLocaleString('pt-BR')}</span>
                </div>
              )
            })}
            {ranking.length === 0 && <p style={{ color: 'var(--text-dim)' }}>Sem dados ainda.</p>}
          </div>
        </div>
      </div>

      <footer className="tv-footer">
        <span>Herois da Escola Room &copy; 2026 Acadi TI</span>
        <span>E divertido estudar!</span>
      </footer>
    </div>
  )
}
