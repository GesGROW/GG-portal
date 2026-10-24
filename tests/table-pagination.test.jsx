import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TablePagination } from '../src/presentation/Ui.jsx'

describe('Paginación compartida de tablas', () => {
  it('permite saltar a la última página y avanzar con la flecha desde la primera', async () => {
    const change = vi.fn()
    render(<TablePagination total={300} onPageChange={change} />)
    const user = userEvent.setup()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.queryByRole('button', { name: 'Página 4' })).not.toBeInTheDocument()
    expect(screen.getByText('…')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Página 6' }))
    expect(change).toHaveBeenLastCalledWith(6)
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(change).toHaveBeenLastCalledWith(2)
    await user.click(screen.getByRole('button', { name: 'Página 1' }))
    expect(change).toHaveBeenCalledTimes(2)
  })

  it('muestra páginas cercanas, ambos extremos y huecos sin botones de relleno', async () => {
    const change = vi.fn()
    render(<TablePagination total={1000} offset={450} onPageChange={change} />)
    expect(screen.getByRole('button', { name: 'Página 10' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getAllByText('…')).toHaveLength(2)
    for (const page of [1, 9, 10, 11, 20])
      expect(
        screen.getByRole('button', { name: `Página ${page}`, exact: true })
      ).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(change).toHaveBeenLastCalledWith(9)
    await user.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(change).toHaveBeenLastCalledWith(11)
  })

  it('actualiza la página, el rango parcial y los límites cuando cambia el offset', () => {
    const change = vi.fn()
    const props = { total: 63, pageSize: 25, onPageChange: change, showSummary: true }
    const { rerender } = render(<TablePagination {...props} offset={25} />)
    expect(screen.getByText('Mostrando 26-50 de 63')).toBeInTheDocument()
    rerender(<TablePagination {...props} offset={50} />)
    expect(screen.getByText('Mostrando 51-63 de 63')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Página 3' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
  })

  it.each([0, 35])(
    'deshabilita las flechas con %s resultados en una sola página',
    (total) => {
      render(<TablePagination total={total} showSummary onPageChange={vi.fn()} />)
      expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Página 1' })).toHaveAttribute(
        'aria-current',
        'page'
      )
      expect(
        screen.getByText(total ? 'Mostrando 1-35 de 35' : 'Sin resultados')
      ).toBeInTheDocument()
    }
  )

  it('permite elegir páginas mediante el teclado y anuncia la página actual', async () => {
    const change = vi.fn()
    render(
      <TablePagination
        label="Páginas de trabajadores"
        total={150}
        onPageChange={change}
      />
    )
    const navigation = screen.getByRole('navigation', {
      name: 'Páginas de trabajadores'
    })
    expect(within(navigation).getByRole('status')).toHaveTextContent('Página 1 de 3')
    const user = userEvent.setup()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Página 1' })).toHaveFocus()
    await user.tab()
    await user.keyboard('{Enter}')
    expect(change).toHaveBeenCalledExactlyOnceWith(2)
  })
})
