import { AccesoDenegado } from '@gesgrow/core/contexts/identity-access/index.js'

export function fakeAdministracion(ports) {
  const catalogos = {},
    usuarios = {},
    invitaciones = {}
  for (const tenant of ports.empresas) {
    catalogos[tenant] = {
      roles: [
        {
          id: tenant + '-supervisor',
          codigo: 'SUPERVISOR_COSECHA',
          permisos: [
            'harvest.view',
            'harvest.manage',
            'harvest.operate',
            'reports.view'
          ]
        },
        {
          id: tenant + '-admin',
          codigo: 'ADMIN_EMPRESA',
          permisos: ['company.manage']
        },
        {
          id: tenant + '-gestor',
          codigo: 'GESTOR',
          permisos: ['campaign.manage', 'workforce.manage']
        },
        {
          id: tenant + '-campo',
          codigo: 'OPERADOR_CAMPO',
          permisos: ['harvest.operate']
        },
        {
          id: tenant + '-consulta',
          codigo: 'CONSULTA',
          permisos: ['harvest.view', 'reports.view']
        }
      ],
      trabajadores: [
        {
          id: tenant + '-worker',
          dni: '12345678',
          nombre: 'Trabajador ' + tenant,
          activo: true
        }
      ]
    }
    usuarios[tenant] = [
      {
        usuarioId: 'persona-' + tenant,
        membresiaId: 'miembro-' + tenant,
        tenantId: tenant,
        nombre: 'Persona ' + tenant,
        email: 'persona-' + tenant + '@example.test',
        activo: true,
        cuentaActiva: true,
        trabajadorId: null,
        trabajador: null,
        roles: [tenant + '-consulta'],
        permisos: ['harvest.view', 'reports.view']
      }
    ]
    invitaciones[tenant] = []
  }
  const proteger = (tenant, tipo) => {
    ports.calls.push([tipo, tenant])
    if (!ports.permisos[tenant]?.includes('company.manage'))
      throw new AccesoDenegado('Permiso requerido.')
  }
  ports.administracion = {
    async accesosCosecha(t) {
      proteger(t, 'accesosCosecha')
      const miembros = usuarios[t].filter((u) =>
        u.roles.some((id) =>
          catalogos[t].roles.some(
            (r) =>
              r.id === id &&
              r.codigo !== 'ADMIN_EMPRESA' &&
              r.permisos.some((p) => p.startsWith('harvest.') || p === 'reports.view')
          )
        )
      )
      return structuredClone({
        modulo: 'HARVEST',
        habilitado: ports.modulos[t]?.includes('HARVEST') ?? false,
        rolSupervisorId: t + '-supervisor',
        usuarios: miembros.map((u) => {
          const invitacion = invitaciones[t].findLast(
            (i) => i.resultado?.usuarioId === u.usuarioId
          )
          return {
            id: u.membresiaId,
            usuarioId: u.usuarioId,
            nombre: u.nombre,
            email: u.email,
            rol: catalogos[t].roles.find(
              (r) => u.roles.includes(r.id) && r.codigo !== 'ADMIN_EMPRESA'
            )?.codigo,
            estado:
              !u.activo || u.cuentaActiva === false
                ? 'INACTIVO'
                : invitacion && !invitacion.aceptadaEn
                  ? 'PENDIENTE'
                  : 'ACEPTADA'
          }
        })
      })
    },
    async listarUsuarios(t, busqueda, offset) {
      proteger(t, 'listar')
      const lista = usuarios[t].filter((u) =>
        (u.nombre + ' ' + u.email).includes(busqueda)
      )
      return structuredClone({
        usuarios: lista.slice(offset, offset + 50),
        total: lista.length
      })
    },
    async obtenerUsuario(t, id) {
      proteger(t, 'detalle')
      const u = usuarios[t].find((u) => u.usuarioId === id)
      if (!u) throw new AccesoDenegado('Usuario ajeno.')
      return structuredClone(u)
    },
    async catalogoAccesos(t) {
      proteger(t, 'catalogo')
      return structuredClone(catalogos[t])
    },
    async guardarMembresia(t, datos) {
      proteger(t, 'guardarMembresia')
      ports.calls.push(['membresia', t, datos])
      const u = usuarios[t].find((u) => u.usuarioId === datos.usuarioId)
      if (
        !u ||
        datos.roles.some((id) => !catalogos[t].roles.some((r) => r.id === id)) ||
        (datos.trabajadorId &&
          !catalogos[t].trabajadores.some((w) => w.id === datos.trabajadorId))
      )
        throw new AccesoDenegado('Relación ajena.')
      Object.assign(u, datos, {
        trabajador:
          catalogos[t].trabajadores.find((w) => w.id === datos.trabajadorId) ?? null,
        permisos: datos.activo
          ? [
              ...new Set(
                catalogos[t].roles
                  .filter((r) => datos.roles.includes(r.id))
                  .flatMap((r) => r.permisos)
              )
            ].sort()
          : []
      })
      return structuredClone(u)
    },
    async invitarUsuario(t, datos) {
      proteger(t, 'invitar')
      ports.calls.push(['invitacion', t, datos])
      const previa = invitaciones[t].find((i) => i.id === datos.operacionId)
      if (previa) return previa.resultado
      const usuarioId = 'invitado-' + t,
        membresiaId = 'nuevo-miembro-' + t
      usuarios[t].push({
        ...usuarios[t][0],
        ...datos,
        usuarioId,
        membresiaId,
        trabajador: null,
        activo: true,
        permisos: []
      })
      const resultado = { tenantId: t, usuarioId, membresiaId }
      invitaciones[t].push({
        ...datos,
        id: datos.operacionId,
        estado: 'COMPLETADA',
        resultado
      })
      return resultado
    }
  }
  return { usuarios, catalogos, invitaciones }
}
