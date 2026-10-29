import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LotesCampania } from '../src/presentation/LotesCampania.jsx'
import {
  TrabajadoresCampania,
  SECCIONES_TRABAJADORES
} from '../src/presentation/TrabajadoresCampania.jsx'

const campania = { id: 'camp-1' }
const datos = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: `763-${i + 1}`,
    nombre: `Persona ${i + 1}`,
    dni: `763${String(i).padStart(5, '0')}`,
    activo: true,
    iniciadoEn: '2026-10-20T05:00:00Z',
    creadoEn: '2026-10-20T05:00:00Z',
    asignadoEn: '2026-10-21T05:00:00Z',
    trabajador: { nombre: `Persona ${i + 1}`, dni: `763${String(i).padStart(5, '0')}` }
  }))
const tablas = [
  { label: 'Generados' },
  { label: 'Asignados', asignados: true },
  ...SECCIONES_TRABAJADORES.map((seccion) => ({ label: seccion.label, seccion }))
]
function montar(tabla, cargar) {
  const servicio = {
    listar: vi.fn((_, f) => cargar(f.offset, f)),
    trabajadoresCampania: vi.fn((_, __, offset, f) => cargar(offset, f))
  }
  render(
    tabla.seccion ? (
      <TrabajadoresCampania
        servicio={servicio}
        campania={campania}
        seccion={tabla.seccion}
      />
    ) : (
      <LotesCampania
        servicio={servicio}
        campania={campania}
        asignados={tabla.asignados}
      />
    )
  )
  return servicio
}
const filasVisibles = () =>
  within(screen.getByRole('table')).getAllByRole('row').slice(1)

describe('Paginación y recarga de las tablas de Cosecha', () => {
  it.each(tablas)(
    '$label muestra diez filas sin contador y la recarga respeta filtros y reinicia página',
    async (tabla) => {
      const user = userEvent.setup()
      let fuente = datos(67),
        pausar = false,
        liberar
      const pagina = (offset) => ({
        filas: fuente.slice(offset, offset + 50),
        total: fuente.length
      })
      const cargar = vi.fn((offset) =>
        pausar
          ? new Promise((resolve) => {
              liberar = () => resolve(pagina(offset))
            })
          : Promise.resolve(pagina(offset))
      )
      const servicio = montar(tabla, cargar)
      await screen.findByRole('table')
      expect(screen.queryByText(/^Total:/)).not.toBeInTheDocument()
      expect(filasVisibles()).toHaveLength(10)
      const nav = screen.getByRole('navigation', { name: 'Paginación de la tabla' })
      expect(
        screen.getByRole('table').compareDocumentPosition(nav) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy()
      await user.click(screen.getByRole('button', { name: 'Siguiente' }))
      expect(filasVisibles()).toHaveLength(10)
      expect(filasVisibles()[0]).toHaveTextContent(
        tabla.seccion || tabla.asignados ? 'Persona 11' : '763-11'
      )
      await user.click(screen.getByRole('button', { name: 'Página 7' }))
      await waitFor(() => expect(filasVisibles()).toHaveLength(7))
      expect(filasVisibles()[0]).toHaveTextContent(
        tabla.seccion || tabla.asignados ? 'Persona 61' : '763-61'
      )
      expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
      expect(screen.queryByText(/^Total:/)).not.toBeInTheDocument()
      await user.type(screen.getByRole('searchbox'), '763{Enter}')
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute(
          'aria-current',
          'page'
        )
      )
      await user.click(screen.getByRole('button', { name: 'Siguiente' }))
      fuente = datos(3)
      pausar = true
      const recargar = screen.getByRole('button', { name: 'Actualizar tabla' })
      await user.click(recargar)
      await waitFor(() => expect(liberar).toBeTypeOf('function'))
      expect(recargar).toBeDisabled()
      expect(screen.getByRole('searchbox')).toHaveValue('763')
      liberar()
      await screen.findByRole('table')
      expect(filasVisibles()).toHaveLength(3)
      expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute(
        'aria-current',
        'page'
      )
      expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
      expect(recargar).toBeEnabled()
      const ultima = tabla.seccion
        ? servicio.trabajadoresCampania.mock.lastCall[3]
        : servicio.listar.mock.lastCall[1]
      expect(ultima.busqueda).toBe('763')
      expect(cargar.mock.lastCall[0]).toBe(0)
    }
  )

  it('corrige una página que dejó de existir cuando cambia el total en el servidor', async () => {
    const user = userEvent.setup()
    let fuente = datos(67)
    montar(tablas[0], (offset) =>
      Promise.resolve({
        filas: fuente.slice(offset, offset + 50),
        total: fuente.length
      })
    )
    await screen.findByRole('table')
    fuente = datos(3)
    await user.click(screen.getByRole('button', { name: 'Página 7' }))
    await waitFor(() => expect(filasVisibles()).toHaveLength(3))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('un resultado vacío no muestra contador y conserva la navegación deshabilitada', async () => {
    montar(tablas[0], async () => ({ filas: [], total: 0 }))
    await screen.findByText('No hay lotes de tickets generados')
    expect(screen.queryByText(/^Total:/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Actualizar tabla' })).toBeEnabled()
  })
})
