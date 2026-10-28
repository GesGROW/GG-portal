import { REPORTES_HABILITADOS } from './reportesDisponibles.js'

export const reportePublicado = (path) =>
  REPORTES_HABILITADOS || /^\/reportes\/(diaria|ranking)(?:\?|$)/.test(path)
