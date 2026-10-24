import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataTable } from '../src/presentation/Ui.jsx'

describe('DataTable compartida', () => {
  it('conserva nombres accesibles, encabezados de fila, anchos y propiedades de celdas', () => {
    render(
      <DataTable
        label="Listado de producción"
        caption="Producción de campaña"
        captionClassName="sr-only"
        className="production-scroll"
        tableClassName="production-table"
        data={[{ id: 'A', nombre: 'Ana', jabas: 15 }]}
        rowClassName={(row) => (row.jabas > 10 ? 'destacada' : undefined)}
        columns={[
          { key: 'nombre', header: 'Trabajador', rowHeader: true, width: '60%' },
          {
            key: 'jabas',
            header: 'Jabas',
            className: 'numeric',
            headerClassName: 'total',
            cellProps: (row) => ({ title: `${row.jabas} jabas` }),
            render: (row) => <strong>{row.jabas}</strong>
          }
        ]}
      />
    )
    const region = screen.getByRole('region', { name: 'Listado de producción' })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(region).toHaveClass('table-scroll', 'production-scroll')
    const table = within(region).getByRole('table', { name: 'Producción de campaña' })
    expect(table).toHaveClass('production-table')
    expect(table.querySelector('caption')).toHaveClass('sr-only')
    expect(table.querySelector('col')).toHaveStyle({ width: '60%' })
    expect(within(table).getByRole('columnheader', { name: 'Jabas' })).toHaveClass(
      'total'
    )
    const rowHeader = within(table).getByRole('rowheader', { name: 'Ana' })
    expect(rowHeader).toHaveAttribute('scope', 'row')
    expect(rowHeader.closest('tr')).toHaveClass('destacada')
    expect(within(table).getByRole('cell', { name: '15' })).toHaveClass('numeric')
    expect(within(table).getByRole('cell', { name: '15' })).toHaveAttribute(
      'title',
      '15 jabas'
    )
  })

  it('distingue cero y texto vacío de datos ausentes y respeta un render vacío', () => {
    render(
      <DataTable
        label="Valores"
        data={[{ id: 'A', cero: 0, vacio: '', ausente: null }]}
        columns={[
          { key: 'cero', header: 'Cero' },
          { key: 'vacio', header: 'Texto vacío' },
          { key: 'ausente', header: 'Ausente' },
          { key: 'opcional', header: 'Opcional', render: () => null }
        ]}
      />
    )
    expect(screen.getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      '0',
      '',
      '—',
      ''
    ])
  })

  it('ejecuta las acciones con la fila correspondiente', async () => {
    const abrir = vi.fn()
    const activar = vi.fn()
    const data = [
      { codigo: 'A', nombre: 'Ana' },
      { codigo: 'B', nombre: 'Bruno' }
    ]
    render(
      <DataTable
        label="Personas"
        tableLabel="Personas disponibles"
        rowKey="codigo"
        data={data}
        onRowActivate={activar}
        columns={[{ key: 'nombre', header: 'Nombre' }]}
        actionsHeader="Detalle"
        actions={(row) => (
          <button onClick={() => abrir(row)}>Abrir {row.nombre}</button>
        )}
      />
    )
    const table = screen.getByRole('table', { name: 'Personas disponibles' })
    expect(
      within(table).getByRole('columnheader', { name: 'Detalle' })
    ).toHaveAttribute('scope', 'col')
    await userEvent
      .setup()
      .click(within(table).getByRole('button', { name: 'Abrir Bruno' }))
    expect(abrir).toHaveBeenCalledExactlyOnceWith(data[1])
    expect(activar).not.toHaveBeenCalled()
  })

  it('respeta los enlaces y campos internos de una fila que abre detalles', async () => {
    const activar = vi.fn()
    const fila = { id: 'A', nombre: 'Ana' }
    render(
      <DataTable
        label="Personas"
        data={[fila]}
        onRowActivate={activar}
        rowLabel={(row) => `Abrir ${row.nombre}`}
        columns={[
          { key: 'nombre', header: 'Nombre' },
          {
            key: 'enlace',
            header: 'Enlace',
            render: () => <a href="#detalle">Ver enlace</a>
          },
          {
            key: 'seleccion',
            header: 'Selección',
            render: () => (
              <label>
                <input type="checkbox" /> Elegir
              </label>
            )
          }
        ]}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('link', { name: 'Ver enlace' }))
    await user.click(screen.getByText('Elegir'))
    expect(screen.getByRole('checkbox')).toBeChecked()
    expect(activar).not.toHaveBeenCalled()
    await user.click(screen.getByRole('cell', { name: 'Ana' }))
    expect(activar).toHaveBeenCalledExactlyOnceWith(fila, 0)
    expect(screen.getByRole('row', { name: 'Abrir Ana' })).toHaveFocus()
  })

  it('mantiene el estado y el foco de los controles al reordenar filas por su identidad', async () => {
    const data = [
      { codigo: 'A', nombre: 'Ana' },
      { codigo: 'B', nombre: 'Bruno' }
    ]
    const columns = [
      {
        key: 'nombre',
        header: 'Nombre',
        render: (row) => <input aria-label={`Nota de ${row.nombre}`} defaultValue="" />
      }
    ]
    const props = { label: 'Notas', columns, rowKey: (row) => row.codigo }
    const { rerender } = render(<DataTable {...props} data={data} />)
    const input = screen.getByLabelText('Nota de Ana')
    await userEvent.setup().type(input, 'Pendiente')
    rerender(<DataTable {...props} data={[...data].reverse()} />)
    expect(screen.getByLabelText('Nota de Ana')).toBe(input)
    expect(input).toHaveValue('Pendiente')
    expect(input).toHaveFocus()
  })

  it('mantiene las cabeceras cuando la pantalla entrega una lista vacía', () => {
    render(
      <DataTable
        label="Sin datos"
        data={[]}
        columns={[{ key: 'nombre', header: 'Nombre' }]}
      />
    )
    const table = screen.getByRole('table', { name: 'Sin datos' })
    expect(
      within(table).getByRole('columnheader', { name: 'Nombre' })
    ).toBeInTheDocument()
    expect(within(table).getAllByRole('row')).toHaveLength(1)
    expect(table.querySelector('tbody')).toBeEmptyDOMElement()
  })

  it('pagina listas completas y vuelve a la primera página cuando cambian los resultados', async () => {
    const data = Array.from({ length: 61 }, (_, index) => ({
      id: index,
      nombre: `Persona ${index}`
    }))
    const columns = [{ key: 'nombre', header: 'Nombre' }]
    const { rerender } = render(
      <DataTable label="Personas" data={data} columns={columns} />
    )
    const user = userEvent.setup()
    const table = screen.getByRole('table', { name: 'Personas' })
    expect(within(table).getAllByRole('row')).toHaveLength(51)
    await user.click(screen.getByRole('button', { name: 'Página 2', exact: true }))
    expect(within(table).getAllByRole('row')).toHaveLength(12)
    expect(screen.getByText('Mostrando 51-61 de 61')).toBeInTheDocument()
    rerender(<DataTable label="Personas" data={[...data]} columns={columns} />)
    expect(screen.getByText('Mostrando 51-61 de 61')).toBeInTheDocument()
    rerender(<DataTable label="Personas" data={data.slice(0, 3)} columns={columns} />)
    expect(screen.getByText('Mostrando 1-3 de 3')).toBeInTheDocument()
    expect(within(table).getByText('Persona 0')).toBeInTheDocument()
  })

  it('conserva el índice absoluto y la fila correcta al abrir detalles en otra página', async () => {
    const abrir = vi.fn()
    const data = Array.from({ length: 55 }, (_, id) => ({
      id,
      nombre: `Persona ${id}`
    }))
    render(
      <DataTable
        label="Personas"
        data={data}
        onRowActivate={abrir}
        columns={[
          {
            key: 'nombre',
            header: 'Nombre',
            render: (row, index) => `${index}: ${row.nombre}`
          }
        ]}
      />
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Página 2', exact: true }))
    await user.click(screen.getByRole('cell', { name: '50: Persona 50', exact: true }))
    expect(abrir).toHaveBeenCalledExactlyOnceWith(data[50], 50)
  })

  it('delega la paginación remota sin recortar por segunda vez los datos recibidos', async () => {
    const cambiar = vi.fn()
    render(
      <DataTable
        label="Remota"
        data={[{ id: 51, nombre: 'Ana' }]}
        columns={[{ key: 'nombre', header: 'Nombre' }]}
        pagination={{ total: 101, offset: 50, onPageChange: cambiar }}
      />
    )
    expect(screen.getByRole('cell', { name: 'Ana' })).toBeInTheDocument()
    expect(screen.getByText('Mostrando 51-100 de 101')).toBeInTheDocument()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Página 3', exact: true }))
    expect(cambiar).toHaveBeenCalledExactlyOnceWith(3)
  })

  it('diferencia estados y datos ausentes sin alterar sus textos ni los ceros', () => {
    render(
      <DataTable
        label="Estados"
        data={[
          {
            id: 'A',
            nombre: 'Datos pendientes',
            activo: 'Activo',
            jabas: 0,
            fecha: null
          }
        ]}
        columns={[
          { key: 'nombre', header: 'Nombre' },
          { key: 'activo', header: 'Estado', status: true },
          { key: 'jabas', header: 'Jabas' },
          {
            key: 'fecha',
            header: 'Última actividad',
            render: () => <time>Sin actividad</time>,
            muted: (row) => !row.fecha
          }
        ]}
      />
    )
    expect(screen.getByRole('cell', { name: 'Datos pendientes' })).toHaveAttribute(
      'data-muted',
      'true'
    )
    expect(screen.getByRole('cell', { name: 'Sin actividad' })).toHaveAttribute(
      'data-muted',
      'true'
    )
    expect(screen.getByRole('cell', { name: '0' })).not.toHaveAttribute('data-muted')
    expect(screen.getByText('Activo')).toHaveClass(
      'status-badge',
      'has-indicator',
      'success'
    )
    expect(screen.getByRole('cell', { name: 'Activo' })).toHaveAttribute(
      'data-status',
      'true'
    )
  })
})
