// Fixture exclusiva de desarrollo/pruebas, fuera de la entrada de producción.
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router'
import { Portal } from '../src/presentation/Portal.jsx'
import { crearPortal } from '../src/application/crearPortal.js'
import { fakePorts } from './support/fakePorts.js'
import { fakeAdministracion } from './support/fakeAdministracion.js'
import { fakeHarvestAdmin } from './support/fakeHarvestAdmin.js'
import { fakeReportes } from './support/fakeReportes.js'
import { fakeComercial } from './support/fakeComercial.js'
import { fakeTrabajadores } from './support/fakeTrabajadores.js'
import { fakeCultivosCosecha } from './support/fakeCultivosCosecha.js'
import { impresionTickets } from '../src/infrastructure/impresionTickets.js'
import { fakePda } from './support/fakePda.js'
import '@fontsource-variable/inter'
import '../src/presentation/styles.css'
const params = new URLSearchParams(location.search)
const puertos = fakePorts({
  empresas: params.has('alta-empresa') ? [] : params.has('single') ? ['A'] : ['A', 'B'],
  autenticado: !params.has('login') && !params.has('registro')
})
if (params.has('session-pending'))
  puertos.identity.obtenerSesion = () => new Promise(() => {})
puertos.identity.registrarCuenta = async () => ({ confirmarCorreo: true })
if (params.has('activacion')) {
  let pendiente = true
  puertos.identity.tieneInvitacion = () => pendiente
  puertos.identity.prepararInvitacion = async () => {
    if (params.has('enlace-invalido'))
      throw new Error(
        'El enlace de invitación ha caducado o no es válido. Solicita una nueva invitación.'
      )
    const requiereActivacion = !params.has('cuenta-existente')
    if (!requiereActivacion) pendiente = false
    return {
      tenantId: 'A',
      empresa: 'Empresa Agrícola Fundo Quijas',
      roles: ['Supervisor'],
      modulos: ['HARVEST'],
      requiereActivacion
    }
  }
  puertos.identity.completarInvitacion = async () => {
    pendiente = false
  }
}
const administracion = fakeAdministracion(puertos)
const harvest = fakeHarvestAdmin(puertos)
if (params.has('empty-campaign-tables')) {
  harvest.lotes.A = []
  harvest.asignaciones.A = []
  harvest.trabajadoresCampania.A = []
}
if (params.has('campaign-workers')) {
  for (const [rol, nombres] of [
    ['COSECHADOR', ['Ana Rojas', 'Gianella Sotil']],
    ['JABERO', ['Florinda Mesa', 'Renata Carbajal']],
    ['SUPERVISORA', ['Rosa Pinto', 'Deysi Regalado']]
  ])
    harvest.trabajadoresCampania.A.push(
      ...nombres.map((nombre, i) => ({
        id: `${rol}-${i}`,
        campaniaId: 'A-camp',
        rol,
        nombre,
        dni: i ? '16017278' : '76338971',
        activo: Boolean(i),
        iniciadoEn: i ? '2026-10-20T14:29:00Z' : '2026-10-20T19:03:00Z'
      }))
    )
}
fakeReportes(puertos, { vacio: params.has('empty-home') })
const comercial = fakeComercial(puertos)
fakeTrabajadores(puertos)
puertos.permisos.A.push('harvest.manage')
if (params.has('harvest-only')) puertos.modulos.A = ['HARVEST']
if (params.has('ticket-lists')) {
  const base = harvest.lotes.A[0]
  harvest.lotes.A = [
    { ...base, id: 'LT-DEF456', creadoEn: '2026-10-21T05:35:00Z' },
    { ...base, id: 'LT-ABC123', creadoEn: '2026-10-21T05:29:00Z' }
  ]
  harvest.asignaciones.A = harvest.lotes.A.map((l, i) => ({
    ...l,
    trabajador: { id: 'worker-A', nombre: 'Gianella Sotil' },
    asignadoEn: i ? '2026-10-22T14:29:00Z' : '2026-10-22T19:03:00Z'
  }))
}
if (params.has('crop-setup') || params.has('campaign')) {
  puertos.permisos.A = ['harvest.view', 'harvest.manage', 'reports.view']
  puertos.modulos.A = ['HARVEST']
  const cultivos = fakeCultivosCosecha(puertos, {
    propio: params.has('own-crop') || params.has('campaign')
  })
  puertos.impresionTickets = impresionTickets
  if (params.has('join-request'))
    cultivos.solicitudes.push({
      id: 'request-1',
      cultivoId: 'crop-blue',
      cultivoNombre: 'Arándanos',
      nombre: 'Supervisor compañero',
      email: 'supervisor@example.test',
      estado: 'PENDIENTE'
    })
}
if (params.has('owner-empty')) puertos.modulos.A = []
if (params.has('pda')) {
  puertos.permisos.A = [
    'company.manage',
    'harvest.view',
    'harvest.manage',
    'reports.view'
  ]
  fakePda(puertos, { vacio: params.has('empty-devices') })
  puertos.acceso.obtenerIdentidad = async () => ({
    usuario: { id: 'U', nombre: 'Administrador', email: 'admin@example.test' },
    membresias: [{ id: 'M-A', tenantId: 'A', usuarioId: 'U', activo: true }],
    empresas: [{ id: 'A', nombre: 'Quijas SAC' }]
  })
  const resolver = puertos.acceso.resolverContexto
  puertos.acceso.resolverContexto = async (id) => ({
    ...(await resolver(id)),
    empresa: 'Quijas SAC'
  })
}
if (params.has('supervisor-home')) {
  puertos.permisos.A = [
    'harvest.view',
    'harvest.manage',
    'harvest.operate',
    'reports.view'
  ]
  puertos.modulos.A = ['HARVEST']
  if (params.has('no-campaigns')) puertos.reportesHarvest.campanias = async () => []
}
if (params.has('owner-users')) {
  puertos.permisos.A = ['company.manage', 'reports.view']
  puertos.modulos.A = ['HARVEST']
  administracion.usuarios.A = []
  if (params.has('accepted') || params.has('pending')) {
    administracion.usuarios.A.push({
      usuarioId: 'invitado-A',
      membresiaId: 'nuevo-miembro-A',
      nombre: 'Deysi Regalado',
      email: 'deysi.regalado09@gmail.com',
      activo: true,
      cuentaActiva: true,
      roles: ['A-supervisor'],
      permisos: ['harvest.view']
    })
    administracion.invitaciones.A.push({
      resultado: { usuarioId: 'invitado-A' },
      aceptadaEn: params.has('accepted') ? '2026-10-21T00:00:00Z' : null
    })
  }
}
if (params.has('owner-modules')) {
  puertos.permisos.A = ['company.manage', 'reports.view']
  puertos.modulos.A = params.has('acquired') ? ['HARVEST'] : []
  comercial.datos.A.modulosPlan = params.has('acquired') ? ['HARVEST'] : []
  comercial.datos.A.modulosEfectivos = params.has('acquired') ? ['HARVEST'] : []
  comercial.datos.A.estado.modulos = []
}
createRoot(document.getElementById('root')).render(
  <MemoryRouter
    initialEntries={[
      params.get('ruta') ??
        (params.has('campaign')
          ? '/cosecha/generar?campania=A-camp'
          : params.has('crop-setup')
            ? '/cosecha/configurar'
            : params.has('activacion')
              ? '/aceptar-invitacion'
              : params.has('registro')
                ? '/registro'
                : params.has('settings')
                  ? '/configuracion/usuarios'
                  : '/')
    ]}
  >
    <Portal portal={crearPortal(puertos)} />
  </MemoryRouter>
)
