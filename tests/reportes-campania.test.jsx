import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { ReportesCampania, EvolucionCampania, RankingCampania } from '../src/presentation/ReportesCampania.jsx'
import { CampaniaCosecha } from '../src/presentation/CampaniaCosecha.jsx'
import { fakePorts } from './support/fakePorts.js'
import { fakeReportes } from './support/fakeReportes.js'

function servicio() {
  const ports = fakePorts({ autenticado: true })
  fakeReportes(ports)
  return { campania: vi.fn((f) => ports.reportesHarvest.campania('A', f)) }
}
const campania = { id: 'A-camp', nombre: 'Campaña Arándano 2026', estado: 'ACTIVA' }
describe('Reportes dentro de Cosecha', () => {
  it('producción presenta las métricas del servidor, filtra lotes y limpia una variedad incompatible', async () => {
    const api = servicio(),
      user = userEvent.setup()
    render(<ReportesCampania servicio={api} campania={campania} />)
    const total = await screen.findByRole('article', { name: 'Total jabas' })
    expect(within(total).getByText('342')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Evolución' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '22/10/2026: 203 jabas' })).toHaveClass(
      'is-today'
    )
    await user.selectOptions(screen.getByLabelText('Variedad del reporte'), 'v1')
    await waitFor(() =>
      expect(api.campania).toHaveBeenLastCalledWith(
        expect.objectContaining({ variedadId: 'v1' })
      )
    )
    await user.selectOptions(screen.getByLabelText('Lote del reporte'), 'l2')
    await waitFor(() =>
      expect(api.campania).toHaveBeenLastCalledWith(
        expect.objectContaining({ loteId: 'l2', variedadId: '' })
      )
    )
    await waitFor(() =>
      expect(screen.queryByRole('option', { name: 'Ventura' })).not.toBeInTheDocument()
    )
    expect(screen.getByRole('option', { name: 'Biloxi' })).toBeInTheDocument()
  })
  it('rendimiento abre toda la campaña con tabla, promedios y evolución diaria', async () => {
    const api = servicio()
    render(<ReportesCampania servicio={api} campania={campania} rendimiento />)
    await screen.findByRole('article', { name: 'Mayor rendimiento' })
    expect(screen.getByLabelText('Variedad del reporte')).toBeInTheDocument()
    expect(screen.getByText('15/10/2026 - Hoy')).toBeInTheDocument()
    const tabla = screen.getByRole('table', { name: 'Ranking de cosechadores' })
    expect(within(tabla).getAllByRole('row')).toHaveLength(11)
    expect(within(tabla).getByText('Gianella Sotil')).toBeInTheDocument()
    expect(within(tabla).getByRole('columnheader', { name: 'Días con registros' })).toBeInTheDocument()
    expect(within(tabla).getByRole('columnheader', { name: 'Promedio por día con registros' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Evolución diaria/ })).toBeInTheDocument()
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Orden del ranking'), 'MENOR')
    expect(within(tabla).getAllByRole('row')[1]).toHaveTextContent('Diego Castillo')
    await user.selectOptions(screen.getByLabelText('Cosechadores del gráfico'), '10')
    expect(api.campania).toHaveBeenCalledTimes(1)
    await user.selectOptions(screen.getByLabelText('Variedad del reporte'), 'v1')
    await waitFor(() => expect(api.campania).toHaveBeenLastCalledWith(expect.objectContaining({ variedadId: 'v1' })))
  })
  it('aplica rango de fechas y permite restablecer; no acepta un fin posterior a hoy', async () => {
    const api = servicio(),
      user = userEvent.setup()
    render(<ReportesCampania servicio={api} campania={campania} />)
    await screen.findByText('15/10/2026 - Hoy')
    await user.click(screen.getByText('15/10/2026 - Hoy'))
    await user.clear(screen.getByLabelText('Desde'))
    await user.type(screen.getByLabelText('Desde'), '2026-10-20')
    await user.clear(screen.getByLabelText('Hasta'))
    await user.type(screen.getByLabelText('Hasta'), '2026-10-21')
    await user.click(screen.getByRole('button', { name: 'Aplicar', exact: true }))
    await waitFor(() =>
      expect(api.campania).toHaveBeenLastCalledWith(
        expect.objectContaining({ desde: '2026-10-20', hasta: '2026-10-21' })
      )
    )
    await screen.findByText('20/10/2026 - 21/10/2026')
    await user.click(screen.getByText('20/10/2026 - 21/10/2026'))
    await user.clear(screen.getByLabelText('Hasta'))
    await user.type(screen.getByLabelText('Hasta'), '2026-10-23')
    expect(screen.getByRole('button', { name: 'Aplicar', exact: true })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Restablecer', exact: true }))
    await waitFor(() =>
      expect(api.campania).toHaveBeenLastCalledWith(
        expect.objectContaining({ desde: null, hasta: null })
      )
    )
  })
  it('permite entrar desde Reportes, marca la navegación correcta y conserva la subopción al cambiar de campaña', async () => {
    const api = servicio(),
      user = userEvent.setup()
    const catalogo = {
      campanias: async () => [
        campania,
        { ...campania, id: 'A-cerrada', nombre: 'Anterior', estado: 'CERRADA' }
      ]
    }
    render(
      <MemoryRouter initialEntries={['/cosecha/produccion?campania=A-camp']}>
        <CampaniaCosecha
          servicio={catalogo}
          reportes={api}
          contexto={{ permite: () => true }}
          seccion="produccion"
        />
      </MemoryRouter>
    )
    await screen.findByRole('article', { name: 'Total jabas' })
    expect(screen.getByRole('link', { name: 'Reportes', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(
      screen.getByRole('link', { name: 'Tickets', exact: true })
    ).not.toHaveAttribute('aria-current')
    expect(
      screen.getByRole('link', { name: 'Rendimiento', exact: true })
    ).toHaveAttribute('href', '/cosecha/rendimiento?campania=A-camp')
    await user.selectOptions(screen.getByLabelText('Campaña de cosecha'), 'A-cerrada')
    await waitFor(() =>
      expect(api.campania).toHaveBeenLastCalledWith(
        expect.objectContaining({ campaniaId: 'A-cerrada', tipo: 'PRODUCCION' })
      )
    )
  })
  it('un error permite reintentar y un filtro vacío no fabrica un podio', async () => {
    const api = servicio(),
      original = api.campania.getMockImplementation(),
      user = userEvent.setup()
    api.campania
      .mockRejectedValueOnce(new Error('Sin conexión'))
      .mockImplementation(original)
    render(<ReportesCampania servicio={api} campania={campania} rendimiento />)
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByRole('article', { name: 'Total cosechado' })
    await user.click(screen.getByText('15/10/2026 - Hoy'))
    await user.clear(screen.getByLabelText('Desde'))
    await user.type(screen.getByLabelText('Desde'), '2026-10-10')
    await user.clear(screen.getByLabelText('Hasta'))
    await user.type(screen.getByLabelText('Hasta'), '2026-10-11')
    await user.click(screen.getByRole('button', { name: 'Aplicar', exact: true }))
    await screen.findByText('Nadie ha cosechado aún')
    expect(screen.queryByRole('list', { name: 'Primeros tres cosechadores' })).not.toBeInTheDocument()
    expect(screen.queryByText('No hay producción registrada para estos filtros.')).not.toBeInTheDocument()
  })
  it.each([1, 10, 349, 1001])('la escala para %i jabas usa enteros equidistantes y conserva el valor reportado', (jabas) => {
    const { container } = render(<EvolucionCampania dias={[{ fecha: '2026-10-22', jabas }]} hoy="2026-10-22" />)
    const escala = [...container.querySelectorAll('.campaign-evolution-axis span')]
      .map((el) => Number(el.textContent.replaceAll(',', '')))
    expect(escala).toHaveLength(5)
    expect(escala.every(Number.isInteger)).toBe(true)
    expect(escala[0]).toBeGreaterThanOrEqual(jabas)
    expect(escala.at(-1)).toBe(0)
    expect(new Set(escala.slice(1).map((n, i) => escala[i] - n)).size).toBe(1)
    expect(screen.getByRole('button')).toHaveAttribute('title', `22/10/2026: ${new Intl.NumberFormat('es-PE').format(jabas)} jabas`)
  })

  it('producción sin lecturas conserva la escala y muestra el aviso sin fechas ni barras vacías', () => {
    render(<EvolucionCampania dias={[{ fecha: '2026-10-22', jabas: 0 }]} hoy="2026-10-22" />)
    expect(screen.getByRole('status')).toHaveTextContent('Nadie ha cosechado aún')
    expect(screen.getByText('40')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText('22/10/2026')).not.toBeInTheDocument()
  })
  it.each([1, 2, 3])('muestra solo los %i cosechadores disponibles en la tabla', (cantidad) => {
    const filas = Array.from({ length: cantidad }, (_, i) => ({
      id: `p-${i}`, nombre: `Persona ${i + 1}`, jabas: 67 - i * 20, posicion: i + 1,
      diasRegistros: 1, promedioDiario: 67 - i * 20
    }))
    render(<RankingCampania filas={filas} />)
    expect(screen.getAllByRole('row')).toHaveLength(cantidad + 1)
    for (const fila of filas) expect(screen.getByText(fila.nombre)).toBeInTheDocument()
  })
})
