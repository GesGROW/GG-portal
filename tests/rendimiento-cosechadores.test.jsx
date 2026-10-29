import { describe, it, expect } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  RendimientoCosechadores,
  GraficoRendimiento
} from '../src/presentation/RendimientoCosechadores.jsx'
import {
  ordenarRendimiento,
  seriesRendimiento,
  trazarSerie
} from '../src/presentation/rendimientoCosechadores.js'

const fechas = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']
const personas = Array.from({ length: 12 }, (_, i) => ({
  id: `p${i}`,
  nombre: `Persona ${String(i + 1).padStart(2, '0')}`,
  dni: String(10000000 + i),
  posicion: i + 1,
  jabas: 24 - i,
  diasRegistros: 2,
  promedioDiario: (24 - i) / 2
}))
const datos = {
  ranking: personas,
  evolucion: fechas.map((fecha) => ({ fecha, jabas: 0 })),
  evolucionCosechadores: personas.flatMap((p) => [
    { trabajadorId: p.id, fecha: fechas[0], jabas: 2 },
    { trabajadorId: p.id, fecha: fechas[2], jabas: p.jabas - 3 },
    { trabajadorId: p.id, fecha: fechas[3], jabas: 1 }
  ])
}

describe('Evolución por cosechador', () => {
  it('ordena el detalle por las jabas del día seleccionado y deja los días sin registro al final, conservando los colores', () => {
    const series = Object.freeze([
      Object.freeze({
        id: 'a',
        nombre: 'Ana María López Rojas',
        valores: [12, 37],
        color: '#137d15',
        indiceColor: 0
      }),
      Object.freeze({
        id: 'b',
        nombre: 'Luis Alberto Peña Soto',
        valores: [39, null],
        color: '#547ba5',
        indiceColor: 1
      }),
      Object.freeze({
        id: 'c',
        nombre: 'Jorge Andrés García Ramos',
        valores: [null, 40],
        color: '#735794',
        indiceColor: 2
      })
    ])
    const { container } = render(
      <GraficoRendimiento fechas={fechas.slice(0, 2)} series={series} />
    )
    const detalle = () => [
      ...container.querySelectorAll('.rendimiento-dia-detalle dl > div')
    ]
    expect(detalle().map((n) => n.textContent)).toEqual([
      'Luis Alberto Peña Soto39 jabas',
      'Ana María López Rojas12 jabas',
      'Jorge Andrés García RamosSin registro'
    ])
    fireEvent.change(screen.getByRole('slider'), { target: { value: '1' } })
    expect(detalle().map((n) => n.textContent)).toEqual([
      'Jorge Andrés García Ramos40 jabas',
      'Ana María López Rojas37 jabas',
      'Luis Alberto Peña SotoSin registro'
    ])
    expect(detalle()[0].querySelector('.rendimiento-color')).toHaveStyle({
      '--serie-color': '#735794'
    })
    expect(series.map((s) => s.id)).toEqual(['a', 'b', 'c'])
  })

  it('deja huecos en el calendario y reinicia el trazo sin inventar ceros ni unir días separados', () => {
    const serie = seriesRendimiento(
      fechas,
      [personas[0]],
      datos.evolucionCosechadores
    )[0]
    expect(serie.valores).toEqual([2, null, 21, 1])
    expect(
      trazarSerie(
        serie.valores,
        (i) => i * 10,
        (n) => n
      )
    ).toBe('M0,2 M20,21 L30,1')
    expect(
      trazarSerie(
        [null, 2, null, null],
        (i) => i,
        (n) => n
      )
    ).toBe('M1,2')
    expect(
      trazarSerie(
        [null, null],
        (i) => i,
        (n) => n
      )
    ).toBe('')
    const { container } = render(
      <GraficoRendimiento
        fechas={fechas}
        series={[{ ...serie, color: '#137d15', indiceColor: 0 }]}
      />
    )
    expect(container.querySelectorAll('circle')).toHaveLength(3)
    expect(container.querySelector('circle[data-fecha="2026-10-21"]')).toBeNull()
    fireEvent.change(screen.getByRole('slider'), { target: { value: '1' } })
    expect(screen.getByText('Sin registro')).toBeInTheDocument()
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '21/10/2026')
    fireEvent.change(screen.getByRole('slider'), { target: { value: '2' } })
    expect(screen.getByText('21 jabas')).toBeInTheDocument()
  })

  it('ordena por mayor y menor sin mutar la respuesta y limita el gráfico a los primeros elegidos', async () => {
    const original = Object.freeze(personas.map((p) => Object.freeze({ ...p })))
    expect(ordenarRendimiento(original, 'MENOR')[0].id).toBe('p11')
    expect(original[0].id).toBe('p0')
    const user = userEvent.setup()
    const { container } = render(<RendimientoCosechadores datos={datos} />)
    const tabla = screen.getByRole('table', { name: 'Ranking de cosechadores' })
    expect(within(tabla).getAllByRole('row')[1]).toHaveTextContent('Persona 01')
    expect(container.querySelectorAll('[data-serie-id]')).toHaveLength(5)
    await user.selectOptions(screen.getByLabelText('Orden del ranking'), 'MENOR')
    expect(within(tabla).getAllByRole('row')[1]).toHaveTextContent('Persona 12')
    expect(container.querySelector('[data-serie-id]')).toHaveAttribute(
      'data-serie-id',
      'p11'
    )
    await user.selectOptions(screen.getByLabelText('Cosechadores del gráfico'), '10')
    expect(container.querySelectorAll('[data-serie-id]')).toHaveLength(10)
    const leyenda = screen.getByLabelText('Líneas del gráfico')
    await user.click(within(leyenda).getByRole('button', { name: 'Persona 12' }))
    expect(container.querySelectorAll('[data-serie-id]')).toHaveLength(9)
    expect(within(leyenda).getByRole('button', { name: 'Persona 12' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('permite comparar por nombre o DNI hasta diez personas, conservando los días sin registros', async () => {
    const user = userEvent.setup()
    const { container } = render(<RendimientoCosechadores datos={datos} />)
    await user.selectOptions(
      screen.getByLabelText('Cosechadores del gráfico'),
      'manual'
    )
    expect(screen.getByLabelText('Buscar cosechador para comparar')).toBeVisible()
    const casillas = screen.getAllByRole('checkbox')
    for (const casilla of casillas.slice(0, 10)) await user.click(casilla)
    expect(casillas[10]).toBeDisabled()
    expect(casillas[11]).toBeDisabled()
    expect(container.querySelectorAll('[data-serie-id]')).toHaveLength(10)
    await user.click(casillas[0])
    expect(casillas[10]).toBeEnabled()
    await user.type(
      screen.getByLabelText('Buscar cosechador para comparar'),
      '10000011'
    )
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    await user.click(screen.getByRole('checkbox'))
    expect(container.querySelectorAll('input[type="checkbox"]:checked')).toHaveLength(1)
    expect(container.querySelectorAll('[data-serie-id]')).toHaveLength(10)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '1' } })
    expect(screen.getAllByText('Sin registro')).toHaveLength(10)
  })

  it('no fabrica producción cuando no hay registros ni conecta extremos vacíos', () => {
    expect(seriesRendimiento(fechas, [personas[0]], []).at(0).valores).toEqual([
      null,
      null,
      null,
      null
    ])
    const { container } = render(
      <RendimientoCosechadores
        datos={{ ...datos, ranking: [], evolucionCosechadores: [] }}
      />
    )
    expect(screen.getByText('Nadie ha cosechado aún')).toBeInTheDocument()
    expect(container.querySelectorAll('circle')).toHaveLength(0)
    expect(screen.getByRole('slider')).toBeDisabled()
  })
})
