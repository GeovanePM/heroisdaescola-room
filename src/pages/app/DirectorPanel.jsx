import React, { useState, useEffect, useRef, useMemo } from 'react'
import { trpc } from '../../lib/trpc'

const SEG_LABEL    = { fund1: 'Fund. I', fund2: 'Fund. II', medio: 'Médio' }

const STATUS_SALA = {
  verde:    { label: 'Normal',      cor: '#00ff88', bg: 'rgba(0,255,136,0.1)'  },
  amarelo:  { label: 'Aluno fora',  cor: '#FFD700', bg: 'rgba(255,215,0,0.1)'  },
  laranja:  { label: 'Atenção',     cor: '#FF8C00', bg: 'rgba(255,140,0,0.1)'  },
  vermelho: { label: 'Intervenção', cor: '#FF4444', bg: 'rgba(255,68,68,0.1)'  },
}

function calcularStatus(events) {
  const sorted = [...events].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const exits  = {}
  let intervencao = false
  for (const ev of sorted) {
    if (ev.type === 'intervencao')           intervencao = true
    if (ev.type === 'intervencao_encerrada') intervencao = false
    if (ev.type === 'saida_sala'   && ev.student_ref) exits[ev.student_ref] = ev
    if (ev.type === 'retorno_sala' && ev.student_ref) delete exits[ev.student_ref]
  }
  if (intervencao) return 'vermelho'
  const fora = Object.values(exits)
  if (fora.length === 0) return 'verde'
  const maisAntigo = Math.max(...fora.map(e => Date.now() - new Date(e.created_at)))
  return maisAntigo >= 5 * 60 * 1000 ? 'laranja' : 'amarelo'
}
const TURNO_LABEL  = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
const TYPE_LABEL   = { tarefa: 'Tarefa', prova: 'Estudo p/ Prova' }
const STATUS_COLOR = { active: '#00ff88', completed: '#FFD700', expired: '#FF4444' }
const STATUS_LABEL = { active: 'Ativa', completed: 'Concluída', expired: 'Expirada' }

// ── Visão Geral ───────────────────────────────────────────────────────────────

function VisaoGeral({ classrooms, ranking, tasks }) {
  const totalXp    = classrooms.reduce((acc, c) => acc + (c.xp ?? 0), 0)
  const totalRooms = classrooms.length

  return (
    <>
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
            <span>#</span><span>Turma</span><span>Segmento</span><span>Nível</span><span>XP</span>
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
          {ranking.length === 0 && <p className="empty-state" style={{ padding: '1.5rem', textAlign: 'center' }}>Sem dados ainda.</p>}
        </div>
      </section>

      <section className="director-tasks">
        <h2 className="section-label">Tarefas da Escola</h2>
        {tasks.length === 0 ? (
          <p className="empty-state" style={{ padding: '1rem' }}>Nenhuma tarefa criada.</p>
        ) : (
          <div className="director-task-list">
            {tasks.map(task => {
              const pct   = task.target_count > 0 ? Math.min(Math.round((task.completion_count / task.target_count) * 100), 100) : 0
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
    </>
  )
}

// ── Turmas ────────────────────────────────────────────────────────────────────

const FORM_TURMA_EMPTY = { name: '', segment: 'fund1', shift: 'manha', students: [] }

function Turmas({ classrooms }) {
  const utils = trpc.useUtils()
  const [liveEvents, setLiveEvents] = useState([])
  const wsRef = useRef(null)
  const { data: recentEvents = [] } = trpc.supervisor.recentEvents.useQuery({ limit: 200 })

  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState(FORM_TURMA_EMPTY)
  const [err, setErr]       = useState('')
  const [fileErr, setFileErr] = useState('')
  const [parsing, setParsing] = useState(false)
  const fileRef = useRef(null)

  const createMut = trpc.admin.classroomCreate.useMutation({
    onSuccess(data) {
      utils.supervisor.allClassrooms.invalidate()
      setModal(false)
      setForm(FORM_TURMA_EMPTY)
      if (data.studentCount > 0) alert(`Turma criada com ${data.studentCount} aluno(s)!`)
    },
    onError(e) { setErr(e.message) },
  })

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setParsing(true)
    setFileErr('')
    try {
      const XLSX = await import('xlsx')
      const data = await file.arrayBuffer()
      const wb   = XLSX.read(data)
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
      const SKIP = /^(nome|alunos?|students?|nomes?|name|#|n[oº]\.?|chamada)$/i
      const names = rows
        .map(row => String(row[0] ?? '').trim())
        .filter(n => n && !SKIP.test(n))
      setForm(f => ({ ...f, students: names }))
    } catch {
      setFileErr('Erro ao ler o arquivo. Use .csv ou .xlsx com os nomes na 1ª coluna.')
    } finally {
      setParsing(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function salvar() {
    if (!form.name.trim()) { setErr('Nome obrigatório'); return }
    createMut.mutate({ name: form.name, segment: form.segment, shift: form.shift, ...(form.students.length ? { students: form.students } : {}) })
  }

  useEffect(() => {
    const apiBase = (import.meta.env.VITE_API_URL ?? import.meta.env.API_URL ?? 'http://localhost:3001').replace(/^http/, 'ws')
    const ws = new WebSocket(`${apiBase}/ws?roomId=supervisor`)
    wsRef.current = ws
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'event') setLiveEvents(prev => [data.event, ...prev.slice(0, 199)])
      } catch {}
    }
    return () => ws.close()
  }, [])

  const allEvents = useMemo(() => [...liveEvents, ...recentEvents], [liveEvents, recentEvents])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn-admin-add" onClick={() => { setErr(''); setForm(FORM_TURMA_EMPTY); setModal(true) }}>
          + Nova Turma
        </button>
      </div>

      <div className="turmas-grid">
      {classrooms.map(room => {
        const evsSala  = allEvents.filter(e => e.classroom_id === room.id)
        const statusKey = calcularStatus(evsSala)
        const s        = STATUS_SALA[statusKey]
        const xpPct    = Math.min(((room.xp ?? 0) % 1000) / 10, 100)

        return (
          <div key={room.id} className="turma-card-dir" style={{ borderColor: s.cor + '55', background: s.bg }}>
            <div className="turma-card-top">
              <div>
                <span className="turma-card-nome">{room.name}</span>
                <span className="turma-card-turno">{TURNO_LABEL[room.shift] ?? room.shift} · {SEG_LABEL[room.segment]}</span>
              </div>
              <span className="turma-status-badge" style={{ color: s.cor, background: s.cor + '22', border: `1px solid ${s.cor}44` }}>
                {statusKey === 'vermelho' && '🚨 '}{s.label}
              </span>
            </div>

            {room.hero_name && (
              <div className="turma-heroi">
                {room.hero_image_url && <img src={room.hero_image_url} className="turma-heroi-img" alt={room.hero_name} />}
                <span className="turma-heroi-nome">⚔️ {room.hero_name}</span>
              </div>
            )}

            <div className="turma-xp-wrap">
              <div className="turma-xp-top">
                <span className="turma-xp-val">⚡ {(room.xp ?? 0).toLocaleString('pt-BR')} XP</span>
                <span className="turma-nivel">Nível {room.level ?? 1}</span>
              </div>
              <div className="turma-xp-bar">
                <div className="turma-xp-fill" style={{ width: `${xpPct}%`, background: `linear-gradient(90deg, ${s.cor}, ${s.cor}aa)` }} />
              </div>
            </div>
          </div>
        )
      })}
      {classrooms.length === 0 && <p className="empty-state">Nenhuma turma cadastrada.</p>}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nova Turma</h3>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {err && <p className="form-error">{err}</p>}
              <div className="form-group">
                <label className="form-label">Nome da turma</label>
                <input className="form-input" placeholder="Ex: 6-A, 3º Ano B..." value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Segmento</label>
                  <select className="form-select" value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value }))}>
                    <option value="fund1">Fund. I (1º ao 5º)</option>
                    <option value="fund2">Fund. II (6º ao 9º)</option>
                    <option value="medio">Ensino Médio</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Turno</label>
                  <select className="form-select" value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}>
                    <option value="manha">Manhã</option>
                    <option value="tarde">Tarde</option>
                    <option value="noite">Noite</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Lista de alunos (opcional)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  style={{ display: 'none' }}
                  onChange={handleFile}
                />
                <button
                  type="button"
                  className="btn-upload-list"
                  onClick={() => fileRef.current?.click()}
                  disabled={parsing}
                >
                  {parsing ? '⏳ Lendo arquivo...' : '📂 Importar lista (.csv ou .xlsx)'}
                </button>
                {fileErr && <p className="form-error" style={{ marginTop: '0.5rem' }}>{fileErr}</p>}
                {form.students.length > 0 && (
                  <div className="students-preview">
                    <div className="students-preview-header">
                      <span>{form.students.length} aluno(s) importado(s)</span>
                      <button type="button" className="btn-clear-students" onClick={() => setForm(f => ({ ...f, students: [] }))}>
                        Limpar
                      </button>
                    </div>
                    <div className="students-preview-list">
                      {form.students.slice(0, 5).map((n, i) => (
                        <span key={i} className="student-chip">{i + 1}. {n}</span>
                      ))}
                      {form.students.length > 5 && (
                        <span className="student-chip student-chip-more">+{form.students.length - 5} mais...</span>
                      )}
                    </div>
                  </div>
                )}
                {form.students.length === 0 && !fileErr && (
                  <p className="form-hint">Os nomes devem estar na 1ª coluna da planilha. O nº de chamada será gerado automaticamente.</p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-cancel" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn-modal-confirm" onClick={salvar} disabled={createMut.isPending}>
                {createMut.isPending ? 'Criando...' : 'Criar turma'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Alunos ────────────────────────────────────────────────────────────────────

function Alunos({ classrooms }) {
  const utils = trpc.useUtils()
  const [roomId, setRoomId]     = useState(classrooms[0]?.id ?? '')
  const [modal, setModal]       = useState(false)
  const [editAluno, setEdit]    = useState(null)
  const [form, setForm]         = useState({ name: '', callNumber: '' })
  const [err, setErr]           = useState('')

  const { data: alunos = [], isLoading } = trpc.student.list.useQuery(
    { classroomId: roomId },
    { enabled: !!roomId }
  )

  const createMut = trpc.student.create.useMutation({
    onSuccess() { utils.student.list.invalidate(); fecharModal() },
    onError(e)  { setErr(e.message) },
  })
  const updateMut = trpc.student.update.useMutation({
    onSuccess() { utils.student.list.invalidate(); fecharModal() },
    onError(e)  { setErr(e.message) },
  })
  const removeMut = trpc.student.remove.useMutation({
    onSuccess() { utils.student.list.invalidate() },
  })

  function abrirNovo() {
    setEdit(null)
    setForm({ name: '', callNumber: '' })
    setErr('')
    setModal(true)
  }

  function abrirEditar(a) {
    setEdit(a)
    setForm({ name: a.name, callNumber: a.call_number ?? '' })
    setErr('')
    setModal(true)
  }

  function fecharModal() { setModal(false); setEdit(null) }

  function salvar() {
    if (!form.name.trim()) { setErr('Nome obrigatório'); return }
    const callNumber = form.callNumber ? Number(form.callNumber) : undefined
    if (editAluno) {
      updateMut.mutate({ id: editAluno.id, name: form.name, callNumber: callNumber ?? null })
    } else {
      createMut.mutate({ classroomId: roomId, name: form.name, callNumber })
    }
  }

  const turmaAtual = classrooms.find(c => c.id === roomId)

  return (
    <div className="alunos-section">
      <div className="alunos-header">
        <select className="form-select" value={roomId} onChange={e => setRoomId(e.target.value)} style={{ maxWidth: 280 }}>
          {classrooms.map(c => (
            <option key={c.id} value={c.id}>{c.name} · {TURNO_LABEL[c.shift] ?? c.shift}</option>
          ))}
        </select>
        <button className="btn-admin-add" onClick={abrirNovo}>+ Novo aluno</button>
      </div>

      {turmaAtual && (
        <p className="alunos-count">
          {alunos.length} aluno{alunos.length !== 1 ? 's' : ''} cadastrado{alunos.length !== 1 ? 's' : ''} em <strong>{turmaAtual.name}</strong>
        </p>
      )}

      {isLoading ? (
        <p className="empty-state">Carregando...</p>
      ) : alunos.length === 0 ? (
        <p className="empty-state">Nenhum aluno cadastrado nesta turma.</p>
      ) : (
        <div className="alunos-lista">
          {alunos.map(a => (
            <div key={a.id} className="aluno-row">
              <span className="aluno-num">{a.call_number ?? '—'}</span>
              <span className="aluno-nome">{a.name}</span>
              <div className="aluno-acoes">
                <button className="btn-sm btn-sm-ghost" onClick={() => abrirEditar(a)}>Editar</button>
                <button
                  className="btn-sm btn-sm-danger"
                  onClick={() => { if (confirm(`Remover ${a.name}?`)) removeMut.mutate({ id: a.id }) }}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editAluno ? 'Editar aluno' : 'Novo aluno'}</h3>
              <button className="modal-close" onClick={fecharModal}>×</button>
            </div>
            <div className="modal-body">
              {err && <p className="form-error">{err}</p>}
              <div className="form-group">
                <label className="form-label">Nº Chamada</label>
                <input className="form-input" type="number" min="1" placeholder="Ex: 1" value={form.callNumber} onChange={e => setForm(f => ({ ...f, callNumber: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Nome completo</label>
                <input className="form-input" placeholder="Nome do aluno" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-cancel" onClick={fecharModal}>Cancelar</button>
              <button className="btn-modal-confirm" onClick={salvar} disabled={createMut.isPending || updateMut.isPending}>
                {editAluno ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Matérias ──────────────────────────────────────────────────────────────────

const ICONS_PREDEFINED = ['📚','📖','✏️','🔢','🌍','🧪','🎨','🎵','🏃','💻','🌿','📐']
const DIFF_LABEL = { 1: 'Fácil', 2: 'Médio', 3: 'Difícil' }

function Materias() {
  const utils = trpc.useUtils()
  const [openSubjectId, setOpenSubjectId] = useState(null)
  const [modalSubject,  setModalSubject]  = useState(false)
  const [modalTopic,    setModalTopic]    = useState(false)
  const [viewQuestions, setViewQuestions] = useState(null)
  const [formS, setFormS] = useState({ name: '', icon: '📚', description: '' })
  const [formT, setFormT] = useState({ title: '', body: '', difficulty: 1 })
  const [genCount, setGenCount] = useState(10)
  const [err, setErr] = useState('')

  const { data: aiStatus }     = trpc.subjects.aiStatus.useQuery()
  const { data: subjects = [], isLoading } = trpc.subjects.listSubjects.useQuery()
  const { data: topics = [] }  = trpc.subjects.listTopics.useQuery(
    { subjectId: openSubjectId ?? '' }, { enabled: !!openSubjectId }
  )
  const { data: questions = [] } = trpc.subjects.listQuestions.useQuery(
    { topicId: viewQuestions ?? '' }, { enabled: !!viewQuestions }
  )

  const createSubjMut   = trpc.subjects.createSubject.useMutation({ onSuccess() { utils.subjects.listSubjects.invalidate(); setModalSubject(false); setFormS({ name:'',icon:'📚',description:'' }) }, onError(e) { setErr(e.message) } })
  const removeSubjMut   = trpc.subjects.removeSubject.useMutation({ onSuccess() { utils.subjects.listSubjects.invalidate() } })
  const createTopicMut  = trpc.subjects.createTopic.useMutation({ onSuccess() { utils.subjects.listTopics.invalidate(); setModalTopic(false); setFormT({ title:'',body:'',difficulty:1 }) }, onError(e) { setErr(e.message) } })
  const removeTopicMut  = trpc.subjects.removeTopic.useMutation({ onSuccess() { utils.subjects.listTopics.invalidate() } })
  const genMut          = trpc.subjects.generateQuestions.useMutation({
    onSuccess(data) { utils.subjects.listTopics.invalidate(); utils.subjects.listQuestions.invalidate(); alert(`${data.count} questões geradas com sucesso!`) },
    onError(e) { alert('Erro: ' + e.message) },
  })
  const clearMut        = trpc.subjects.clearTopicQuestions.useMutation({ onSuccess() { utils.subjects.listTopics.invalidate(); utils.subjects.listQuestions.invalidate() } })
  const delQMut         = trpc.subjects.deleteQuestion.useMutation({ onSuccess() { utils.subjects.listQuestions.invalidate() } })

  const openSubject = subjects.find(s => s.id === openSubjectId)

  return (
    <div className="materias-page">
      <div className="materias-header">
        <div>
          <h2 className="rpt-section-title" style={{ marginBottom: '0.25rem' }}>Matérias para Guardiões dos Números</h2>
          <p className="rpt-hint" style={{ marginBottom: 0 }}>
            Cada matéria pode ter tópicos com questões geradas por IA. Professores vinculam tarefas a um tópico.
          </p>
        </div>
        <button className="btn-admin-add" onClick={() => { setErr(''); setModalSubject(true) }}>+ Nova Matéria</button>
      </div>

      {!aiStatus?.configured && (
        <div className="materias-ai-warn">
          ⚠️ <strong>IA não configurada.</strong> Adicione <code>OPENAI_API_KEY</code> nas variáveis de ambiente do servidor para gerar questões automaticamente.
        </div>
      )}

      {isLoading ? <p className="empty-state">Carregando...</p> : subjects.length === 0 ? (
        <p className="empty-state">Nenhuma matéria cadastrada. Clique em "+ Nova Matéria" para começar.</p>
      ) : (
        <div className="materias-list">
          {subjects.map(subj => {
            const topicCount = subj.room_subject_topics?.filter(t => t.active)?.length ?? 0
            const isOpen = openSubjectId === subj.id
            return (
              <div key={subj.id} className={`materia-card ${isOpen ? 'materia-card-open' : ''}`}>
                <div className="materia-card-header" onClick={() => setOpenSubjectId(isOpen ? null : subj.id)}>
                  <span className="materia-icon">{subj.icon}</span>
                  <div className="materia-info">
                    <span className="materia-name">{subj.name}</span>
                    {subj.description && <span className="materia-desc">{subj.description}</span>}
                  </div>
                  <span className="materia-badge">{topicCount} tópico(s)</span>
                  <span className="materia-arrow">{isOpen ? '▲' : '▼'}</span>
                </div>

                {isOpen && (
                  <div className="materia-topics">
                    <div className="materia-topics-header">
                      <span className="rpt-section-title" style={{ marginBottom: 0 }}>Tópicos de {subj.name}</span>
                      <div style={{ display:'flex', gap:'0.5rem' }}>
                        <button className="btn-sm btn-sm-ghost" onClick={() => { setErr(''); setFormT({ title:'',body:'',difficulty:1 }); setModalTopic(true) }}>
                          + Tópico
                        </button>
                        <button className="btn-sm btn-sm-danger" onClick={() => { if (confirm(`Remover matéria "${subj.name}" e todos os seus tópicos?`)) removeSubjMut.mutate({ id: subj.id }) }}>
                          Remover matéria
                        </button>
                      </div>
                    </div>

                    {topics.length === 0 ? (
                      <p className="empty-state" style={{ padding: '1rem' }}>Nenhum tópico ainda. Adicione um tópico para gerar questões.</p>
                    ) : (
                      <div className="topics-list">
                        {topics.map(topic => (
                          <div key={topic.id} className="topic-row">
                            <div className="topic-info">
                              <span className="topic-title">{topic.title}</span>
                              <span className="topic-diff">{DIFF_LABEL[topic.difficulty]}</span>
                              {topic.body && <span className="topic-body">{topic.body}</span>}
                            </div>
                            <div className="topic-stats">
                              <span className="topic-qcount">{topic.questionCount} questão(ões)</span>
                            </div>
                            <div className="topic-actions">
                              {aiStatus?.configured && (
                                <div style={{ display:'flex', gap:'0.4rem', alignItems:'center' }}>
                                  <select className="form-select" style={{ padding:'3px 6px', fontSize:'0.75rem', width:'auto' }}
                                    value={genCount} onChange={e => setGenCount(Number(e.target.value))}>
                                    {[5,10,15,20].map(n => <option key={n} value={n}>{n} questões</option>)}
                                  </select>
                                  <button
                                    className="btn-sm btn-sm-ghost"
                                    style={{ color:'#00ff88', borderColor:'rgba(0,255,136,0.3)' }}
                                    onClick={() => { if (confirm(`Gerar ${genCount} questões para "${topic.title}" com IA?`)) genMut.mutate({ topicId: topic.id, count: genCount }) }}
                                    disabled={genMut.isPending}
                                  >
                                    {genMut.isPending ? '⏳ Gerando...' : '✨ Gerar IA'}
                                  </button>
                                </div>
                              )}
                              <button className="btn-sm btn-sm-ghost" onClick={() => setViewQuestions(viewQuestions === topic.id ? null : topic.id)}>
                                {viewQuestions === topic.id ? 'Fechar' : 'Ver questões'}
                              </button>
                              {topic.questionCount > 0 && (
                                <button className="btn-sm btn-sm-danger" onClick={() => { if (confirm('Apagar todas as questões deste tópico?')) clearMut.mutate({ topicId: topic.id }) }}>
                                  Limpar
                                </button>
                              )}
                              <button className="btn-sm btn-sm-danger" onClick={() => { if (confirm(`Remover tópico "${topic.title}"?`)) removeTopicMut.mutate({ id: topic.id }) }}>
                                Remover
                              </button>
                            </div>

                            {viewQuestions === topic.id && (
                              <div className="questions-preview">
                                {questions.length === 0 ? (
                                  <p style={{ color:'var(--text-dim)', fontSize:'0.82rem', padding:'0.5rem' }}>Nenhuma questão gerada ainda.</p>
                                ) : questions.map((q, i) => (
                                  <div key={q.id} className="question-item">
                                    <div className="question-header">
                                      <span className="question-num">Q{i+1}</span>
                                      <span className="question-text">{q.question}</span>
                                      <button className="btn-sm btn-sm-danger" style={{ padding:'2px 6px', fontSize:'0.7rem' }} onClick={() => delQMut.mutate({ id: q.id })}>✕</button>
                                    </div>
                                    <div className="question-opts">
                                      {q.options.map((opt, oi) => (
                                        <span key={oi} className={`question-opt ${oi === q.correct ? 'question-opt-correct' : ''}`}>{opt}</span>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nova matéria */}
      {modalSubject && (
        <div className="modal-overlay" onClick={() => setModalSubject(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Nova Matéria</h3>
              <button className="modal-close" onClick={() => setModalSubject(false)}>×</button>
            </div>
            <div className="modal-body">
              {err && <p className="form-error">{err}</p>}
              <div className="form-group">
                <label className="form-label">Ícone</label>
                <div className="icon-picker">
                  {ICONS_PREDEFINED.map(ic => (
                    <button key={ic} className={`icon-btn ${formS.icon === ic ? 'icon-btn-sel' : ''}`} onClick={() => setFormS(f => ({ ...f, icon: ic }))}>{ic}</button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Nome da matéria</label>
                <input className="form-input" placeholder="Ex: Português, Ciências, História..." value={formS.name} onChange={e => setFormS(f => ({ ...f, name: e.target.value }))} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Descrição (opcional)</label>
                <input className="form-input" placeholder="Ex: 5º ano — Língua Portuguesa" value={formS.description} onChange={e => setFormS(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-cancel" onClick={() => setModalSubject(false)}>Cancelar</button>
              <button className="btn-modal-confirm" onClick={() => { if (!formS.name.trim()) { setErr('Nome obrigatório'); return } createSubjMut.mutate(formS) }} disabled={createSubjMut.isPending}>
                Criar matéria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo tópico */}
      {modalTopic && openSubject && (
        <div className="modal-overlay" onClick={() => setModalTopic(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Novo Tópico — {openSubject.name}</h3>
              <button className="modal-close" onClick={() => setModalTopic(false)}>×</button>
            </div>
            <div className="modal-body">
              {err && <p className="form-error">{err}</p>}
              <div className="form-group">
                <label className="form-label">Título do tópico</label>
                <input className="form-input" placeholder="Ex: Sílabas tônicas, Frações equivalentes..." value={formT.title} onChange={e => setFormT(f => ({ ...f, title: e.target.value }))} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Contexto para a IA (opcional)</label>
                <textarea className="form-input" rows={3} placeholder="Descreva o nível, o tipo de exercícios esperados, exemplos..." value={formT.body} onChange={e => setFormT(f => ({ ...f, body: e.target.value }))} style={{ resize:'vertical' }} />
                <p className="form-hint">Quanto mais contexto, melhores as questões geradas.</p>
              </div>
              <div className="form-group">
                <label className="form-label">Dificuldade</label>
                <select className="form-select" value={formT.difficulty} onChange={e => setFormT(f => ({ ...f, difficulty: Number(e.target.value) }))}>
                  <option value={1}>Fácil</option>
                  <option value={2}>Médio</option>
                  <option value={3}>Difícil</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-modal-cancel" onClick={() => setModalTopic(false)}>Cancelar</button>
              <button className="btn-modal-confirm"
                onClick={() => { if (!formT.title.trim()) { setErr('Título obrigatório'); return } createTopicMut.mutate({ subjectId: openSubjectId, ...formT }) }}
                disabled={createTopicMut.isPending}
              >
                Criar tópico
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Principal ─────────────────────────────────────────────────────────────────

export default function DirectorPanel() {
  const [aba, setAba] = useState('visao')

  const { data: classrooms = [] } = trpc.supervisor.allClassrooms.useQuery()
  const { data: ranking = [] }    = trpc.supervisor.weeklyRanking.useQuery()
  const { data: tasks = [] }      = trpc.task.list.useQuery({})

  const ABAS = [
    { id: 'visao',    label: '📊 Visão Geral' },
    { id: 'turmas',   label: '🏫 Turmas'      },
    { id: 'alunos',   label: '👥 Alunos'      },
    { id: 'materias', label: '🎮 Matérias'    },
  ]

  return (
    <div className="director-page">
      <header className="page-header">
        <h1 className="page-title">Painel da Direção</h1>
        <p className="page-subtitle">Gestão e monitoramento da escola</p>
      </header>

      <div className="teacher-tabs" style={{ marginBottom: '1.5rem' }}>
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

      {aba === 'visao'    && <VisaoGeral classrooms={classrooms} ranking={ranking} tasks={tasks} />}
      {aba === 'turmas'   && <Turmas classrooms={classrooms} />}
      {aba === 'alunos'   && <Alunos classrooms={classrooms} />}
      {aba === 'materias' && <Materias />}
    </div>
  )
}
