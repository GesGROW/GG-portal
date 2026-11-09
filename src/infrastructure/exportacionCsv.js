export const exportacionCsv = Object.freeze({
  guardar({ nombre, mime, contenido }) {
    const url = URL.createObjectURL(new Blob([contenido], { type: mime }))
    const a = document.createElement('a')
    a.href = url
    a.download = nombre
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
})
