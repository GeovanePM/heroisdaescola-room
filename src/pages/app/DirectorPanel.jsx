import React from 'react'
import { trpc } from '../../lib/trpc'

const SEG_LABEL = { fund1: 'Fund. I', fund2: 'Fund. II', medio: 'Médio' }

export default function DirectorPanel() {
  const { data: classrooms = [] } = trpc.supervisor.allClassrooms.useQuery()
  const { data: ranking = [] }    = trpc.supervisor.weeklyRanking.useQuery()

  const totalXp  = classrooms.reduce((acc, c) => acc + (c.xp ?? 0), 0)
  const totalRooms = classrooms.length

  return (
    <div className="director-page">
      <header className="page-header">
        <h1 className="page-title">Visão Geral — Direção</h1>
        <p className="page-subtitle">Desempenho consolidado de toda a escola</p>
      </header>

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
            <span>#</span>
            <span>Turma</span>
            <span>Segmento</span>
            <span>Nível</span>
            <span>XP</span>
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
          {ranking.length === 0 && (
            <p className="empty-state" style={{ padding: '1.5rem', textAlign: 'center' }}>Sem dados ainda.</p>
          )}
        </div>
      </section>
    </div>
  )
}
