import { unzipSync, strFromU8 } from 'fflate'

export async function leerPadron(archivo) {
  if (archivo.size > 5 * 1024 * 1024) throw new Error('El padrón debe pesar como máximo 5 MB.')
  let total = 0
  const files = unzipSync(new Uint8Array(await archivo.arrayBuffer()), {
    filter: f => {
      if (f.name !== 'xl/sharedStrings.xml' && !/^xl\/worksheets\/sheet\d+\.xml$/.test(f.name)) return false
      total += f.originalSize
      if (f.originalSize > 10 * 1024 * 1024 || total > 20 * 1024 * 1024)
        throw new Error('El padrón descomprimido supera el tamaño permitido.')
      return true
    }
  })
  const parse = nombre => {
    if (!files[nombre]) throw new Error('El archivo no contiene un padrón Excel válido.')
    const doc = new DOMParser().parseFromString(strFromU8(files[nombre]), 'application/xml')
    if (doc.querySelector('parsererror')) throw new Error('No se pudo leer el padrón Excel.')
    return doc
  }
  const texto = el => Array.from(el.getElementsByTagName('t')).map(t => t.textContent).join('')
  const shared = files['xl/sharedStrings.xml'] ? Array.from(parse('xl/sharedStrings.xml').getElementsByTagName('si')).map(texto) : []
  const normal = v => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()
  for (const name of Object.keys(files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))) {
    const rows = Array.from(parse(name).getElementsByTagName('row')).map(row =>
      Object.fromEntries(Array.from(row.getElementsByTagName('c')).map(c => {
        const value = c.getElementsByTagName('v')[0]?.textContent ?? ''
        return [c.getAttribute('r').replace(/\d/g, ''), c.getAttribute('t') === 's' ? shared[Number(value)] : c.getAttribute('t') === 'inlineStr' ? texto(c) : value]
      })))
    const idx = rows.findIndex(r => Object.values(r).some(v => normal(v) === 'CODIGO') && Object.values(r).some(v => normal(v) === 'DNI'))
    if (idx < 0) continue
    const headers = rows[idx], codigo = Object.keys(headers).find(k => normal(headers[k]) === 'CODIGO'),
      dni = Object.keys(headers).find(k => normal(headers[k]) === 'DNI'), result = new Map(), usados = new Set()
    for (const r of rows.slice(idx + 1)) {
      const c = (r[codigo] ?? '').trim(), d = (r[dni] ?? '').trim()
      if (!c && !d) continue
      if (!c || c.length > 40 || !/^\d{8}$/.test(d)) throw new Error('El padrón contiene códigos o DNI incompletos. Revisa el archivo.')
      if (result.has(d) || usados.has(c)) throw new Error('El padrón contiene códigos o DNI duplicados.')
      usados.add(c); result.set(d, c)
    }
    return result
  }
  throw new Error('No se encontraron las columnas CODIGO y DNI en el padrón.')
}
