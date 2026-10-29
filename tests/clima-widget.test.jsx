import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ClimaWidget } from '../src/presentation/ClimaWidget.jsx'

const datos = {
  ubicacion: 'Lima',
  temperatura: 23,
  condicion: 'Parcialmente nublado',
  humedad: 75,
  viento: 12,
  probabilidadLluvia: 30,
  actualizadoEn: '2026-10-29T02:00:00Z',
  zonaHoraria: 'America/Lima'
}
describe('clima con ubicación opcional', () => {
  it('identifica la localidad aproximada cuando el navegador no entrega coordenadas', async () => {
    const servicio = { consultar: async () => ({ ...datos, ubicacionAproximada: true }) }
    render(<ClimaWidget owner servicio={servicio} momento="night" />)
    expect(await screen.findByTitle('Ubicación aproximada según tu conexión')).toHaveTextContent('Lima · Aprox.')
    expect(screen.getByText('75 %')).toBeVisible()
  })
  it.each([null, new Error('consulta no disponible')])(
    'sin permiso o con error conserva sólo el icono',
    async (resultado) => {
      const servicio = {
        consultar: vi.fn(async () => {
          if (resultado instanceof Error) throw resultado
          return resultado
        })
      }
      render(<ClimaWidget owner servicio={servicio} momento="night" />)
      await waitFor(() => expect(servicio.consultar).toHaveBeenCalledOnce())
      expect(
        screen.getByRole('region', { name: 'Clima no configurado' })
      ).toHaveAttribute('data-time-of-day', 'night')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText('WeatherAPI.com')).not.toBeInTheDocument()
    }
  )
  it('muestra el resumen y retira los datos al revocar ubicación', async () => {
    let permiso
    const dejar = vi.fn()
    const servicio = {
      consultar: vi.fn(async () => datos),
      observarPermiso: (cb) => {
        permiso = cb
        return dejar
      }
    }
    const { unmount } = render(<ClimaWidget owner servicio={servicio} momento="day" />)
    await screen.findByRole('region', { name: 'Clima en Lima' })
    for (const texto of [
      'Parcialmente nublado',
      '30 %',
      '75 %',
      '12 km/h',
      'WeatherAPI.com'
    ])
      expect(screen.getByText(texto)).toBeVisible()
    act(() => permiso('denied'))
    expect(
      screen.getByRole('region', { name: 'Clima no configurado' })
    ).toBeInTheDocument()
    expect(screen.queryByText('75 %')).not.toBeInTheDocument()
    unmount()
    expect(dejar).toHaveBeenCalledOnce()
  })
})
