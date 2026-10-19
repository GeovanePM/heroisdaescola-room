import React from 'react'
import { useAuth } from '../../contexts/AuthContext'

const GUARDIANS_URL = 'https://guardioes-dos-numeros-silk.vercel.app'

const GAMES = [
  {
    id:        'guardioes',
    title:     'Guardioes dos Numeros',
    desc:      'Matematica epica para o 5 ano. Fracoes, problemas e raciocinio logico com 4 herois.',
    status:    'available',
    url:       GUARDIANS_URL,
    heroes:    [
      { initial: 'M', color: '#00BFFF' },
      { initial: 'P', color: '#FFD700' },
      { initial: 'G', color: '#FF4444' },
      { initial: 'N', color: '#CC44FF' },
    ],
  },
  {
    id:     'missoes',
    title:  'Missoes da Sala',
    desc:   'Em breve: missoes diarias baseadas no conteudo da aula, valendo XP extra para a turma.',
    status: 'soon',
  },
  {
    id:     'quiz',
    title:  'Quiz Relampago',
    desc:   'Em breve: quiz de multipla escolha cronometrado para toda a turma jogar junto.',
    status: 'soon',
  },
  {
    id:     'batalha',
    title:  'Batalha de Herois',
    desc:   'Em breve: modo PvP entre turmas em tempo real.',
    status: 'soon',
  },
]

export default function GamesHub() {
  const { user } = useAuth()

  return (
    <div className="games-page">
      <header className="page-header">
        <h1 className="page-title">Jogos Educativos</h1>
        {user && <p className="page-subtitle">Ola, {user.name}! Escolha um jogo para comecar.</p>}
      </header>

      <div className="games-grid">
        {GAMES.map(game => (
          <div
            key={game.id}
            className={`game-card ${game.status === 'available' ? 'game-card-available' : 'game-card-soon'}`}
          >
            <div className="game-card-header">
              <span className="game-title">{game.title}</span>
              <span className={`game-badge ${game.status === 'available' ? 'game-badge-available' : 'game-badge-soon'}`}>
                {game.status === 'available' ? 'Disponivel' : 'Em breve'}
              </span>
            </div>

            <p className="game-desc">{game.desc}</p>

            {game.heroes && (
              <div className="game-hero-dots">
                {game.heroes.map(h => (
                  <div
                    key={h.initial}
                    className="game-hero-dot"
                    style={{ background: h.color, color: '#000' }}
                  >
                    {h.initial}
                  </div>
                ))}
              </div>
            )}

            {game.url && (
              <button
                className="game-action"
                onClick={() => window.open(game.url, '_blank', 'noopener')}
              >
                Jogar agora
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
