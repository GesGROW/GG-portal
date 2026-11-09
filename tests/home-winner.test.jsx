import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HomeWinner } from '../src/presentation/HomeSummaryParts.jsx'

describe('Identidad del top cosechador', () => {
  it.each([undefined, null, '', '  \t\n ', 'Sin nombre registrado', 'sin nombre'])('muestra DNI sin nombre (%s)', (nombre) => {
    render(<HomeWinner ranking={[{
      cosechador: nombre, cosechador_dni: '01234567', total_jabas: 12
    }]} />)
    expect(screen.getByText('DNI 01234567')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.queryByText('Nadie ha cosechado aún')).not.toBeInTheDocument()
  })

  it('muestra el nombre disponible y lo actualiza cuando deja de ser provisional', () => {
    const persona = { cosechador_dni: '01234567', total_jabas: 12 }
    const { rerender } = render(<HomeWinner ranking={[{ ...persona, cosechador: '' }]} />)
    expect(screen.getByText('DNI 01234567')).toBeInTheDocument()
    rerender(<HomeWinner ranking={[{ ...persona, cosechador: '  Ana López  ' }]} />)
    expect(screen.getByText('Ana López')).toBeInTheDocument()
    expect(screen.queryByText('DNI 01234567')).not.toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
  })

  it('informa la falta de DNI si el registro tampoco incluye ese dato', () => {
    render(<HomeWinner ranking={[{ cosechador: ' ', total_jabas: 12 }]} />)
    expect(screen.getByText('DNI no disponible')).toBeInTheDocument()
  })

  it('conserva el estado sin cosecha cuando el ranking está vacío', () => {
    render(<HomeWinner ranking={[]} />)
    expect(screen.getByRole('status')).toHaveTextContent('Nadie ha cosechado aún')
    expect(screen.queryByText(/DNI/)).not.toBeInTheDocument()
  })
})
