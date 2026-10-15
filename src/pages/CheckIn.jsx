import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { trpc } from '../lib/trpc'
import { useAuth } from '../contexts/AuthContext'

const SHIFT_LABEL = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

export default function CheckIn() {
  const { classroomId } = useParams()
  const { isAuth, user } = useAuth()
  const navigate = useNavigate()
  const [done, setDone] = useState(false)
  const [roomLabel, setRoomLabel] = useState('')

  const { data: room, isLoading: loadingRoom } = trpc.checkin.roomInfo.useQuery(
    { classroomId: classroomId ?? '' },
    { enabled: !!classroomId }
  )

  const enterMutation = trpc.checkin.enter.useMutation({
    onSuccess(data) {
      const r = data.room
      const shift = SHIFT_LABEL[r.shift] ?? r.shift
      setRoomLabel(r.hero_name ? `${r.name} ${shift} · ${r.hero_name}` : `${r.name} ${shift}`)
      setDone(true)
      setTimeout(() => navigate('/app/sala'), 2500)
    },
  })

  useEffect(() => {
    if (!isAuth && !loadingRoom) {
      navigate(`/login?return=/check-in/${classroomId}`)
    }
  }, [isAuth, loadingRoom])

  if (!isAuth) return null

  if (loadingRoom) return (
    <div className="checkin-page">
      <div className="checkin-card">
        <p className="checkin-loading">Carregando sala...</p>
      </div>
    </div>
  )

  if (!room) return (
    <div className="checkin-page">
      <div className="checkin-card">
        <h2>Sala não encontrada</h2>
        <p>QR Code inválido ou sala inativa.</p>
      </div>
    </div>
  )

  const shift = SHIFT_LABEL[room.shift] ?? room.shift
  const display = room.hero_name
    ? `${room.name} ${shift} · ${room.hero_name}`
    : `${room.name} ${shift}`

  if (done) return (
    <div className="checkin-page">
      <div className="checkin-card checkin-success">
        <div className="checkin-ok-icon">✓</div>
        <h2 className="checkin-title">Check-in realizado!</h2>
        <p className="checkin-room-name">{roomLabel}</p>
        <p className="checkin-sub">Redirecionando para o painel...</p>
      </div>
    </div>
  )

  return (
    <div className="checkin-page">
      <div className="checkin-card">
        {room.hero_image_url
          ? <img src={room.hero_image_url} alt={room.hero_name} className="checkin-hero-img" />
          : <div className="checkin-hero-placeholder">S</div>
        }

        <h2 className="checkin-title">{display}</h2>
        <p className="checkin-school">{room.room_schools?.name ?? ''}</p>
        <p className="checkin-greeting">Olá, <strong>{user?.name}</strong></p>

        {enterMutation.error && (
          <p className="checkin-error">{enterMutation.error.message}</p>
        )}

        <button
          className="btn-checkin"
          onClick={() => enterMutation.mutate({ classroomId })}
          disabled={enterMutation.isPending}
        >
          {enterMutation.isPending ? 'Registrando...' : 'Entrar na Sala'}
        </button>

        <button className="btn-checkin-cancel" onClick={() => navigate('/app/sala')}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
