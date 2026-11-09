import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TareoExportacion } from '../src/presentation/TareoExportacion.jsx'

describe('descarga directa de tareo', () => {
  it('descarga con un clic usando los filtros actuales, sin formularios ni carga de archivos', async () => {
    const user = userEvent.setup(), servicio = { descargarTareo: vi.fn(async () => {}) }
    render(<TareoExportacion servicio={servicio} campaniaId="c1" trabajadorId="" desde="2026-11-05" hasta="2026-11-09" />)
    await user.click(screen.getByRole('button', { name: 'Descargar tareo Excel' }))
    expect(servicio.descargarTareo).toHaveBeenCalledExactlyOnceWith({ campaniaId: 'c1', trabajadorId: '', desde: '2026-11-05', hasta: '2026-11-09' })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/padrón/i)).not.toBeInTheDocument()
  })
  it('bloquea doble envío durante la descarga y muestra errores recuperables', async () => {
    let rechazar
    const user = userEvent.setup(), servicio = { descargarTareo: vi.fn(() => new Promise((_, reject) => { rechazar = reject })) }
    render(<TareoExportacion servicio={servicio} campaniaId="c1" trabajadorId="" desde="2026-11-05" hasta="2026-11-09" />)
    await user.click(screen.getByRole('button', { name: 'Descargar tareo Excel' }))
    expect(screen.getByRole('button', { name: 'Descargando…' })).toBeDisabled()
    rechazar(new Error('Sin conexión'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    expect(screen.getByRole('button', { name: 'Descargar tareo Excel' })).toBeEnabled()
  })
})
