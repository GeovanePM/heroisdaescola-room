import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { trpc } from '../lib/trpc'

const ROLE_REDIRECT = {
  teacher:       '/app/sala',
  supervisor:    '/app/supervisor',
  vice_director: '/app/supervisor',
  director:      '/app/diretor',
  admin:         '/app/admin',
}

export default function Login() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [email, setEmail]   = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]   = useState('')

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess(data) {
      login(data.token, { name: data.name, role: data.role, schoolId: data.schoolId })
      navigate(ROLE_REDIRECT[data.role] ?? '/app/sala')
    },
    onError(err) {
      setError(err.message)
    },
  })

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    loginMutation.mutate({ email, password })
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <a href="/" className="login-back">← Voltar ao início</a>
        <div className="login-logo-wrap">
          <img src="/assets/logo.png" alt="Heróis da Escola" className="login-logo" />
          <span className="login-room-tag">Room</span>
        </div>
        <h1 className="login-title">Acesse sua conta</h1>
        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label">
            E-mail
            <input
              type="email"
              className="login-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="professor@escola.edu.br"
              required
              autoFocus
            />
          </label>
          <label className="login-label">
            Senha
            <input
              type="password"
              className="login-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button
            type="submit"
            className="btn-login"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>

      <div className="login-stars" aria-hidden>
        {Array.from({ length: 16 }).map((_, i) => (
          <span key={i} className="star" style={{ left: `${(i * 43 + 7) % 100}%`, top: `${(i * 61 + 13) % 100}%`, animationDelay: `${i * 0.4}s` }}>✦</span>
        ))}
      </div>
    </div>
  )
}
