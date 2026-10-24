import { crearPortal } from './application/crearPortal.js'

// Única composición del container Portal. Reemplazar aquí por HTTP no cambia UI.
export async function iniciarPortal(env = import.meta.env) {
  const { crearConexion } = await import('./infrastructure/supabase/crearConexion.js')
  return crearPortal(
    crearConexion({
      url: env.VITE_SUPABASE_URL,
      publicKey: env.VITE_SUPABASE_PUBLISHABLE_KEY
    })
  )
}
