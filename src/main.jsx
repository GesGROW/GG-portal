import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { iniciarPortal } from './bootstrap.js'
import { Portal, ErrorConfiguracion } from './presentation/Portal.jsx'
import '@fontsource-variable/inter'
import './presentation/styles.css'
import { applyTheme } from './theme.js'
applyTheme()

const root = createRoot(document.getElementById('root'))
root.render(<p role="status">Preparando Portal GesGROW…</p>)
async function arrancar() {
  try {
    const portal = await iniciarPortal()
    root.render(
      <BrowserRouter>
        <Portal portal={portal} />
      </BrowserRouter>
    )
  } catch (error) {
    root.render(<ErrorConfiguracion mensaje={error.message} />)
  }
}
void arrancar()
