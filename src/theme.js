// El tema claro queda desactivado temporalmente en el Portal.
const key = 'gesgrow.portal.theme.v1'
export function readTheme() {
  return 'dark'
}
export function applyTheme() {
  const theme = readTheme()
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(key, theme)
  } catch {
    /* La interfaz sigue funcionando si no se puede persistir. */
  }
}
