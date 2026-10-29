import { useEffect, useState } from 'react'
import { Skeleton } from './Ui.jsx'
import { ContentReady } from './ContentReady.jsx'

export function useCarga(cargar, claves) {
  const [revision, setRevision] = useState(0),
    [estado, setEstado] = useState({ cargando: true })
  useEffect(() => {
    let vigente = true
    setEstado({ cargando: true })
    Promise.resolve()
      .then(cargar)
      .then(
        (datos) => {
          if (vigente) setEstado({ datos })
        },
        (error) => {
          if (vigente && error.name !== 'SolicitudObsoleta') setEstado({ error })
        }
      )
    return () => {
      vigente = false
    }
  }, [...claves, revision])
  return { ...estado, revision, refrescar: () => setRevision((r) => r + 1) }
}
export function Aviso({ error, mensaje }) {
  return error || mensaje ? (
    <p className="notice" role={error ? 'alert' : 'status'}>
      {error?.message ?? mensaje}
    </p>
  ) : null
}
export function Carga({ consulta, children, skeleton = 'table' }) {
  if (consulta.cargando)
    return typeof skeleton === 'string' ? <Skeleton variant={skeleton} /> : skeleton
  if (consulta.error)
    return (
      <>
        <Aviso error={consulta.error} />
        <button onClick={consulta.refrescar}>Reintentar</button>
      </>
    )
  return <ContentReady>{children(consulta.datos)}</ContentReady>
}
export function useMutacion() {
  const [estado, setEstado] = useState({ ocupado: false, error: null })
  const ejecutar = async (accion) => {
    setEstado({ ocupado: true, error: null })
    try {
      await accion()
      setEstado({ ocupado: false, error: null })
      return true
    } catch (error) {
      if (error.name !== 'SolicitudObsoleta') setEstado({ ocupado: false, error })
      return false
    }
  }
  return { ...estado, ejecutar }
}
