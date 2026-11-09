import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TareoExportacion } from '../src/presentation/TareoExportacion.jsx'
import { leerPadron } from '../src/infrastructure/leerPadron.js'
import { crearTareoXlsx } from '../src/infrastructure/tareoXlsx.js'

const fila = { trabajadorId: 'p1', dni: '12345678', nombre: 'Pérez Ana', loteId: 'l1', variedadId: 'v1',
  lote: 'Lote 02', variedad: 'Ventura', codigoTrabajador: null, actividad: null, labor: null, consumidor: null }
describe('exportación de tareo', () => {
  it('completa códigos desde padrón, guarda y exporta el snapshot semanal', async () => {
    const user = userEvent.setup()
    let filas = [{ ...fila }]
    const servicio = {
      tareo: vi.fn(async () => ({ campaniaId: 'c1', datos: { filas, desde: '2026-11-05' } })),
      guardarTareo: vi.fn(async (_, datos) => {
        filas = [{ ...filas[0], codigoTrabajador: datos.trabajadores[0].codigo, ...datos.imputaciones[0] }]
      }),
      leerPadron: vi.fn(async () => new Map([['12345678', '000123']])),
      exportarTareo: vi.fn(async () => {})
    }
    render(<TareoExportacion servicio={servicio} campaniaId="c1" trabajadorId="" hoy="2026-11-09" />)
    await user.click(screen.getByRole('button', { name: 'Exportar tareo de Quijas' }))
    await screen.findByRole('table', { name: 'Vista previa del tareo' })
    expect(screen.getByLabelText('Período de Quijas')).toHaveValue('202611-45')
    expect(screen.getByRole('button', { name: 'Descargar Excel' })).toBeDisabled()
    await user.upload(screen.getByLabelText('Completar códigos desde padrón Excel'), new File(['x'], 'padron.xlsx'))
    await screen.findByDisplayValue('000123')
    await user.type(screen.getByLabelText(/^Actividad:/), '004')
    await user.type(screen.getByLabelText(/^Labor:/), '004041')
    await user.type(screen.getByLabelText(/^Consumidor:/), 'TR0110006')
    await user.click(screen.getByRole('button', { name: 'Guardar códigos' }))
    expect(servicio.guardarTareo.mock.calls[0]?.[1]).toEqual({ trabajadores: [{ id: 'p1', codigo: '000123' }],
      imputaciones: [{ loteId: 'l1', variedadId: 'v1', actividad: '004', labor: '004041', consumidor: 'TR0110006' }] })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Descargar Excel' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Descargar Excel' }))
    expect(servicio.guardarTareo.mock.calls[0][1].trabajadores).toEqual([{ id: 'p1', codigo: '000123' }])
    expect(servicio.exportarTareo.mock.calls[0][1]).toBe('202611-45')
    expect(await screen.findByText('Archivo de tareo generado.')).toHaveAttribute('role', 'status')
  })
  it('lee padrón, conserva ceros y rechaza duplicados sin depender de datos personales reales', async () => {
    const bytes = crearTareoXlsx([['CODIGO', 'DNI'], ['000123', '12345678']])
    expect(await leerPadron({ size: bytes.length, arrayBuffer: async () => bytes })).toEqual(new Map([['12345678', '000123']]))
    const duplicado = crearTareoXlsx([['CODIGO', 'DNI'], ['000123', '12345678'], ['000123', '87654321']])
    await expect(leerPadron({ size: duplicado.length, arrayBuffer: async () => duplicado })).rejects.toThrow(/duplicados/)
  })
  it('muestra el error de consulta y permite reintentar', async () => {
    const user = userEvent.setup(), servicio = { tareo: vi.fn().mockRejectedValue(new Error('Sin conexión')) }
    render(<TareoExportacion servicio={servicio} campaniaId="c1" trabajadorId="" hoy="2026-11-09" />)
    await user.click(screen.getByRole('button', { name: 'Exportar tareo de Quijas' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled()
  })
})
