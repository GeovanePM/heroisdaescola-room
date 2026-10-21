import React, { useState, useMemo } from 'react'
import { trpc } from '../../lib/trpc'

const TURNO = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
const SEG   = { fund1: 'Fund. I', fund2: 'Fund. II', medio: 'Médio' }

// ── Seletor de período ────────────────────────────────────────────────────────

function PeriodPicker({ value, onChange }) {
  return (
    <div className="rpt-period-picker">
      {[7, 14, 30].map(d => (
        <button
          key={d}
          className={`rpt-period-btn ${value === d ? 'rpt-period-active' : ''}`}
          onClick={() => onChange(d)}
        >
          {d} dias
        </button>
      ))}
    </div>
  )
}

// ── Mini barra horizontal ─────────────────────────────────────────────────────

function Bar({ value, max, color = '#00ff88', label }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="rpt-bar-wrap">
      <span className="rpt-bar-label">{label}</span>
      <div className="rpt-bar-track">
        <div className="rpt-bar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="rpt-bar-val">{value}</span>
    </div>
  )
}

// ── Aba Resumo ────────────────────────────────────────────────────────────────

function AbaResumo() {
  const [days, setDays] = useState(7)
  const { data, isLoading } = trpc.reports.summary.useQuery({ days })

  if (isLoading) return <p className="empty-state">Carregando...</p>
  if (!data) return null

  const { totals, classrooms } = data
  const maxEvents = Math.max(...classrooms.map(c => c.eventCount), 1)
  const sorted = [...classrooms].sort((a, b) => b.xpGained - a.xpGained)

  return (
    <>
      <PeriodPicker value={days} onChange={setDays} />

      <div className="rpt-totals">
        <div className="rpt-total-card">
          <span className="rpt-total-val">{totals.events}</span>
          <span className="rpt-total-lbl">Eventos registrados</span>
        </div>
        <div className="rpt-total-card">
          <span className="rpt-total-val">{totals.exits}</span>
          <span className="rpt-total-lbl">Saídas de sala</span>
        </div>
        <div className="rpt-total-card">
          <span className="rpt-total-val" style={{ color: totals.interventions > 0 ? '#FF4444' : undefined }}>
            {totals.interventions}
          </span>
          <span className="rpt-total-lbl">Intervenções</span>
        </div>
        <div className="rpt-total-card">
          <span className="rpt-total-val" style={{ color: '#00ff88' }}>+{totals.xpGained}</span>
          <span className="rpt-total-lbl">XP ganho</span>
        </div>
        <div className="rpt-total-card">
          <span className="rpt-total-val">{totals.checkins}</span>
          <span className="rpt-total-lbl">Entradas de prof.</span>
        </div>
      </div>

      <h3 className="rpt-section-title">Engajamento por turma</h3>
      <div className="rpt-bars-list">
        {sorted.map(room => (
          <Bar
            key={room.id}
            label={`${room.name} (${TURNO[room.shift] ?? room.shift})`}
            value={room.eventCount}
            max={maxEvents}
            color={room.interventions > 0 ? '#FF4444' : '#00ff88'}
          />
        ))}
        {sorted.length === 0 && <p className="empty-state">Nenhuma turma ainda.</p>}
      </div>

      <h3 className="rpt-section-title" style={{ marginTop: '2rem' }}>Detalhes por turma</h3>
      <div className="rpt-table-wrap">
        <table className="rpt-table">
          <thead>
            <tr>
              <th>Turma</th>
              <th>Eventos</th>
              <th>Saídas</th>
              <th>Intervenções</th>
              <th>XP ganho</th>
              <th>Entradas</th>
              <th>Duração média</th>
            </tr>
          </thead>
          <tbody>
            {classrooms.map(room => (
              <tr key={room.id}>
                <td>
                  <span className="rpt-room-name">{room.name}</span>
                  <span className="rpt-room-sub">{TURNO[room.shift]} · {SEG[room.segment]}</span>
                </td>
                <td className="rpt-num">{room.eventCount}</td>
                <td className="rpt-num">{room.exitCount}</td>
                <td className="rpt-num" style={{ color: room.interventions > 0 ? '#FF4444' : undefined }}>
                  {room.interventions || '—'}
                </td>
                <td className="rpt-num" style={{ color: '#00ff88' }}>+{room.xpGained}</td>
                <td className="rpt-num">{room.checkinCount}</td>
                <td className="rpt-num">
                  {room.avgDurationMin != null
                    ? room.avgDurationMin >= 60
                      ? `${Math.floor(room.avgDurationMin / 60)}h${String(room.avgDurationMin % 60).padStart(2,'0')}m`
                      : `${room.avgDurationMin}min`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── Aba Saídas de Sala ────────────────────────────────────────────────────────

function AbaSaidas() {
  const [days, setDays] = useState(30)
  const { data: exits = [], isLoading } = trpc.reports.topExits.useQuery({ days })

  const topReason = (reasons) => {
    const entries = Object.entries(reasons)
    if (!entries.length) return null
    return entries.sort((a, b) => b[1] - a[1])[0][0]
  }

  return (
    <>
      <PeriodPicker value={days} onChange={setDays} />

      {isLoading ? (
        <p className="empty-state">Carregando...</p>
      ) : exits.length === 0 ? (
        <p className="empty-state">Nenhuma saída registrada no período.</p>
      ) : (
        <>
          <p className="rpt-hint">
            Alunos com nome registrado pelo professor que mais saíram da sala.
            Dados dos últimos {days} dias.
          </p>
          <div className="rpt-table-wrap">
            <table className="rpt-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Aluno</th>
                  <th>Turma</th>
                  <th>Saídas</th>
                  <th>Motivo mais freq.</th>
                </tr>
              </thead>
              <tbody>
                {exits.map((ex, i) => (
                  <tr key={`${ex.classroomId}:${ex.studentRef}`}>
                    <td className="rpt-num" style={{ color: i < 3 ? '#FF8C00' : undefined }}>{i + 1}</td>
                    <td className="rpt-student">{ex.studentRef}</td>
                    <td className="rpt-room-sub">{ex.classroomName}</td>
                    <td className="rpt-num"
                      style={{ color: ex.count >= 5 ? '#FF4444' : ex.count >= 3 ? '#FF8C00' : undefined, fontWeight: 700 }}>
                      {ex.count}
                    </td>
                    <td className="rpt-reason">{topReason(ex.reasons) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

// ── Aba Pontualidade ──────────────────────────────────────────────────────────

function AbaPontualidade() {
  const [days, setDays] = useState(7)
  const { data: checkins = [], isLoading } = trpc.reports.checkinHistory.useQuery({ days })

  const byTeacher = useMemo(() => {
    const map = {}
    for (const c of checkins) {
      const name = c.room_staff?.name ?? '?'
      if (!map[name]) map[name] = { name, sessions: 0, totalMin: 0, rooms: new Set() }
      map[name].sessions++
      if (c.durationMin != null) map[name].totalMin += c.durationMin
      if (c.room_classrooms?.name) map[name].rooms.add(c.room_classrooms.name)
    }
    return Object.values(map).map(t => ({
      ...t,
      avgMin: t.sessions > 0 ? Math.round(t.totalMin / t.sessions) : null,
      rooms: [...t.rooms],
    })).sort((a, b) => b.sessions - a.sessions)
  }, [checkins])

  return (
    <>
      <PeriodPicker value={days} onChange={setDays} />

      {isLoading ? (
        <p className="empty-state">Carregando...</p>
      ) : (
        <>
          <h3 className="rpt-section-title">Resumo por professor</h3>
          {byTeacher.length === 0 ? (
            <p className="empty-state">Nenhuma entrada registrada no período.</p>
          ) : (
            <div className="rpt-table-wrap">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>Professor</th>
                    <th>Entradas</th>
                    <th>Duração média</th>
                    <th>Turmas</th>
                  </tr>
                </thead>
                <tbody>
                  {byTeacher.map(t => (
                    <tr key={t.name}>
                      <td>{t.name}</td>
                      <td className="rpt-num">{t.sessions}</td>
                      <td className="rpt-num">
                        {t.avgMin != null
                          ? t.avgMin >= 60
                            ? `${Math.floor(t.avgMin / 60)}h${String(t.avgMin % 60).padStart(2,'0')}m`
                            : `${t.avgMin}min`
                          : '—'}
                      </td>
                      <td className="rpt-room-sub">{t.rooms.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="rpt-section-title" style={{ marginTop: '1.5rem' }}>Histórico detalhado</h3>
          {checkins.length === 0 ? (
            <p className="empty-state">Sem registros.</p>
          ) : (
            <div className="rpt-table-wrap">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Professor</th>
                    <th>Sala</th>
                    <th>Entrada</th>
                    <th>Saída</th>
                    <th>Duração</th>
                  </tr>
                </thead>
                <tbody>
                  {checkins.slice(0, 50).map(c => {
                    const dt = new Date(c.checked_in_at)
                    return (
                      <tr key={c.id}>
                        <td className="rpt-date">{dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</td>
                        <td>{c.room_staff?.name ?? '—'}</td>
                        <td className="rpt-room-sub">{c.room_classrooms?.name ?? '—'}</td>
                        <td className="rpt-time">{dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="rpt-time">
                          {c.checked_out_at
                            ? new Date(c.checked_out_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                            : <span style={{ color: '#00ff88' }}>● Ativo</span>}
                        </td>
                        <td className="rpt-num">
                          {c.durationMin != null
                            ? c.durationMin >= 60
                              ? `${Math.floor(c.durationMin / 60)}h${String(c.durationMin % 60).padStart(2,'0')}m`
                              : `${c.durationMin}min`
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  )
}

// ── Aba XP e Evolução ─────────────────────────────────────────────────────────

const COLORS = ['#00ff88', '#FFD700', '#FF8C00', '#00bfff', '#ff69b4', '#c084fc']

function AbaXP() {
  const [days, setDays] = useState(14)
  const { data: rooms = [], isLoading } = trpc.reports.xpEvolution.useQuery({ days })

  const allDays = useMemo(() => {
    const days_set = new Set()
    rooms.forEach(r => Object.keys(r.dailyXp).forEach(d => days_set.add(d)))
    return [...days_set].sort()
  }, [rooms])

  const maxDaily = useMemo(() => {
    let m = 1
    rooms.forEach(r => Object.values(r.dailyXp).forEach(v => { if (v > m) m = v }))
    return m
  }, [rooms])

  return (
    <>
      <PeriodPicker value={days} onChange={setDays} />

      {isLoading ? (
        <p className="empty-state">Carregando...</p>
      ) : rooms.length === 0 ? (
        <p className="empty-state">Nenhum XP registrado no período.</p>
      ) : (
        <>
          {/* Ranking geral */}
          <h3 className="rpt-section-title">XP total acumulado (todas as turmas)</h3>
          <div className="rpt-bars-list">
            {rooms.map((r, i) => (
              <Bar
                key={r.classroomId}
                label={r.name}
                value={r.xpTotal}
                max={rooms[0].xpTotal}
                color={COLORS[i % COLORS.length]}
              />
            ))}
          </div>

          {/* Gráfico de barras por dia */}
          <h3 className="rpt-section-title" style={{ marginTop: '2rem' }}>XP ganho por dia</h3>
          <p className="rpt-hint">Cada barra representa o XP ganho naquele dia. Barras maiores = mais engajamento.</p>

          <div className="rpt-chart-wrap">
            {allDays.map(day => {
              const total = rooms.reduce((acc, r) => acc + (r.dailyXp[day] ?? 0), 0)
              return (
                <div key={day} className="rpt-chart-col">
                  <span className="rpt-chart-val">{total > 0 ? total : ''}</span>
                  <div className="rpt-chart-bar-wrap">
                    {rooms.map((r, i) => {
                      const xp = r.dailyXp[day] ?? 0
                      const h = maxDaily > 0 ? Math.round((xp / maxDaily) * 80) : 0
                      return h > 0 ? (
                        <div
                          key={r.classroomId}
                          className="rpt-chart-segment"
                          style={{ height: h, background: COLORS[i % COLORS.length] }}
                          title={`${r.name}: ${xp} XP`}
                        />
                      ) : null
                    })}
                  </div>
                  <span className="rpt-chart-day">
                    {new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Legenda */}
          <div className="rpt-legend">
            {rooms.map((r, i) => (
              <span key={r.classroomId} className="rpt-legend-item">
                <span className="rpt-legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
                {r.name}
              </span>
            ))}
          </div>
        </>
      )}
    </>
  )
}

// ── Aba Intervenções ──────────────────────────────────────────────────────────

function AbaIntervencoes() {
  const [days, setDays] = useState(30)
  const { data: rooms = [], isLoading } = trpc.reports.interventions.useQuery({ days })

  const total = rooms.reduce((acc, r) => acc + r.count, 0)

  return (
    <>
      <PeriodPicker value={days} onChange={setDays} />

      {isLoading ? (
        <p className="empty-state">Carregando...</p>
      ) : total === 0 ? (
        <div className="rpt-empty-green">
          <span style={{ fontSize: '2rem' }}>✅</span>
          <p>Nenhuma intervenção solicitada no período. Ótimo!</p>
        </div>
      ) : (
        <>
          <p className="rpt-hint">
            Total de <strong style={{ color: '#FF4444' }}>{total} intervenção(ões)</strong> nos últimos {days} dias.
          </p>
          {rooms.map(room => (
            <div key={room.classroomName} className="rpt-interv-card">
              <div className="rpt-interv-header">
                <span className="rpt-interv-room">{room.classroomName}</span>
                <span className="rpt-interv-count">{room.count}x</span>
              </div>
              <div className="rpt-interv-list">
                {room.records.slice(0, 10).map((rec, i) => (
                  <div key={i} className="rpt-interv-row">
                    <span className="rpt-interv-teacher">👨‍🏫 {rec.teacher}</span>
                    <span className="rpt-interv-time">
                      {new Date(rec.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </>
  )
}

// ── Principal ─────────────────────────────────────────────────────────────────

const ABAS = [
  { id: 'resumo',      label: '📊 Resumo'       },
  { id: 'saidas',      label: '🚪 Saídas'        },
  { id: 'pontual',     label: '⏱️ Pontualidade'  },
  { id: 'xp',          label: '⚡ XP'            },
  { id: 'intervencoes',label: '🚨 Intervenções'  },
]

export default function ReportsPanel() {
  const [aba, setAba] = useState('resumo')

  return (
    <div className="rpt-page">
      <header className="page-header">
        <h1 className="page-title">Relatórios</h1>
        <p className="page-subtitle">Análise de desempenho e engajamento da escola</p>
      </header>

      <div className="teacher-tabs" style={{ marginBottom: '1.5rem', flexWrap: 'wrap' }}>
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

      <div className="rpt-body">
        {aba === 'resumo'       && <AbaResumo />}
        {aba === 'saidas'       && <AbaSaidas />}
        {aba === 'pontual'      && <AbaPontualidade />}
        {aba === 'xp'           && <AbaXP />}
        {aba === 'intervencoes' && <AbaIntervencoes />}
      </div>
    </div>
  )
}
