import React from 'react'
import { trpc } from '../../lib/trpc'

const SEG_LABEL    = { fund1: 'Fund. I', fund2: 'Fund. II', medio: 'Médio' }
const TYPE_LABEL   = { tarefa: 'Tarefa', prova: 'Estudo p/ Prova' }
const STATUS_COLOR = { active: '#00ff88', completed: '#FFD700', expired: '#FF4444' }
const STATUS_LABEL = { active: 'Ativa', completed: 'Concluída', expired: 'Expirada' }

export default function DirectorPanel() {
  const { data: classrooms = [] } = trpc.supervisor.allClassrooms.useQuery()
  const { data: ranking = [] }    = trpc.supervisor.weeklyRanking.useQuery()
  const { data: tasks = [] }      = trpc.task.list.useQuery({})

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

      <section className="director-tasks">
        <h2 className="section-label">Tarefas da Escola</h2>
        {tasks.length === 0 ? (
          <p className="empty-state" style={{ padding: '1rem' }}>Nenhuma tarefa criada.</p>
        ) : (
          <div className="director-task-list">
            {tasks.map(task => {
              const pct   = task.target_count > 0
                ? Math.min(Math.round((task.completion_count / task.target_count) * 100), 100)
                : 0
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
