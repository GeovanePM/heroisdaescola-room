import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

const NAV_ITEMS = {
  teacher:       [{ to: '/app/sala',       label: '🏫 Minha Sala' }, { to: '/app/games', label: '🎮 Jogos' }],
  supervisor:    [{ to: '/app/supervisor', label: '👁️ Supervisão' }, { to: '/app/qrcodes', label: '📱 QR Codes' }, { to: '/app/games', label: '🎮 Jogos' }, { to: '/director-tv', label: '📺 TV' }],
  vice_director: [{ to: '/app/supervisor', label: '👁️ Supervisão' }, { to: '/app/qrcodes', label: '📱 QR Codes' }, { to: '/app/games', label: '🎮 Jogos' }, { to: '/director-tv', label: '📺 TV' }],
  director:      [{ to: '/app/diretor', label: '🏛️ Visão Geral' }, { to: '/app/admin', label: '⚙️ Admin' }, { to: '/app/supervisor', label: '👁️ Salas ao Vivo' }, { to: '/app/relatorios', label: '📈 Relatórios' }, { to: '/app/qrcodes', label: '📱 QR Codes' }, { to: '/app/games', label: '🎮 Jogos' }, { to: '/director-tv', label: '📺 TV' }],
  admin:         [{ to: '/app/admin', label: '⚙️ Admin' }, { to: '/app/diretor', label: '🏛️ Visão Geral' }, { to: '/app/supervisor', label: '👁️ Salas' }, { to: '/app/relatorios', label: '📈 Relatórios' }, { to: '/app/qrcodes', label: '📱 QR Codes' }, { to: '/app/games', label: '🎮 Jogos' }, { to: '/director-tv', label: '📺 TV' }],
  super_admin:   [{ to: '/app/super', label: '🌐 Central' }],
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const items = NAV_ITEMS[user?.role] ?? []

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-logo">
          <img src="/assets/logo.png" alt="Heróis da Escola" className="sidebar-logo-img" />
          <span className="sidebar-room-tag">Room</span>
        </div>

        <nav className="sidebar-nav">
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <span className="sidebar-user-name">{user?.name}</span>
            <span className="sidebar-user-role">{user?.role}</span>
          </div>
          <button onClick={handleLogout} className="sidebar-logout">Sair</button>
        </div>
      </aside>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
