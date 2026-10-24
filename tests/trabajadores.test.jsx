import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'
import { fakeTrabajadores } from './support/fakeTrabajadores.js'

function mount(options = {}, path = '/cosecha/trabajadores') {
  const ports = fakePorts({ autenticado: true, ...options })
  fakeHarvestAdmin(ports)
  const datos = fakeTrabajadores(ports)
  render(
    <MemoryRouter initialEntries={[path]}>
      <Portal portal={crearPortal(ports)} />
    </MemoryRouter>
  )
  return { ports, ...datos }
}
const tabla = () => screen.findByRole('table', { name: 'Trabajadores de Cosecha' })
describe('Cosecha: trabajadores', () => {
  it('publica pestaña, listado e indicadores sin conceder acceso a usuarios', async () => {
    mount({ permisos: { A: ['workforce.manage'] } })
    const t = await tabla()
    expect(
      within(t)
        .getAllByRole('columnheader')
        .map((n) => n.textContent)
    ).toEqual(['DNI', 'Nombre', 'Función', 'Campaña', 'Estado', 'Última actividad'])
    expect(within(t).getByText('74851236')).toBeInTheDocument()
    expect(screen.queryByText(/trabajadores en la selección/)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('combobox', { name: 'Datos', exact: true })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Volver a Cosecha', exact: true })
    ).toHaveAttribute('href', '/cosecha')
    expect(
      screen.queryByRole('link', { name: 'Registros', exact: true })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Usuarios y accesos' })
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('Resumen de la selección')).toHaveTextContent(
      'Trabajadores activos3Cosechadores2Datos pendientes1'
    )
  })
  it('combina filtros y completa un DNI provisional conservando su identidad', async () => {
    const { trabajadores, ports } = mount()
    const user = userEvent.setup()
    await tabla()
    await user.click(screen.getByRole('button', { name: /Datos pendientes1/ }))
    await waitFor(() => expect(screen.queryByText('74851236')).not.toBeInTheDocument())
    await user.selectOptions(
      screen.getByLabelText('Campaña', { exact: true }),
      'A-camp'
    )
    await user.selectOptions(
      screen.getByLabelText('Función', { exact: true }),
      'COSECHADOR'
    )
    await user.click(
      await screen.findByRole('row', { name: /Abrir trabajador Datos pendientes/ })
    )
    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText('Nombres'), 'José')
    await user.type(dialog.getByLabelText('Apellidos'), 'Pérez')
    await user.click(dialog.getByRole('button', { name: 'Guardar datos' }))
    await dialog.findByText('Datos guardados. Puedes administrar sus campañas.')
    expect(trabajadores.find((t) => t.id === 'W3')).toMatchObject({
      dni: '71234567',
      nombres: 'José',
      apellidos: 'Pérez'
    })
    expect(
      ports.calls.some(
        (c) => c[0] === 'editarTrabajador' && c[1] === 'A' && c[2] === 'W3'
      )
    ).toBe(true)
    await user.click(dialog.getByRole('button', { name: 'Cerrar trabajador' }))
    await user.click(
      screen.getByRole('button', { name: /Datos pendientes/, pressed: true })
    )
    await user.selectOptions(screen.getByLabelText('Campaña', { exact: true }), '')
    await user.selectOptions(screen.getByLabelText('Función', { exact: true }), '')
    await user.type(screen.getByLabelText('Buscar por nombre o DNI'), 'JOSE')
    await waitFor(() =>
      expect(screen.getByText('Mostrando 1-1 de 1')).toBeInTheDocument()
    )
    expect(await screen.findByText('José Pérez')).toBeInTheDocument()
  })
  it('registra, asigna función por campaña y habilita al jabero por jornada', async () => {
    const { ports } = mount()
    const user = userEvent.setup()
    await tabla()
    await user.click(screen.getByRole('button', { name: 'Registrar trabajador' }))
    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText('DNI', { exact: true }), '70000001')
    await user.type(dialog.getByLabelText('Nombres'), 'Luis')
    await user.type(dialog.getByLabelText('Apellidos'), 'Flores')
    await user.click(dialog.getByRole('button', { name: 'Guardar datos' }))
    await dialog.findByText('Datos guardados. Puedes administrar sus campañas.')
    await user.selectOptions(
      dialog.getByLabelText('Campaña de participación'),
      'A-camp'
    )
    await user.selectOptions(
      dialog.getByLabelText('Función en la campaña'),
      'SUPERVISORA'
    )
    await user.click(dialog.getByRole('button', { name: 'Asignar a campaña' }))
    await dialog.findByText('Supervisor · Asignado')
    expect(
      ports.calls.some((c) => c[0] === 'asignarFuncion' && c[4] === 'SUPERVISORA')
    ).toBe(true)
    await user.selectOptions(dialog.getByLabelText('Función en la campaña'), 'JABERO')
    await user.click(dialog.getByRole('button', { name: 'Habilitar jabero hoy' }))
    await dialog.findByText(/Jabero · Asignado · Jornada/)
    expect(ports.calls.some((c) => c[0] === 'habilitarJaberoHoy')).toBe(true)
    await user.click(dialog.getByRole('button', { name: 'Desactivar trabajador' }))
    await dialog.findByText('Trabajador desactivado. El historial se conserva.')
    expect(dialog.getByRole('button', { name: 'Habilitar jabero hoy' })).toBeDisabled()
  })
  it.each([
    { permisos: { A: ['harvest.view'] } },
    {
      permisos: { A: ['harvest.view', 'workforce.manage'] },
      modulos: { A: ['HARVEST'] }
    }
  ])('rechaza acceso sin permiso o sin módulo Personal: %o', async (opciones) => {
    const { ports } = mount(opciones)
    await screen.findByRole('heading', { name: 'Acceso restringido' })
    expect(ports.calls.some((c) => c[0] === 'listarTrabajadores')).toBe(false)
  })
  it('entra desde Cosecha con permiso de personal sin consultar registros', async () => {
    const { ports } = mount({ permisos: { A: ['workforce.manage'] } }, '/cosecha')
    await tabla()
    expect(ports.calls.some((c) => c[0] === 'campaniasHarvest')).toBe(false)
  })
  it('vuelve desde Personal a la entrada actual de Cosecha sin abrir Registros', async () => {
    mount({}, '/cosecha/trabajadores?campania=A-camp')
    await tabla()
    await userEvent
      .setup()
      .click(screen.getByRole('link', { name: 'Volver a Cosecha' }))
    await screen.findByRole('heading', { name: 'Lotes de tickets generados' })
    expect(
      screen.queryByRole('table', { name: 'Registros de cosecha' })
    ).not.toBeInTheDocument()
  })
  it('muestra errores de guardado sin cerrar el formulario ni perder los datos', async () => {
    mount()
    const user = userEvent.setup()
    await tabla()
    await user.click(screen.getByRole('button', { name: 'Registrar trabajador' }))
    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText('DNI', { exact: true }), '74851236')
    await user.type(dialog.getByLabelText('Nombres'), 'Ana')
    await user.type(dialog.getByLabelText('Apellidos'), 'Campos')
    await user.click(dialog.getByRole('button', { name: 'Guardar datos' }))
    expect(await dialog.findByRole('alert')).toHaveTextContent('DNI duplicado.')
    expect(dialog.getByLabelText('Nombres')).toHaveValue('Ana')
    expect(dialog.getByRole('button', { name: 'Guardar datos' })).toBeEnabled()
  })
  it('pagina sin perder filtros y restaura el foco al cerrar el panel', async () => {
    const { trabajadores } = mount()
    for (let i = 0; i < 55; i++)
      trabajadores.push({
        id: 'X' + i,
        dni: String(80000000 + i),
        nombres: 'Persona',
        apellidos: String(i),
        activo: true,
        participaciones: []
      })
    await tabla()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Página 2', exact: true }))
    await screen.findByText('Mostrando 51-59 de 59')
    expect(
      screen.getByRole('button', { name: 'Página 2', exact: true })
    ).toHaveAttribute('aria-current', 'page')
    const abrir = screen.getAllByRole('row', { name: /Abrir trabajador/ })[0]
    await user.click(abrir)
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cerrar trabajador'
      })
    )
    expect(abrir).toHaveFocus()
  })
  it('abre los detalles desde cualquier celda y permite activar la fila con el teclado', async () => {
    mount()
    const user = userEvent.setup()
    const t = await tabla()
    const fila = within(t).getByRole('row', {
      name: /Abrir trabajador Ana Campos Ruiz/
    })
    expect(within(fila).queryByRole('button')).not.toBeInTheDocument()
    for (const celda of within(fila).getAllByRole('cell')) {
      await user.click(celda)
      const dialog = within(screen.getByRole('dialog'))
      expect(dialog.getByLabelText('DNI', { exact: true })).toHaveValue('74851236')
      await user.click(dialog.getByRole('button', { name: 'Cerrar trabajador' }))
      expect(fila).toHaveFocus()
    }
    for (const tecla of ['{Enter}', ' ']) {
      await user.keyboard(tecla)
      const dialog = within(screen.getByRole('dialog'))
      expect(dialog.getByLabelText('Nombres')).toHaveValue('Ana')
      await user.click(dialog.getByRole('button', { name: 'Cerrar trabajador' }))
      expect(fila).toHaveFocus()
    }
  })
})
