# Clima del Home

El Home solicita permiso para usar la ubicación del dispositivo sólo cuando hay
un servicio de clima configurado y una sesión del Portal. El adaptador usa el
cliente Supabase ya autenticado para invocar la Edge Function `clima`.

Con permiso muestra temperatura, condición, localidad, lluvia de las próximas
tres horas, humedad, viento y hora de actualización. Sin permiso o ante un fallo
conserva únicamente el icono y el fondo; el clima no bloquea el Home ni cierra la sesión.

Si el permiso está concedido pero el navegador no entrega coordenadas, el servidor
consulta una ubicación aproximada según la conexión. La localidad se identifica
con «Aprox.». Esta alternativa no se utiliza con el permiso rechazado o pendiente.
Un límite de espera independiente evita que el navegador deje la consulta colgada.

El fondo usa hora de Lima: mañana 06:00–12:00, tarde 12:00–19:00 y noche el resto
del día. Se actualiza cada minuto y al regresar a la pestaña. La consulta del clima
se reutiliza durante 15 minutos. Al revocar ubicación se retiran los datos.

La clave WeatherAPI pertenece al backend y no requiere ninguna variable `VITE_`.
La configuración del servidor está documentada en `GG-backend/docs/clima-weatherapi.md`.

Las coordenadas se envían redondeadas, sin almacenarlas de manera persistente.
La localidad mostrada corresponde al dispositivo, no a un fundo seleccionado.
