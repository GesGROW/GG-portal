# Generación de tickets por persona

El generador solicita **Cantidad de personas** y **Tickets por persona**. Calcula
el total multiplicando ambos valores y conserva el contrato existente del
servidor: `cantidadTickets` recibe el total y `tamanioLote` los tickets por
persona. Por ejemplo, 20 personas con 27 tickets producen 540 tickets en 20 lotes.
Generar un lote no lo asigna: la asignación por escaneo conserva sus reglas.

Las cantidades nuevas deben ser enteros positivos. Los tickets por persona son
múltiplos de tres; las flechas del control avanzan de tres en tres. Se mantiene
el límite existente de 100.000 tickets por generación, por lo que el mayor total
nuevo posible es 99.999. Una cantidad inválida no permite previsualizar ni
confirmar. Cambiar cantidades descarta la vista previa anterior.

El preparador compartido por PDF, HTML de impresión y TSPL inicia una fila nueva
al cambiar de lote. Nunca combina dos lotes en una fila. Una reimpresión antigua
con un tamaño no divisible entre tres deja espacios en blanco al finalizar cada
lote: no fabrica tickets para rellenarlos ni altera códigos, orden o cantidades.

La recuperación de operaciones conserva el total y tamaño originales, incluso
si el último lote estaba incompleto. La vista previa, confirmación, reintentos,
confirmación humana de impresión y reimpresión mantienen el flujo existente.
No se requiere una migración de base de datos.

Verificación: pruebas de cálculo y límites en `campaign-generation.test.jsx`,
recuperación/reintentos en `campaign-generation-printing.test.jsx` y separación
de lotes en `etiquetas-tickets.test.js`, incluyendo bloques de 3 columnas × 9
filas y lotes históricos incompletos. Se comprueban las salidas PDF, HTML y TSPL.
