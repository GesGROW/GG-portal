import assert from 'node:assert/strict'
import test from 'node:test'
import {
  configurarRollo,
  prepararEtiquetas,
  generarTspl,
  generarPdfEtiquetas,
  generarHtmlEtiquetas,
  segmentosBarras
} from '../src/infrastructure/etiquetasTickets.js'
import { documentoEtiquetas } from './support/etiquetasTickets.js'

test('cada lote empieza en una fila nueva y deja espacios blancos sin mezclar cosechadores', () => {
  const documento = prepararEtiquetas(documentoEtiquetas())
  assert.equal(documento.filas.length, 8)
  assert.deepEqual(
    documento.filas[3].map((t) => [t.numeroLote, t.numeroTicket]),
    [[1, 10]]
  )
  assert.deepEqual(
    documento.filas[4].map((t) => [t.numeroLote, t.numeroTicket]),
    [
      [2, 1],
      [2, 2],
      [2, 3]
    ]
  )
  assert.equal(documento.filas.at(-1).length, 1)
  assert.ok(
    documento.filas.every((fila) => new Set(fila.map((t) => t.codigoLote)).size === 1)
  )
  assert.deepEqual(
    documento.filas.flat().map((t) => t.codigo),
    documentoEtiquetas().filas.map((t) => t.codigo)
  )
  assert.deepEqual(
    documento.filas[0].map((t) => t.x),
    [24, 280, 536]
  )
  assert.equal(documento.filas[2][1].codigo, 'C01061308')
  assert.equal(documento.filas[2][1].derecha, '010613|08')
  assert.equal(documento.filas[2][1].izquierda, 'TI-MAN')
  const barras = segmentosBarras(documento.filas[0][0])
  // El código de nueve caracteres ocupa más de 22 mm, con espacio blanco
  // suficiente para leerlo; ya no queda reducido a unos 13 mm en el centro.
  assert.ok(barras.at(-1).x + barras.at(-1).ancho - barras[0].x > 176)
  assert.ok(barras[0].x - documento.filas[0][0].x < 32)
  assert.equal(documento.rollo.anchoMm, 100)
  assert.equal(documento.rollo.margenDerechoMm, 3)
  assert.equal(
    prepararEtiquetas(documentoEtiquetas([1], 'ARA')).filas[0][0].izquierda,
    'TI-ARA'
  )
})

test('el orden se conserva al pasar de ticket99 a100, sin clasificación de texto', () => {
  const d = prepararEtiquetas(documentoEtiquetas([103, 2]))
  const planos = d.filas.flat()
  assert.equal(planos[98].codigo, 'C01061399')
  assert.equal(planos[99].codigo, 'C010613100')
  assert.equal(planos[103].codigo, 'C01061401')
  for (const t of planos) {
    assert.ok(t.xBarras >= t.modulo * 10)
    assert.ok(
      t.xBarras + Math.round(t.barras.length * t.modulo) + Math.ceil(t.modulo * 10) <=
        240
    )
    for (const b of segmentosBarras(t)) {
      assert.ok(Number.isInteger(b.x) && Number.isInteger(b.ancho))
      assert.ok(b.x >= t.x && b.x + b.ancho <= t.x + 240)
    }
  }
})

test('bloques de 3 × 9 y lotes antiguos incompletos conservan cada ticket sin compartir filas', () => {
  for (const cantidades of [
    [27, 27],
    [1, 1],
    [2, 2],
    [3, 4, 1],
    [103, 2]
  ]) {
    const original = documentoEtiquetas(cantidades)
    const d = prepararEtiquetas(original)
    assert.equal(d.total, original.total)
    assert.equal(
      d.filas.length,
      cantidades.reduce((n, c) => n + Math.ceil(c / 3), 0)
    )
    assert.deepEqual(
      d.filas.flat().map((t) => t.codigo),
      original.filas.map((t) => t.codigo)
    )
    for (const fila of d.filas) {
      assert.ok(fila.length >= 1 && fila.length <= 3)
      assert.equal(new Set(fila.map((t) => t.codigoLote)).size, 1)
      assert.equal(fila[0].x, 24)
    }
    if (cantidades[0] === 27) {
      assert.ok(d.filas.every((f) => f.length === 3))
      assert.equal(d.filas[8][2].numeroTicket, 27)
      assert.equal(d.filas[9][0].numeroLote, 2)
    }
  }
})

test('rechaza códigos duplicados, identidad falsa, saltos y comandos inyectados', () => {
  for (const mutar of [
    (d) => {
      d.filas[0].codigo = 'C01061399'
    },
    (d) => {
      d.filas[1] = d.filas[0]
    },
    (d) => {
      d.filas.reverse()
    },
    (d) => {
      d.abreviaturaCultivo = 'MAN"\r\nKILL'
    },
    (d) => {
      d.filas[0].codigoLote = '1'
    },
    (d) => {
      d.total++
    }
  ]) {
    const datos = documentoEtiquetas()
    mutar(datos)
    assert.throws(() => prepararEtiquetas(datos))
  }
  for (const opciones of [
    { separacionColumnasMm: 10 },
    { separacionColumnasMm: 4, margenIzquierdoMm: 2.125 },
    { separacionFilasMm: -1 },
    { margenIzquierdoMm: Infinity },
    { separacionFilasMm: 0.1 }
  ])
    assert.throws(() => configurarRollo(opciones))
})

test('TSPL imprime una vez cada fila y mantiene exactamente las barras del PDF', async () => {
  const d = prepararEtiquetas(documentoEtiquetas(), {
    separacionColumnasMm: 1.5,
    separacionFilasMm: 3,
    margenIzquierdoMm: 1
  })
  const tspl = generarTspl(d)
  assert.ok(tspl.startsWith('SIZE 100 mm,20 mm\r\nGAP 3 mm,0 mm\r\n'))
  assert.equal(d.rollo.margenDerechoMm, 6)
  assert.equal(tspl.match(/^PRINT 1,1$/gm).length, 8)
  assert.equal(tspl.match(/^CLS$/gm).length, 8)
  assert.equal(tspl.match(/^TEXT /gm).length, 80)
  assert.ok(tspl.includes('"010613|10"'))
  assert.ok(tspl.includes('"010614|01"'))
  assert.equal(
    tspl.match(/^BAR /gm).length,
    d.filas.flat().reduce((n, t) => n + segmentosBarras(t).length, 0)
  )
  const pdf = await generarPdfEtiquetas(d)
  assert.equal(pdf.getNumberOfPages(), 8)
  assert.ok(Math.abs(pdf.internal.pageSize.getWidth() - 100) < 0.001)
  assert.ok(Math.abs(pdf.internal.pageSize.getHeight() - 20) < 0.001)
  assert.ok(pdf.output().startsWith('%PDF-'))
  assert.match(pdf.output(), /\/PrintScaling \/None/)
  assert.match(pdf.output(), /\/PickTrayByPDFSize true/)
})

test('impresión vectorial conserva todas las barras, textos y páginas físicas del PDF y TSPL', () => {
  const d = prepararEtiquetas(documentoEtiquetas([10, 10], 'ARA'))
  const html = generarHtmlEtiquetas(d)
  assert.ok(html.includes('@page{size:100mm 20mm;margin:0!important}'))
  assert.doesNotMatch(html, /<script|<embed|<iframe|<img/)
  const paginas = [...html.matchAll(/<svg [^>]*>(.*?)<\/svg>/g)]
  assert.equal(paginas.length, 8)
  assert.match(paginas[0][0], /width="100mm" height="20mm" viewBox="0 0 100 20"/)
  d.filas.forEach((fila, i) => {
    const barras = [
      ...paginas[i][1].matchAll(
        /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"\/>/g
      )
    ]
    assert.deepEqual(
      barras.map((b) => [
        Number(b[1]) * 8,
        Number(b[2]) * 8,
        Number(b[3]) * 8,
        Number(b[4]) * 8
      ]),
      fila.flatMap((t) => segmentosBarras(t).map((b) => [b.x, 20, b.ancho, 72]))
    )
    for (const t of fila) {
      assert.ok(paginas[i][1].includes(`>${t.derecha}</text>`))
      assert.ok(paginas[i][1].includes('>TI-ARA</text>'))
      assert.ok(paginas[i][1].includes(`>${d.fecha}</text>`))
    }
    assert.equal([...paginas[i][1].matchAll(/<text /g)].length, fila.length * 4)
  })
  assert.ok(paginas[3][1].includes('010613|10'))
  assert.ok(!paginas[3][1].includes('010614|01'))
  assert.ok(paginas[4][1].includes('010614|01'))
  assert.ok(html.includes('font-size="1.905"'))
})
