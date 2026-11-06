import { Link, useSearchParams } from 'react-router'
import { useEffect, useState } from 'react'
import { Carga, useCarga } from './GestionUi.jsx'
import { CosechaSelector } from './CosechaSelector.jsx'
import { CultivosCosecha } from './CultivosCosecha.jsx'
import { ConfiguracionCampania } from './ConfiguracionCampania.jsx'
import { BonoConfiguracion } from './BonoConfiguracion.jsx'
import { CampaniaIcon } from './CampaniaIcon.jsx'
import './campania-cosecha.css'
import './configurar-campania-actual.css'

export function ConfigurarCampaniaActual({ servicio, cultivos, pendiente, onCreada }) {
  const [params] = useSearchParams()
  const [mensaje, setMensaje] = useState('')
  const catalogo = useCarga(() => servicio.campanias(), [servicio])
  const campanias = catalogo.datos ?? []
  const campaniaId = campanias.find(c => c.id === params.get('campania'))?.id || (campanias.find(c => c.estado === 'ACTIVA') ?? campanias[0])?.id || ''
  const configuracion = params.get('vista') === 'configuracion'
  const bono = params.get('opcion') === 'bono'
  useEffect(() => { setMensaje('') }, [campaniaId, configuracion, bono])
  const destino = (vista, opcion) => {
    const q = new URLSearchParams(params)
    q.set('vista', vista)
    if (campaniaId) q.set('campania', campaniaId)
    if (opcion) q.set('opcion', opcion); else q.delete('opcion')
    return '/cosecha/configurar?' + q.toString()
  }
  return <div className="crop-setup-page">
    <CosechaSelector campanias={campanias} seleccion={campaniaId} configurando
      pendiente={pendiente || catalogo.cargando || Boolean(catalogo.error)} />
    <div className="campaign-container campaign-configuration-workspace">
      <nav className="campaign-main-tabs" aria-label="Opciones de configurar campaña">
        <Link to={destino('agregar')} aria-label="Agregar" title="Agregar" aria-current={!configuracion ? 'page' : undefined}>
          <CampaniaIcon name="plus" size={35} /><span>Agregar</span>
        </Link>
        <Link to={destino('configuracion', 'campania')} aria-label="Configuración" title="Configuración" aria-current={configuracion ? 'page' : undefined}>
          <CampaniaIcon name="settings" size={35} /><span>Configuración</span>
        </Link>
      </nav>
      {configuracion ? <>
        <nav className="campaign-sub-tabs" aria-label="Secciones de configuración">
          <Link to={destino('configuracion', 'campania')} aria-label="Configuración general de la campaña" title="Configuración general de la campaña" aria-current={!bono ? 'page' : undefined}>
            <CampaniaIcon name="campania" /><span>Configuración general de la campaña</span>
          </Link>
          <Link to={destino('configuracion', 'bono')} aria-label="Bono" title="Bono" aria-current={bono ? 'page' : undefined}>
            <CampaniaIcon name="bono" /><span>Bono</span>
          </Link>
        </nav>
        <section className="campaign-body" aria-label={bono ? 'Configuración del bono' : 'Configuración general de la campaña'}>
          {mensaje && <p role="status">{mensaje}</p>}
          <Carga consulta={pendiente ? { cargando: true } : catalogo} skeleton="form">
            {() => {
              const campania = campanias.find(c => c.id === campaniaId)
              if (!campania) return <p role="status">No hay una campaña disponible. Agrega una campaña para configurarla.</p>
              return bono
                ? <BonoConfiguracion key={campania.id} servicio={cultivos} campania={campania} />
                : <ConfiguracionCampania key={campania.id} servicio={cultivos} campania={campania}
                  onGuardado={() => { setMensaje('Configuración guardada.'); catalogo.refrescar() }} />
            }}
          </Carga>
        </section>
      </> : <>
        {catalogo.error && <p role="alert">{catalogo.error.message}<button onClick={catalogo.refrescar}>Reintentar campañas</button></p>}
        <CultivosCosecha servicio={cultivos} pendiente={pendiente} onCreada={onCreada} />
      </>}
    </div>
  </div>
}
