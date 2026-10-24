import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../src/presentation/Ui.jsx'
import { ComparisonChart } from '../src/presentation/Ranking.jsx'

describe('semántica visual de Palette V2', () => {
  it.each([
    ['DISPONIBLE', 'available'], ['ASIGNADO', 'warning'],
    ['UTILIZADO', 'success'], ['CONSUMIDO', 'success'], ['RECHAZADO', 'error']
  ])('presenta %s con tono %s sin cambiar el estado entregado', (label, tone) => {
    render(<StatusBadge>{label}</StatusBadge>)
    expect(screen.getByText(label)).toHaveClass(tone)
  })
  it('respeta el tono explícito y conserva neutral para contenido sin semántica de estado', () => {
    render(<><StatusBadge tone="info">DISPONIBLE</StatusBadge><StatusBadge><span>Etiqueta</span></StatusBadge></>)
    expect(screen.getByText('DISPONIBLE')).toHaveClass('info')
    expect(screen.getByText('Etiqueta').parentElement).toHaveClass('neutral')
  })
  it('conserva colores al reordenar una comparación y mantiene los valores y la tabla', () => {
    const filas = Array.from({ length: 5 }, (_, i) => ({
      cosechador_dni: String(i), cosechador: `Persona ${i}`, total_jabas: 10+i, ultima_lectura: null
    }))
    const seriesByWorker = new Map(filas.map((f, i) => [f.cosechador_dni, i+1]))
    const { rerender } = render(<ComparisonChart filas={filas} periodo="Campaña" seriesByWorker={seriesByWorker} />)
    rerender(<ComparisonChart filas={[...filas].reverse()} periodo="Campaña" seriesByWorker={seriesByWorker} />)
    for (const [i, fila] of filas.entries())
      expect(screen.getByLabelText(`${fila.cosechador}: ${fila.total_jabas} jabas`)).toHaveClass(`series-${i+1}`)
    expect(screen.getByRole('table', { name: 'Comparación de cosechadores · Campaña' }).rows).toHaveLength(6)
  })
})
