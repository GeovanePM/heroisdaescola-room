import React, { useState } from 'react'
import { trpc } from '../../lib/trpc'

const UF_LIST = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

function engagementInfo(eventsWeek) {
  if (eventsWeek > 50) return { label: 'Alto',  cor: '#00ff88', icon: '🟢' }
  if (eventsWeek > 10) return { label: 'Médio', cor: '#FFD700', icon: '🟡' }
  return                        { label: 'Baixo', cor: '#FF4444', icon: '🔴' }
}

const FORM_EMPTY = {
  schoolName: '', city: '', state: 'MG',
  directorName: '', directorEmail: '', directorPass: '',
}

export default function SuperAdminPanel() {
  const utils = trpc.useUtils()
  const [modal,  setModal]  = useState(false)
  const [result, setResult] = useState(null)
  const [form,   setForm]   = useState(FORM_EMPTY)
  const [err,    setErr]    = useState('')
  const [credModal, setCredModal] = useState(null) // { email, name, password }

  const { data: stats }              = trpc.superAdmin.globalStats.useQuery()
  const { data: schools = [], isLoading } = trpc.superAdmin.listSchools.useQuery()

  const createMut = trpc.superAdmin.createSchool.useMutation({
    onSuccess(data) {
      utils.superAdmin.listSchools.invalidate()
      utils.superAdmin.globalStats.invalidate()
      setResult(data)
    },
    onError(e) { setErr(e.message) },
  })

  const toggleMut = trpc.superAdmin.toggleSchool.useMutation({
    onSuccess() { utils.superAdmin.listSchools.invalidate() },
  })

  const resetMut = trpc.superAdmin.resetDirectorPassword.useMutation({
    onSuccess(data) { setCredModal(data) },
    onError(e) { alert('Erro: ' + e.message) },
  })

  function fecharModal() {
    setModal(false)
    setResult(null)
    setForm(FORM_EMPTY)
    setErr('')
  }

  function f(field) {
    return e => setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  function criar() {
    if (!form.schoolName.trim())   { setErr('Nome da escola obrigatório'); return }
    if (!form.city.trim())         { setErr('Cidade obrigatória'); return }
    if (!form.directorName.trim()) { setErr('Nome do diretor obrigatório'); return }
    if (!form.directorEmail.trim()){ setErr('E-mail do diretor obrigatório'); return }
    if (form.directorPass.length < 6) { setErr('Senha mínima de 6 caracteres'); return }
    setErr('')
    createMut.mutate(form)
  }

  return (
    <div className="super-page">
      <header className="page-header">
        <h1 className="page-title">Central Heróis da Escola</h1>
        <p className="page-subtitle">Gestão global de todas as escolas parceiras</p>
      </header>

      {/* Estatísticas globais */}
      {stats && (
        <div className="super-stats">
          <div className="super-stat">
            <span className="super-stat-val">{stats.activeSchools}</span>
            <span className="super-stat-lbl">Escolas ativas</span>
          </div>
          <div className="super-stat">
            <span className="super-stat-val">{stats.activeClassrooms}</span>
            <span className="super-stat-lbl">Turmas ativas</span>
          </div>
          <div className="super-stat">
            <span className="super-stat-val">{stats.activeStaff}</span>
            <span className="super-stat-lbl">Staff ativo</span>
          </div>
          <div className="super-stat">
            <span className="super-stat-val">{stats.eventsThisWeek}</span>
            <span className="super-stat-lbl">Eventos (7 dias)</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
        <button className="btn-admin-add" onClick={() => setModal(true)}>+ Nova Escola</button>
      </div>

      {/* Grade de escolas */}
      {isLoading ? (
        <p className="empty-state">Carregando escolas...</p>
      ) : schools.length === 0 ? (
        <p className="empty-state">Nenhuma escola cadastrada ainda.</p>
      ) : (
        <div className="super-schools-grid">
          {schools.map(school => {
            const eng = engagementInfo(school.eventsWeek)
            return (
              <div key={school.id} className={`super-school-card ${!school.active ? 'super-school-inactive' : ''}`}>
                <div className="super-school-top">
                  <div>
                    <span className="super-school-name">{school.name}</span>
                    <span className="super-school-city">{school.city}, {school.state}</span>
                  </div>
                  <span
                    className="super-school-status"
                    style={{
                      color:      school.active ? '#00ff88' : '#666',
                      background: school.active ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.04)',
                    }}
                  >
                    {school.active ? '● Ativa' : '○ Inativa'}
                  </span>
                </div>

                <div className="super-school-stats">
                  <div className="sss-item">
                    <span className="sss-val">{school.classroomCount}</span>
                    <span className="sss-lbl">Turmas</span>
                  </div>
                  <div className="sss-item">
                    <span className="sss-val">{school.staffCount}</span>
                    <span className="sss-lbl">Staff</span>
                  </div>
                  <div className="sss-item">
                    <span className="sss-val">{school.eventsToday}</span>
                    <span className="sss-lbl">Eventos hoje</span>
                  </div>
                  <div className="sss-item">
                    <span className="sss-val">{school.eventsWeek}</span>
                    <span className="sss-lbl">Esta semana</span>
                  </div>
                </div>

                <div className="super-school-footer">
                  <span
                    className="super-eng-badge"
                    style={{ color: eng.cor, background: eng.cor + '18', border: `1px solid ${eng.cor}44` }}
                  >
                    {eng.icon} Engajamento {eng.label}
                  </span>
                  <span className="super-access-code">#{school.access_code}</span>
                </div>

                <div className="super-school-actions">
                  <button
                    className="btn-sm btn-sm-ghost"
                    onClick={() => {
                      if (confirm(`Isso vai gerar uma NOVA senha para o diretor de "${school.name}". Confirmar?`))
                        resetMut.mutate({ schoolId: school.id })
                    }}
                    disabled={resetMut.isPending}
                  >
                    🔑 Credenciais
                  </button>
                  <button
                    className={school.active ? 'btn-sm btn-sm-danger' : 'btn-sm btn-sm-ghost'}
                    onClick={() => {
                      const acao = school.active ? 'desativar' : 'ativar'
                      if (confirm(`Confirmar: ${acao} a escola "${school.name}"?`))
                        toggleMut.mutate({ id: school.id, active: !school.active })
                    }}
                    disabled={toggleMut.isPending}
                  >
                    {school.active ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal — formulário de criação */}
      {modal && !result && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nova Escola Parceira</h3>
              <button className="modal-close" onClick={fecharModal}>×</button>
            </div>
            <div className="modal-body">
              {err && <p className="form-error">{err}</p>}

              <p className="form-section-title">Dados da escola</p>
              <div className="form-group">
                <label className="form-label">Nome da escola</label>
                <input className="form-input" placeholder="Ex: E.M. João Paulo II" value={form.schoolName} onChange={f('schoolName')} autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 72px', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Cidade</label>
                  <input className="form-input" placeholder="Ex: Montes Claros" value={form.city} onChange={f('city')} />
                </div>
                <div className="form-group">
                  <label className="form-label">UF</label>
                  <select className="form-select" value={form.state} onChange={f('state')}>
                    {UF_LIST.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                </div>
              </div>

              <p className="form-section-title" style={{ marginTop: '1.25rem' }}>Conta do diretor</p>
              <div className="form-group">
                <label className="form-label">Nome completo</label>
                <input className="form-input" placeholder="Ex: Maria da Silva" value={form.directorName} onChange={f('directorName')} />
              </div>
              <div className="form-group">
                <label className="form-label">E-mail</label>
                <input className="form-input" type="email" placeholder="diretor@escola.edu.br" value={form.directorEmail} onChange={f('directorEmail')} />
              </div>
              <div className="form-group">
                <label className="form-label">Senha inicial</label>
                <input className="form-input" type="text" placeholder="Mínimo 6 caracteres" value={form.directorPass} onChange={f('directorPass')} />
                <p className="form-hint">O diretor poderá alterar a senha pelo painel administrativo.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-cancel" onClick={fecharModal}>Cancelar</button>
              <button className="btn-modal-confirm" onClick={criar} disabled={createMut.isPending}>
                {createMut.isPending ? 'Criando...' : 'Criar escola'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — credenciais do diretor */}
      {credModal && (
        <div className="modal-overlay" onClick={() => setCredModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔑 Credenciais do Diretor</h3>
              <button className="modal-close" onClick={() => setCredModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <p className="form-hint" style={{ marginBottom: '1rem' }}>
                Uma nova senha foi gerada. Compartilhe com o diretor.
              </p>
              <div className="super-result-box">
                <div className="super-result-row">
                  <span className="super-result-key">Diretor</span>
                  <span className="super-result-val">{credModal.name}</span>
                </div>
                <div className="super-result-row">
                  <span className="super-result-key">E-mail</span>
                  <span className="super-result-val">{credModal.email}</span>
                </div>
                <div className="super-result-row">
                  <span className="super-result-key">Nova senha</span>
                  <span className="super-result-val super-result-code">{credModal.password}</span>
                </div>
                <div className="super-result-row">
                  <span className="super-result-key">URL</span>
                  <span className="super-result-val" style={{ fontSize: '0.8rem' }}>room.heroisdaescola.com.br</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-confirm" onClick={() => setCredModal(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — resultado após criação */}
      {modal && result && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✅ Escola criada!</h3>
              <button className="modal-close" onClick={fecharModal}>×</button>
            </div>
            <div className="modal-body">
              <p className="form-hint" style={{ marginBottom: '1rem' }}>
                Compartilhe as informações abaixo com o diretor para o primeiro acesso.
              </p>
              <div className="super-result-box">
                <div className="super-result-row">
                  <span className="super-result-key">Escola</span>
                  <span className="super-result-val">{result.school.name}</span>
                </div>
                <div className="super-result-row">
                  <span className="super-result-key">Código de acesso</span>
                  <span className="super-result-val super-result-code">{result.accessCode}</span>
                </div>
                <div className="super-result-row">
                  <span className="super-result-key">E-mail do diretor</span>
                  <span className="super-result-val">{result.directorEmail}</span>
                </div>
                <div className="super-result-row">
                  <span className="super-result-key">Senha inicial</span>
                  <span className="super-result-val super-result-code">{result.directorPass}</span>
                </div>
                <div className="super-result-row">
                  <span className="super-result-key">URL de acesso</span>
                  <span className="super-result-val" style={{ fontSize: '0.8rem' }}>room.heroisdaescola.com.br</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-confirm" onClick={fecharModal}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
