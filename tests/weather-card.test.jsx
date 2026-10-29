import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WeatherCard } from '../src/presentation/DashboardWidgets.jsx'
import { OwnerHome } from '../src/presentation/OwnerHome.jsx'

afterEach(() => vi.useRealTimers())

describe('fondo horario del clima', () => {
  it.each([
    ['2026-10-15T10:59:00Z', 'night'],
    ['2026-10-15T11:00:00Z', 'day'],
    ['2026-10-15T16:59:00Z', 'day'],
    ['2026-10-15T17:00:00Z', 'afternoon'],
    ['2026-10-15T23:59:00Z', 'afternoon'],
    ['2026-10-16T00:00:00Z', 'night'],
    ['2026-10-16T05:00:00Z', 'night']
  ])('usa la hora de Lima en %s', (time, period) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(time))
    render(<WeatherCard />)
    expect(
      screen.getByRole('region', { name: 'Clima no configurado' })
    ).toHaveAttribute('data-time-of-day', period)
    expect(
      screen.getByText('La información meteorológica aún no está disponible.')
    ).toBeVisible()
  })

  it('cambia de fondo sin recargar al pasar de día a tarde', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T16:59:30Z'))
    const { unmount } = render(<WeatherCard />)
    const card = screen.getByRole('region', { name: 'Clima no configurado' })
    expect(card).toHaveAttribute('data-time-of-day', 'day')
    act(() => vi.advanceTimersByTime(60_000))
    expect(card).toHaveAttribute('data-time-of-day', 'afternoon')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('actualiza el fondo al regresar a una pestaña suspendida', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T21:00:00Z'))
    render(<WeatherCard />)
    vi.setSystemTime(new Date('2026-10-16T01:00:00Z'))
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(
      screen.getByRole('region', { name: 'Clima no configurado' })
    ).toHaveAttribute('data-time-of-day', 'night')
  })

  it('el Home usa el mismo horario y actualiza al volver a la pestaña', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T16:59:30Z'))
    const { unmount } = render(
      <OwnerHome estado={{ modulos: [], contexto: { permite: () => false } }} />
    )
    const card = screen.getByRole('region', { name: 'Clima no configurado' })
    expect(card).toHaveAttribute('data-time-of-day', 'day')
    act(() => vi.advanceTimersByTime(60_000))
    expect(card).toHaveAttribute('data-time-of-day', 'afternoon')
    vi.setSystemTime(new Date('2026-10-16T01:00:00Z'))
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(card).toHaveAttribute('data-time-of-day', 'night')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
