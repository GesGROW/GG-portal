# Rendimiento por cosechador

El reporte conserva los filtros de campaña, lote, variedad y período. Por defecto
abarca la campaña hasta hoy en America/Lima. Los registros históricos siguen
incluidos aunque un trabajador haya quedado inactivo.

El ranking muestra la posición por producción total, nombre y DNI, total de jabas,
días con registros y promedio de jabas por día con registros. Se puede ordenar de
mayor a menor producción o al revés; la posición mantiene su significado original.
La paginación se resuelve con los datos ya recibidos.

La evolución permite comparar los primeros 5 o 10 del orden seleccionado, o elegir
hasta 10 personas por nombre o DNI. Los botones de la leyenda ocultan y muestran
líneas. El selector de día permite consultar valores también con teclado y en móvil.
La selección manual presenta directamente el buscador y las casillas. El detalle
del día se ordena de mayor a menor producción, con «Sin registro» al final. Tanto
el ranking como el detalle resaltan los tres primeros puestos en dorado, plateado
y bronce; los empates comparten color. Los puntos de la leyenda conservan el color
de cada cosechador. La barra de días tiene progreso verde y fondo gris sin borde.

Un día sin lecturas es `null`: conserva su lugar en el calendario, no genera un
punto de cero y corta el trazo. El detalle indica «Sin registro». Estos datos no
confirman asistencia ni ausencia, y el promedio no representa productividad por hora.

La RPC `harvest_reportes_campania` obtiene métricas, ranking y series diarias en una
sola consulta. `datos.evolucionCosechadores` contiene únicamente días con hechos,
con `{ trabajadorId, fecha, jabas }`; las filas del ranking añaden `diasRegistros`
y `promedioDiario`. Se conserva el contrato de autorización y la fuente reportable
existentes. La migración del backend es
`20261029220107_harvest_rendimiento_diario_cosechadores.sql`.

El gráfico usa SVG y no añade dependencias. Ordenar, paginar, elegir personas,
consultar un día y cambiar la leyenda no solicitan datos adicionales. Los skeletons
reservan las dimensiones del ranking y del gráfico; las tablas y los calendarios
largos permiten desplazamiento horizontal dentro de su contenedor.

Verificación: pruebas de SQL con PGlite para totales, promedios, días Lima, huecos,
filtros, historia inactiva, permisos y aislamiento; pruebas de React para selección,
orden, límite de diez, leyenda y líneas interrumpidas. Revisión de carga y contenido
en navegador a 1920, 1440, 1024, 768, 390 y 320 píxeles.
