import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SummaryMetrics } from '../src/presentation/SummaryMetrics.jsx'

describe('Resumen de métricas compartido', () => {
  it('conserva los valores cero y actualiza los conteos sin convertirlos en acciones', () => {
    const items = [
      { key: 'hoy', icon: 'calendar-check', label: 'Asignaciones hoy', value: 0 },
      { key: 'activas', icon: 'file-check', label: 'Activas', value: 2 }
    ]
    const { rerender } = render(
      <SummaryMetrics label="Resumen de asignaciones" items={items} />
    )
    const summary = screen.getByLabelText('Resumen de asignaciones')
    expect(within(summary).queryByRole('button')).not.toBeInTheDocument()
    expect(
      within(screen.getByText('Asignaciones hoy').closest('article')).getByText('0')
    ).toBeInTheDocument()
    rerender(
      <SummaryMetrics
        label="Resumen de asignaciones"
        items={[{ ...items[0], value: 5 }, items[1]]}
      />
    )
    expect(
      within(screen.getByText('Asignaciones hoy').closest('article')).getByText('5')
    ).toBeInTheDocument()
    expect(within(summary).getByText('2')).toBeInTheDocument()
  })

  it('mantiene el filtro accionable por teclado y comunica si está seleccionado', async () => {
    const onClick = vi.fn()
    const item = {
      key: 'pendientes',
      icon: 'grid-2x2-x',
      label: 'Datos pendientes',
      value: 4,
      onClick,
      pressed: false
    }
    const { rerender } = render(
      <SummaryMetrics label="Resumen de la selección" items={[item]} />
    )
    const button = screen.getByRole('button', {
      name: /Datos pendientes/,
      pressed: false
    })
    const user = userEvent.setup()
    await user.tab()
    expect(button).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(
      <SummaryMetrics
        label="Resumen de la selección"
        items={[{ ...item, pressed: true }]}
      />
    )
    expect(
      screen.getByRole('button', { name: /Datos pendientes/, pressed: true })
    ).toBe(button)
    expect(button).toHaveFocus()
  })
})
