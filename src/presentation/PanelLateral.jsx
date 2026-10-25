import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Ui.jsx'
import './panel-lateral.css'

export function PanelLateral({ titulo, children, acciones, onClose, ocupado = false }) {
  const dialogo = useRef(null)
  const id = useId()
  useEffect(() => {
    const anterior = document.activeElement
    const el = dialogo.current
    if (el.showModal) el.showModal()
    else {
      el.setAttribute('open', '')
      el.querySelector('button')?.focus()
    }
    return () => {
      el.close?.()
      if (anterior?.isConnected) anterior.focus()
    }
  }, [])
  return createPortal(
    <dialog
      ref={dialogo}
      className="campaign-side-panel"
      aria-labelledby={id}
      aria-modal="true"
      onCancel={(e) => {
        e.preventDefault()
        if (!ocupado) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          if (!ocupado) onClose()
        }
        if (e.key === 'Tab') {
          const elementos = [
            ...e.currentTarget.querySelectorAll(
              'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]'
            )
          ]
          const primero = elementos[0],
            ultimo = elementos.at(-1)
          if (e.shiftKey && document.activeElement === primero) {
            e.preventDefault()
            ultimo?.focus()
          } else if (!e.shiftKey && document.activeElement === ultimo) {
            e.preventDefault()
            primero?.focus()
          }
        }
      }}
      onClick={(e) => {
        if (e.target !== e.currentTarget || ocupado) return
        const r = e.currentTarget.getBoundingClientRect()
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        )
          onClose()
      }}
    >
      <header className="campaign-panel-header">
        <h2 id={id}>{titulo}</h2>
        <button
          type="button"
          className="campaign-panel-close"
          aria-label="Cerrar panel"
          disabled={ocupado}
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      <div className="campaign-panel-content">{children}</div>
      {acciones && <footer className="campaign-panel-actions">{acciones}</footer>}
    </dialog>,
    document.querySelector('.portal-layout.owner-layout') ?? document.body
  )
}
