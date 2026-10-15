import React, { useEffect, useState } from 'react'
import { trpc } from '../lib/trpc'

const SEGMENT_LABEL = { fund1: 'Fundamental I', fund2: 'Fundamental II', medio: 'Ensino Médio' }
const MEDAL = ['🏆', '🥈', '🥉']
const COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', '#00BFFF', '#FF4444', '#CC44FF', '#00ff88', '#FF8C00']

export default function RankingTV() {
  const [tick, setTick] = useState(0)
  const { data: classrooms = [], refetch } = trpc.supervisor.weeklyRanking.useQuery()

  useEffect(() => {
    const id = setInterval(() => { setTick(t => t + 1); refetch() }, 30000)
    return () => clearInterval(id)
  }, [])

  const maxXp = classrooms[0]?.xp ?? 1

  return (
    <div className="tv-page">
      <div className="tv-header">
        <img src="/assets/logo.png" alt="Heróis da Escola" className="tv-logo" />
        <div>
          <h1 className="tv-title">Ranking Semanal</h1>
          <p className="tv-subtitle">Atualizado em tempo real — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
        </div>
        <span className="tv-live">● AO VIVO</span>
      </div>

      <div className="tv-ranking">
        {classrooms.map((room, idx) => {
          const color = COLORS[idx % COLORS.length]
          const pct   = maxXp > 0 ? Math.round((room.xp / maxXp) * 100) : 0

          return (
            <div key={room.id} className="tv-row" style={{ '--rc': color, animationDelay: `${idx * 0.12}s` }}>
              <div className="tv-pos">
                {idx < 3 ? <span className="tv-medal">{MEDAL[idx]}</span> : <span className="tv-rank-num">#{idx + 1}</span>}
              </div>

              {room.hero_image_url ? (
                <img src={room.hero_image_url} alt={room.hero_name ?? room.name} className="tv-hero-img" />
              ) : (
                <div className="tv-hero-placeholder" style={{ background: color }}>
                  {room.hero_name?.[0] ?? room.name[0]}
                </div>
              )}

              <div className="tv-room-info">
                <span className="tv-room-name">{room.name}</span>
                {room.hero_name && <span className="tv-hero-name">{room.hero_name}</span>}
                <span className="tv-seg">{SEGMENT_LABEL[room.segment]}</span>
              </div>

              <div className="tv-xp-area">
                <div className="tv-xp-bar-track">
                  <div className="tv-xp-bar-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
                <span className="tv-xp-value" style={{ color }}>{(room.xp ?? 0).toLocaleString('pt-BR')} XP</span>
              </div>

              <div className="tv-level">Nível {room.level}</div>
            </div>
          )
        })}

        {classrooms.length === 0 && (
          <div className="tv-empty">Aguardando dados da escola...</div>
        )}
      </div>

      <div className="tv-footer">
        <span>Heróis da Escola Room © 2026 Acadi TI</span>
        <span>É divertido estudar!</span>
      </div>
    </div>
  )
}
