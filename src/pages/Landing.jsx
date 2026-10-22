import React, { useState, useEffect } from 'react'
import { pingServer } from '../lib/warmup'

const HEROES = [
  { name: 'Mitos',   color: '#00BFFF', glow: 'rgba(0,191,255,0.4)',  img: '/assets/mitos.png',   turma: '6º A' },
  { name: 'Pampee',  color: '#FFD700', glow: 'rgba(255,215,0,0.4)',  img: '/assets/pampee.png',  turma: '7º B' },
  { name: 'Galdios', color: '#FF4444', glow: 'rgba(255,68,68,0.4)',  img: '/assets/galdios.png', turma: '8º C' },
  { name: 'Nia',     color: '#CC44FF', glow: 'rgba(204,68,255,0.4)', img: '/assets/nia.png',     turma: '9º A' },
]

const FEATURES = [
  { icon: '⚡', title: 'XP em Tempo Real',    desc: 'Participação, pontualidade e atividades geram XP para a turma instantaneamente.' },
  { icon: '🃏', title: 'Cartas & Skills',      desc: 'Turmas desbloqueiam cartas raras e habilidades especiais conforme evoluem.' },
  { icon: '📊', title: 'Ranking Semanal',      desc: 'Supervisores e diretores acompanham o desempenho de cada sala em tempo real.' },
  { icon: '🎮', title: 'Jogos Educativos',     desc: 'Missões e jogos integrados que convertem aprendizado em pontos para a turma.' },
  { icon: '🔔', title: 'Alertas via Telegram', desc: 'Notificações instantâneas para supervisores com os eventos da sala.' },
  { icon: '📓', title: 'Diário de Conteúdo',  desc: 'Professor registra o conteúdo ministrado conforme a programação da escola.' },
]

const STEPS = [
  { num: '01', title: 'Escola cadastra as salas', desc: 'Admin configura turmas, professores e supervisores. Cada sala escolhe o nome do seu herói.' },
  { num: '02', title: 'Herói da turma é gerado',  desc: 'Os alunos votam no nome. A IA gera a arte do herói exclusivo daquela turma.' },
  { num: '03', title: 'A batalha começa',          desc: 'Cada atividade, aula e conquista gera XP. A turma sobe no ranking e desbloqueia cartas.' },
]

const RANKING_MOCK = [
  { pos: 1, name: 'Turma Mitos',   xp: 4820, hero: '/assets/mitos.png',   color: '#00BFFF', badge: '🏆' },
  { pos: 2, name: 'Turma Galdios', xp: 4390, hero: '/assets/galdios.png', color: '#FF4444', badge: '🥈' },
  { pos: 3, name: 'Turma Nia',     xp: 3950, hero: '/assets/nia.png',     color: '#CC44FF', badge: '🥉' },
  { pos: 4, name: 'Turma Pampee',  xp: 3710, hero: '/assets/pampee.png',  color: '#FFD700', badge: '' },
]

function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])
  return (
    <nav className={`nav ${scrolled ? 'nav-scrolled' : ''}`}>
      <div className="nav-logo">
        <img src="/assets/logo.png" alt="Heróis da Escola" className="nav-logo-img" />
        <span className="nav-sub-tag">Room</span>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <a href="/login" className="btn-nav-outline">Entrar</a>
        <a href="#contato" className="btn-nav">Quero para minha escola</a>
      </div>
    </nav>
  )
}

function HeroSection() {
  const [active, setActive] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setActive(a => (a + 1) % HEROES.length), 2500)
    return () => clearInterval(t)
  }, [])
  const hero = HEROES[active]

  return (
    <section className="hero-section" style={{ '--hero-color': hero.color, '--hero-glow': hero.glow }}>
      <div className="stars-bg" aria-hidden>
        {Array.from({ length: 24 }).map((_, i) => (
          <span key={i} className="star" style={{ left: `${(i * 37 + 11) % 100}%`, top: `${(i * 53 + 7) % 100}%`, animationDelay: `${i * 0.3}s` }}>✦</span>
        ))}
      </div>

      <div className="hero-logo-wrap">
        <img src="/assets/logo.png" alt="Heróis da Escola" className="hero-logo-main" />
      </div>

      <div className="hero-bottom">
        <div className="hero-content">
          <h1 className="hero-title">
            Sua turma tem<br />
            <span className="hero-title-accent">um herói.</span>
          </h1>
          <p className="hero-desc">
            Gamificação completa de sala de aula — XP, cartas, rankings e jogos educativos que transformam cada aula em uma missão épica.
          </p>
          <div className="hero-ctas">
            <a href="#como-funciona" className="btn-primary-lg">Ver como funciona</a>
            <a href="#contato" className="btn-outline-lg">Falar com a equipe</a>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-characters-row">
            {HEROES.map((h, i) => (
              <button
                key={h.name}
                className={`hero-char-btn ${i === active ? 'hero-char-active' : ''}`}
                style={{ '--c': h.color, '--g': h.glow }}
                onClick={() => setActive(i)}
              >
                <img src={h.img} alt={h.name} className="hero-char-img" />
                <span className="hero-char-name" style={{ color: h.color }}>{h.name}</span>
                <span className="hero-char-turma">{h.turma}</span>
              </button>
            ))}
          </div>
          <div className="hero-xp-bar-wrap" key={active}>
            <span className="xp-bar-label" style={{ color: hero.color }}>{hero.name} — {hero.turma}</span>
            <div className="xp-bar-track"><div className="xp-bar-fill" style={{ background: hero.color }} /></div>
            <span className="xp-bar-pts">4.820 XP esta semana</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function FeaturesSection() {
  return (
    <section className="features-section" id="funcionalidades">
      <div className="section-header">
        <span className="section-tag">Funcionalidades</span>
        <h2 className="section-title">Tudo que sua escola precisa</h2>
        <p className="section-desc">Uma plataforma completa para professores, supervisores e diretores.</p>
      </div>
      <div className="features-grid">
        {FEATURES.map(f => (
          <div key={f.title} className="feature-card">
            <span className="feature-icon">{f.icon}</span>
            <h3 className="feature-title">{f.title}</h3>
            <p className="feature-desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function HowItWorksSection() {
  return (
    <section className="how-section" id="como-funciona">
      <div className="section-header">
        <span className="section-tag">Como funciona</span>
        <h2 className="section-title">Três passos para a aventura</h2>
      </div>
      <div className="steps-list">
        {STEPS.map((s, i) => (
          <div key={s.num} className="step-item">
            <div className="step-num">{s.num}</div>
            <div className="step-body">
              <h3 className="step-title">{s.title}</h3>
              <p className="step-desc">{s.desc}</p>
            </div>
            {i < STEPS.length - 1 && <div className="step-connector" />}
          </div>
        ))}
      </div>
    </section>
  )
}

function RankingPreview() {
  return (
    <section className="ranking-section" id="ranking">
      <div className="section-header">
        <span className="section-tag">Ranking Semanal</span>
        <h2 className="section-title">Quem lidera essa semana?</h2>
        <p className="section-desc">Exibido em tempo real nas TVs da escola. Atualiza automaticamente.</p>
      </div>
      <div className="ranking-card">
        <div className="ranking-header-bar">
          <span className="ranking-escola">Escola Municipal — Semana 42</span>
          <span className="ranking-live">● AO VIVO</span>
        </div>
        <div className="ranking-list">
          {RANKING_MOCK.map(r => (
            <div key={r.pos} className={`ranking-row ${r.pos === 1 ? 'ranking-row-first' : ''}`} style={{ '--rc': r.color }}>
              <span className="rank-badge">{r.badge || `#${r.pos}`}</span>
              <img src={r.hero} alt={r.name} className="rank-hero-img" />
              <span className="rank-name">{r.name}</span>
              <div className="rank-xp-area">
                <span className="rank-xp-value" style={{ color: r.color }}>{r.xp.toLocaleString('pt-BR')}</span>
                <span className="rank-xp-label">XP</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function RolesSection() {
  const roles = [
    { icon: '👨‍🏫', role: 'Professor',  desc: 'Registra presenças, participação, saídas de sala e preenche o diário de conteúdo.' },
    { icon: '👁️',  role: 'Supervisor', desc: 'Acompanha todas as salas em tempo real e valida entradas por amostragem.' },
    { icon: '🏫',  role: 'Direção',    desc: 'Visão geral da escola, relatórios semanais e gestão do programa de premiação.' },
  ]
  return (
    <section className="roles-section">
      <div className="section-header">
        <span className="section-tag">Para cada papel</span>
        <h2 className="section-title">Uma ferramenta para toda a equipe</h2>
      </div>
      <div className="roles-grid">
        {roles.map(r => (
          <div key={r.role} className="role-card">
            <span className="role-icon">{r.icon}</span>
            <h3 className="role-title">{r.role}</h3>
            <p className="role-desc">{r.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

const API = import.meta.env.VITE_API_URL

function ContactSection() {
  const [form, setForm]       = useState({ nome: '', escola: '', email: '', msg: '' })
  const [status, setStatus]   = useState('idle') // idle | loading | sent | error
  const [errMsg, setErrMsg]   = useState('')

  function f(field) {
    return e => setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('loading')
    setErrMsg('')
    try {
      const r = await fetch(`${API}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await r.json()
      if (!r.ok) { setErrMsg(data.error ?? 'Erro ao enviar.'); setStatus('error'); return }
      setStatus('sent')
    } catch {
      setErrMsg('Sem conexão. Verifique sua internet e tente novamente.')
      setStatus('error')
    }
  }

  return (
    <section className="contact-section" id="contato">
      <div className="contact-inner">
        <h2 className="contact-title">Pronta para a aventura?</h2>
        <p className="contact-desc">Leve a gamificação para sua escola. Entre em contato e saiba como começar.</p>

        {status === 'sent' ? (
          <div className="contact-sent">
            ✅ Mensagem enviada! Retornaremos em até 24 horas.
          </div>
        ) : (
          <form className="contact-form" onSubmit={handleSubmit}>
            <input
              className="contact-input"
              placeholder="Seu nome"
              value={form.nome}
              onChange={f('nome')}
              required
              disabled={status === 'loading'}
            />
            <input
              className="contact-input"
              placeholder="Nome da escola"
              value={form.escola}
              onChange={f('escola')}
              required
              disabled={status === 'loading'}
            />
            <input
              className="contact-input"
              type="email"
              placeholder="Seu e-mail para retorno"
              value={form.email}
              onChange={f('email')}
              required
              disabled={status === 'loading'}
            />
            <textarea
              className="contact-input contact-textarea"
              placeholder="Mensagem ou dúvida (opcional)"
              value={form.msg}
              onChange={f('msg')}
              rows={3}
              disabled={status === 'loading'}
            />
            {status === 'error' && <p className="contact-error">{errMsg}</p>}
            <button type="submit" className="btn-contact" disabled={status === 'loading'}>
              {status === 'loading' ? 'Enviando...' : 'Enviar mensagem'}
            </button>
          </form>
        )}

        <p className="contact-sub">Respondemos em até 24 horas · gmaciel@acaditi.com.br</p>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-logo">
        <img src="/assets/logo.png" alt="Heróis da Escola" className="footer-logo-img" />
        <span>Room</span>
      </div>
      <p className="footer-slogan">É divertido estudar!</p>
      <p className="footer-copy">© 2026 Acadi TI. Todos os direitos reservados.</p>
    </footer>
  )
}

export default function Landing() {
  useEffect(() => { pingServer() }, [])
  return (
    <>
      <Nav />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <RankingPreview />
        <RolesSection />
        <ContactSection />
      </main>
      <Footer />
    </>
  )
}
