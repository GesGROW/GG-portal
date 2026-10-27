export function fakePda(ports, { vacio = false } = {}) {
  const dispositivos = {
    A: vacio
      ? []
      : [
          {
            id: 'pda-A-1',
            tenantId: 'A',
            nombre: 'PDA Campo Norte',
            estado: 'ACTIVO',
            vinculadoEn: '2026-10-25T13:00:00Z',
            ultimoAccesoEn: '2026-10-27T15:00:00Z'
          },
          {
            id: 'pda-A-2',
            tenantId: 'A',
            nombre: 'PDA Almacén',
            estado: 'REVOCADO',
            vinculadoEn: '2026-10-25T13:00:00Z',
            ultimoAccesoEn: null,
            revocadoEn: '2026-10-26T15:00:00Z'
          }
        ],
    B: []
  }
  const vinculaciones = { A: null, B: null }
  let contador = 0
  ports.pda = {
    async listar(tenantId) {
      ports.calls.push(['pdaListar', tenantId])
      return structuredClone({
        tenantId,
        vinculacion: vinculaciones[tenantId],
        dispositivos: dispositivos[tenantId] ?? []
      })
    },
    async generar(tenantId) {
      ports.calls.push(['pdaGenerar', tenantId])
      const r = {
        tenantId,
        id: `qr-${++contador}`,
        token: contador.toString(16).padStart(64, '0'),
        venceEn: new Date(Date.now() + 86400000).toISOString()
      }
      vinculaciones[tenantId] = { id: r.id, venceEn: r.venceEn, estado: 'ACTIVA' }
      return r
    },
    async revocar(tenantId, id) {
      ports.calls.push(['pdaRevocar', tenantId, id])
      const d = dispositivos[tenantId].find((item) => item.id === id)
      d.estado = 'REVOCADO'
      d.revocadoEn = new Date().toISOString()
      return structuredClone(d)
    }
  }
  return { dispositivos, vinculaciones }
}
