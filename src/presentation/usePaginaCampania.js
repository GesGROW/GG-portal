import { useEffect, useState } from 'react'
import { useCarga } from './GestionUi.jsx'

const TAMANIO_PAGINA = 10
const TAMANIO_CONSULTA = 50

// Reuse each API page for five visible pages, without downloading the full list.
export function usePaginaCampania(cargar, claves) {
  const [offset, setOffset] = useState(0)
  const inicio = Math.floor(offset / TAMANIO_CONSULTA) * TAMANIO_CONSULTA
  const resultado = useCarga(async () => {
    const datos = await cargar(inicio)
    if (
      !Array.isArray(datos?.filas) ||
      !Number.isSafeInteger(datos.total) ||
      datos.total < 0 ||
      datos.filas.length > TAMANIO_CONSULTA ||
      datos.filas.length !==
        Math.min(TAMANIO_CONSULTA, Math.max(0, datos.total - inicio))
    )
      throw new Error('No se pudo obtener el listado completo. Reintenta la consulta.')
    return { ...datos, inicio }
  }, [...claves, inicio])
  const datos = resultado.datos?.inicio === inicio ? resultado.datos : null
  const fueraDeRango = Boolean(datos && offset > 0 && offset >= datos.total)
  useEffect(() => {
    if (fueraDeRango)
      setOffset(
        Math.max(0, Math.ceil(datos.total / TAMANIO_PAGINA) - 1) * TAMANIO_PAGINA
      )
  }, [fueraDeRango, datos?.total])
  const consulta =
    fueraDeRango || (resultado.datos && !datos)
      ? { ...resultado, cargando: true, datos: undefined }
      : resultado
  return {
    consulta,
    filas: datos?.filas.slice(offset - inicio, offset - inicio + TAMANIO_PAGINA) ?? [],
    paginacion: {
      total: datos?.total ?? 0,
      offset,
      pageSize: TAMANIO_PAGINA,
      onPageChange: (pagina) => setOffset((pagina - 1) * TAMANIO_PAGINA)
    },
    reiniciar: () => setOffset(0),
    refrescar: () => {
      setOffset(0)
      resultado.refrescar()
    }
  }
}
