import { createClient } from '@supabase/supabase-js'
import { crearPuertosSupabase } from './adapters.js'
import { crearInvitacionAdapter } from './invitacionAdapter.js'

export function crearConexion({ url, publicKey }) {
  if (!url || !publicKey || url === 'https://example.supabase.co')
    throw new Error('Configure la conexión del Portal en su archivo .env.local.')
  const cliente = createClient(url, publicKey, {
    auth: {
      storageKey: 'gesgrow.portal.auth.v1',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  })
  const puertos = crearPuertosSupabase(cliente)
  const invitacion = crearInvitacionAdapter(cliente, window.location.href, (path) =>
    window.history.replaceState({}, '', path)
  )
  return Object.freeze({
    ...puertos,
    identity: Object.freeze({ ...puertos.identity, ...invitacion })
  })
}
