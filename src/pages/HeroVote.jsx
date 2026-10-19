import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { trpc } from '../lib/trpc'

const SHIFT_LABEL = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

export default function HeroVote() {
  const { classroomId } = useParams()
  const [studentName, setStudentName] = useState('')
  const [heroName,    setHeroName]    = useState('')
  const [done,        setDone]        = useState(false)

  const { data: room, isLoading } = trpc.hero.roomInfo.useQuery(
    { classroomId: classroomId ?? '' },
    { enabled: !!classroomId }
  )

  const voteMut = trpc.hero.vote.useMutation({
    onSuccess() { setDone(true) },
  })

  if (isLoading) return (
    <div className="vote-page">
      <div className="vote-card">
        <p style={{ color: 'var(--text-dim)' }}>Carregando...</p>
      </div>
    </div>
  )

  if (!room) return (
    <div className="vote-page">
      <div className="vote-card">
        <h2>Sala não encontrada</h2>
      </div>
    </div>
  )

  const shift = SHIFT_LABEL[room.shift] ?? room.shift

  // Herói já eleito
  if (room.hero_name) return (
    <div className="vote-page">
      <div className="vote-card">
        {room.hero_image_url
          ? <img src={room.hero_image_url} alt={room.hero_name} className="vote-elected-img" />
          : <div className="vote-hero-placeholder">S</div>
        }
        <h2 className="vote-title">{room.name} {shift}</h2>
        <div className="vote-elected-box">
          <p className="vote-elected-label">Herói eleito</p>
          <p className="vote-elected-name">{room.hero_name}</p>
        </div>
        <p className="vote-subtitle">A votação desta turma já foi encerrada.</p>
      </div>
    </div>
  )

  if (done) return (
    <div className="vote-page">
      <div className="vote-card">
        <div className="vote-hero-placeholder">S</div>
        <p className="vote-success">Voto registrado!</p>
        <p className="vote-subtitle">Obrigado, <strong>{studentName}</strong>! Aguarde o resultado.</p>
      </div>
    </div>
  )

  function submit(e) {
    e.preventDefault()
    if (!studentName.trim() || !heroName.trim()) return
    voteMut.mutate({ classroomId, studentName: studentName.trim(), heroName: heroName.trim() })
  }

  return (
    <div className="vote-page">
      <div className="vote-card">
        <div className="vote-hero-placeholder">S</div>
        <h2 className="vote-title">{room.name} {shift}</h2>
        <p className="vote-subtitle">Escolha o nome do herói da sua turma!</p>

        {voteMut.error && (
          <p style={{ color: '#FF6666', fontSize: '0.85rem' }}>{voteMut.error.message}</p>
        )}

        <form className="vote-form" onSubmit={submit}>
          <input
            className="form-input"
            placeholder="Seu nome"
            value={studentName}
            onChange={e => setStudentName(e.target.value)}
            required
          />
          <input
            className="form-input"
            placeholder="Nome do herói que você sugere"
            value={heroName}
            onChange={e => setHeroName(e.target.value)}
            required
          />
          <button
            className="btn-checkin"
            type="submit"
            disabled={voteMut.isPending}
          >
            {voteMut.isPending ? 'Enviando...' : 'Votar'}
          </button>
        </form>
      </div>
    </div>
  )
}
