const rememberedEmailKey = 'gesgrow.portal.remembered-email.v1'

export function rememberedEmail() {
  try {
    return localStorage.getItem(rememberedEmailKey) ?? ''
  } catch {
    return ''
  }
}

export function rememberEmail(email, guardar) {
  try {
    if (guardar) localStorage.setItem(rememberedEmailKey, email.trim())
    else localStorage.removeItem(rememberedEmailKey)
  } catch {
    // Recordar el correo es opcional cuando el almacenamiento está bloqueado.
  }
}
