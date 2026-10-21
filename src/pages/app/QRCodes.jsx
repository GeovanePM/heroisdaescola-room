import React, { useRef } from 'react'
import { trpc } from '../../lib/trpc'

const SHIFT_LABEL = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }
const BASE_URL = import.meta.env.VITE_APP_URL ?? window.location.origin

function QRImage({ url, size = 180 }) {
  const encoded = encodeURIComponent(url)
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encoded}&bgcolor=ffffff&color=0d0d1a&margin=8`}
      alt="QR Code"
      width={size}
      height={size}
      className="qr-img"
    />
  )
}

export default function QRCodes() {
  const printRef = useRef()
  const { data: classrooms = [] } = trpc.classroom.list.useQuery()

  function handlePrint() {
    const content = printRef.current.innerHTML
    const win = window.open('', '', 'width=900,height=700')
    win.document.write(`
      <html><head><title>QR Codes — Heróis da Escola Room</title>
      <style>
        body { font-family: Arial, sans-serif; background: #fff; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; padding: 24px; }
        .card { border: 2px solid #333; border-radius: 12px; padding: 20px; text-align: center; page-break-inside: avoid; }
        .name { font-size: 1.2rem; font-weight: bold; margin: 12px 0 4px; }
        .sub { font-size: 0.85rem; color: #666; margin-bottom: 8px; }
        img { display: block; margin: 0 auto; }
        @media print { .grid { gap: 12px; } }
      </style></head><body>
      <div class="grid">${content}</div>
      </body></html>
    `)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  return (
    <div className="qr-page">
      <header className="page-header">
        <h1 className="page-title">QR Codes das Salas</h1>
        <p className="page-subtitle">Professor escaneia para registrar entrada na sala</p>
      </header>

      <button className="btn-print" onClick={handlePrint}>🖨️ Imprimir todos</button>

      <div className="qr-grid" ref={printRef}>
        {classrooms.map(room => {
          const checkInUrl = `${BASE_URL}/check-in/${room.id}`
          const displayName = room.hero_name
            ? `${room.name} ${SHIFT_LABEL[room.shift] ?? room.shift} · ${room.hero_name}`
            : `${room.name} ${SHIFT_LABEL[room.shift] ?? room.shift}`

          return (
            <div key={room.id} className="qr-card">
              <QRImage url={checkInUrl} size={180} />
              <div className="name">{displayName}</div>
              <div className="sub">{room.segment === 'fund1' ? 'Fund. I' : room.segment === 'fund2' ? 'Fund. II' : 'Médio'}</div>
              <code className="qr-url">/check-in/{room.id.slice(0, 8)}…</code>
            </div>
          )
        })}
      </div>
    </div>
  )
}
