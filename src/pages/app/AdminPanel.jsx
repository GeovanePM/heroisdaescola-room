import React, { useState } from 'react'
import { trpc } from '../../lib/trpc'

const SEG_LABEL   = { fund1: 'Fund. I', fund2: 'Fund. II', medio: 'Médio' }
const SHIFT_LABEL = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
const ROLE_LABEL  = { teacher: 'Professor', supervisor: 'Supervisor', vice_director: 'Vice-Diretor', director: 'Diretor' }

// ─── Modal base ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// ─── Aba Salas ───────────────────────────────────────────────────────────────

function ClassroomTab() {
  const utils = trpc.useUtils()
  const { data: classrooms = [], isLoading } = trpc.admin.classroomList.useQuery()

  const [modal, setModal] = useState(null)  // null | 'create' | roomObj
  const [form, setForm]   = useState({ name: '', segment: 'fund1', shift: 'manha' })
  const [err, setErr]     = useState('')

  const createMut = trpc.admin.classroomCreate.useMutation({
    onSuccess() { utils.admin.classroomList.invalidate(); setModal(null) },
    onError(e)  { setErr(e.message) },
  })
  const updateMut = trpc.admin.classroomUpdate.useMutation({
    onSuccess() { utils.admin.classroomList.invalidate(); setModal(null) },
    onError(e)  { setErr(e.message) },
  })

  function openCreate() {
    setForm({ name: '', segment: 'fund1', shift: 'manha' })
    setErr('')
    setModal('create')
  }

  function openEdit(room) {
    setForm({ name: room.name, segment: room.segment, shift: room.shift ?? 'manha' })
    setErr('')
    setModal(room)
  }

  function submit() {
    if (!form.name.trim()) { setErr('Nome obrigatório'); return }
    if (modal === 'create') {
      createMut.mutate(form)
    } else {
      updateMut.mutate({ id: modal.id, ...form })
    }
  }

  const busy = createMut.isPending || updateMut.isPending

  return (
    <div>
      <div className="admin-section-header">
        <h2 className="section-label">Salas</h2>
        <button className="btn-admin-add" onClick={openCreate}>+ Nova Sala</button>
      </div>

      {isLoading ? <p className="empty-state">Carregando...</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Segmento</th>
                <th>Turno</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {classrooms.map(room => (
                <tr key={room.id} className={!room.active ? 'row-inactive' : ''}>
                  <td className="td-bold">{room.name}</td>
                  <td>{SEG_LABEL[room.segment] ?? room.segment}</td>
                  <td>{SHIFT_LABEL[room.shift] ?? room.shift ?? '—'}</td>
                  <td>
                    <span className={`status-badge ${room.active ? 'status-active' : 'status-inactive'}`}>
                      {room.active ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="action-cell">
                    <button className="btn-sm" onClick={() => openEdit(room)}>Editar</button>
                    <button
                      className={`btn-sm ${room.active ? 'btn-sm-danger' : 'btn-sm-success'}`}
                      onClick={() => updateMut.mutate({ id: room.id, active: !room.active })}
                    >
                      {room.active ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
              {classrooms.length === 0 && (
                <tr><td colSpan={5} className="td-empty">Nenhuma sala cadastrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal
          title={modal === 'create' ? 'Nova Sala' : 'Editar Sala'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn-modal-cancel" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-modal-confirm" onClick={submit} disabled={busy}>
                {busy ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          }
        >
          {err && <p className="form-error">{err}</p>}
          <div className="form-group">
            <label className="form-label">Nome da turma</label>
            <input
              className="form-input"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: 6-A"
              onKeyDown={e => e.key === 'Enter' && submit()}
            />
          </div>
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
        </Modal>
      )}
    </div>
  )
}

// ─── Aba Staff ───────────────────────────────────────────────────────────────

function StaffTab() {
  const utils = trpc.useUtils()
  const { data: staff = [], isLoading }   = trpc.admin.staffList.useQuery()
  const { data: classrooms = [] }         = trpc.admin.classroomList.useQuery()

  const [modal, setModal]         = useState(null)  // null | 'create' | staffObj
  const [roomModal, setRoomModal] = useState(null)  // null | staffObj
  const [form, setForm]           = useState({ name: '', email: '', password: '', role: 'teacher' })
  const [err, setErr]             = useState('')

  const { data: staffRooms = [] } = trpc.admin.staffRooms.useQuery(
    { staffId: roomModal?.id ?? '' },
    { enabled: !!roomModal }
  )

  const createMut = trpc.admin.staffCreate.useMutation({
    onSuccess() { utils.admin.staffList.invalidate(); setModal(null) },
    onError(e)  { setErr(e.message) },
  })
  const updateMut = trpc.admin.staffUpdate.useMutation({
    onSuccess() { utils.admin.staffList.invalidate(); setModal(null) },
    onError(e)  { setErr(e.message) },
  })
  const linkMut = trpc.admin.linkRoom.useMutation({
    onSuccess() { utils.admin.staffRooms.invalidate() },
  })
  const unlinkMut = trpc.admin.unlinkRoom.useMutation({
    onSuccess() { utils.admin.staffRooms.invalidate() },
  })

  function openCreate() {
    setForm({ name: '', email: '', password: '', role: 'teacher' })
    setErr('')
    setModal('create')
  }

  function openEdit(s) {
    setForm({ name: s.name, email: s.email, password: '', role: s.role })
    setErr('')
    setModal(s)
  }

  function submit() {
    if (!form.name.trim() || !form.email.trim()) { setErr('Nome e email são obrigatórios'); return }
    if (modal === 'create') {
      if (form.password.length < 6) { setErr('Senha mínima: 6 caracteres'); return }
      createMut.mutate({ name: form.name, email: form.email, password: form.password, role: form.role })
    } else {
      updateMut.mutate({ id: modal.id, name: form.name, email: form.email, role: form.role })
    }
  }

  const linkedIds = new Set(staffRooms.map(r => r.classroom_id))
  const busy = createMut.isPending || updateMut.isPending

  return (
    <div>
      <div className="admin-section-header">
        <h2 className="section-label">Staff</h2>
        <button className="btn-admin-add" onClick={openCreate}>+ Novo Staff</button>
      </div>

      {isLoading ? <p className="empty-state">Carregando...</p> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Cargo</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id} className={!s.active ? 'row-inactive' : ''}>
                  <td className="td-bold">{s.name}</td>
                  <td className="td-dim">{s.email}</td>
                  <td>{ROLE_LABEL[s.role] ?? s.role}</td>
                  <td>
                    <span className={`status-badge ${s.active ? 'status-active' : 'status-inactive'}`}>
                      {s.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="action-cell">
                    <button className="btn-sm" onClick={() => openEdit(s)}>Editar</button>
                    <button className="btn-sm btn-sm-ghost" onClick={() => { setRoomModal(s) }}>Salas</button>
                    <button
                      className={`btn-sm ${s.active ? 'btn-sm-danger' : 'btn-sm-success'}`}
                      onClick={() => updateMut.mutate({ id: s.id, active: !s.active })}
                    >
                      {s.active ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr><td colSpan={5} className="td-empty">Nenhum staff cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal criar/editar staff */}
      {modal && (
        <Modal
          title={modal === 'create' ? 'Novo Staff' : `Editar: ${modal.name}`}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn-modal-cancel" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn-modal-confirm" onClick={submit} disabled={busy}>
                {busy ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          }
        >
          {err && <p className="form-error">{err}</p>}
          <div className="form-group">
            <label className="form-label">Nome</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          {modal === 'create' && (
            <div className="form-group">
              <label className="form-label">Senha</label>
              <input className="form-input" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Cargo</label>
            <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="teacher">Professor</option>
              <option value="supervisor">Supervisor</option>
              <option value="vice_director">Vice-Diretor</option>
              <option value="director">Diretor</option>
            </select>
          </div>
        </Modal>
      )}

      {/* Modal vincular salas */}
      {roomModal && (
        <Modal
          title={`Salas de ${roomModal.name}`}
          onClose={() => setRoomModal(null)}
          footer={
            <button className="btn-modal-confirm" onClick={() => setRoomModal(null)}>Fechar</button>
          }
        >
          <p className="form-hint">Clique para vincular ou desvincular uma sala:</p>
          <div className="room-checklist">
            {classrooms.filter(c => c.active).map(room => {
              const linked = linkedIds.has(room.id)
              const pending = linkMut.isPending || unlinkMut.isPending
              return (
                <button
                  key={room.id}
                  className={`room-check-btn ${linked ? 'room-check-on' : ''}`}
                  onClick={() => linked
                    ? unlinkMut.mutate({ staffId: roomModal.id, classroomId: room.id })
                    : linkMut.mutate({ staffId: roomModal.id, classroomId: room.id })
                  }
                  disabled={pending}
                >
                  <span className="room-check-icon">{linked ? '✓' : '+'}</span>
                  <span>{room.name} · {SHIFT_LABEL[room.shift] ?? room.shift}</span>
                  <span className="room-check-seg">{SEG_LABEL[room.segment]}</span>
                </button>
              )
            })}
            {classrooms.filter(c => c.active).length === 0 && (
              <p className="empty-state">Nenhuma sala ativa cadastrada.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function AdminPanel() {
  const [tab, setTab] = useState('salas')

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1 className="page-title">Painel Admin</h1>
      </header>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${tab === 'salas' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('salas')}
        >
          Salas
        </button>
        <button
          className={`admin-tab ${tab === 'staff' ? 'admin-tab-active' : ''}`}
          onClick={() => setTab('staff')}
        >
          Staff
        </button>
      </div>

      <div className="admin-content">
        {tab === 'salas' ? <ClassroomTab /> : <StaffTab />}
      </div>
    </div>
  )
}
