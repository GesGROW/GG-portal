# App de Cosecha: instalación, QR y dispositivos

Implementación local del diseño de referencia aportado el 2026-10-27.

## Accesos y presentación

- `/cosecha/app`: dos tarjetas, «Instalar la aplicación» y «Vincular PDA a la empresa».
- `/cosecha/dispositivos`: tabla de dispositivos con estado, fecha de vinculación,
  último acceso y revocación con confirmación.
- Pestaña lateral de celular; subpestañas de QR y dispositivo con usuario.
  Los cinco iconos proporcionados se conservan como SVG de trazo `currentColor`.
- Las tarjetas se apilan en pantallas estrechas y la tabla tiene desplazamiento
  horizontal dentro de su contenedor.
- Fechas presentadas en `America/Lima`, formato de 24 horas.

El enlace común de instalación es `https://gg-app-m-harvest.vercel.app/`. Puede
reemplazarse mediante `VITE_COSECHA_APP_URL`. Solo se aceptan enlaces HTTPS,
excepto HTTP en localhost para desarrollo; no se admiten credenciales en la URL.
Los errores al usar el portapapeles ofrecen un enlace para abrir la aplicación.

La tarjeta de instalación muestra siempre un QR de ese enlace público, junto a
«Copiar enlace». Es fijo mientras se conserve la URL y es común a todas las
empresas. No contiene tokens ni credenciales y no vence. Permite abrir la PWA
en el navegador del PDA y después instalarla desde el menú del navegador.
El QR de la tarjeta de vinculación es independiente: sigue siendo específico
de la empresa, con vencimiento y regeneración.

La tarjeta de adquisición no enlaza a la App de Cosecha. Las rutas del portal
para instalar la app requieren un rol de Cosecha (`harvest.view`,
`harvest.manage` o `harvest.operate`). Los supervisores con `harvest.manage`
pueden generar y regenerar QR, consultar dispositivos y revocar o renovar su
acceso. `company.manage` por sí solo no habilita estas pantallas ni su servicio
de gestión en el portal. El permiso siempre se valida en su empresa.
Todas las rutas nuevas exigen el módulo HARVEST habilitado.

## Integración y estado del QR

`appCosecha.js` resuelve el contexto de cuenta, comprueba permisos y módulo,
descarta respuestas de empresas o sesiones anteriores y valida la pertenencia de
los dispositivos recibidos. `pdaAdapter.js` transmite las solicitudes a:

- `pda_administrar_dispositivos`
- `pda_generar_vinculacion`
- `pda_revocar_dispositivo`
- `pda_renovar_dispositivo`

La generación ocurre únicamente al pulsar el botón. Abrir la página o cambiar
de campaña no regenera códigos. El token se codifica en el fragmento de la URL:
`https://gg-app-m-harvest.vercel.app/#vincular=<token>`. No se envía en la consulta
HTTP ni se almacena en almacenamiento persistente del portal.

Como el backend entrega el token una sola vez, el portal conserva el enlace QR
en memoria, separado por empresa y usuario. Al cambiar de sesión o empresa,
refrescar el navegador o detectar un código distinto en el servidor, debe
generarse un nuevo código para mostrarlo. La fecha de vencimiento y los
dispositivos siguen disponibles sin recuperar el secreto.

Un error de regeneración oculta el código anterior, cuya validez ya no puede
asegurarse. No se revocan dispositivos al regenerar el QR. La segunda subpestaña
permite actualizar el listado y revocar cada equipo activo mediante un diálogo
con foco y confirmación; los equipos revocados se conservan en la tabla.
Estos equipos muestran «Renovar acceso»: la confirmación vuelve a habilitar
el mismo PDA, sin repetir el QR ni perder registros. Usa los mismos permisos
de gestión y el mismo aislamiento por empresa que la revocación.

La tabla usa `DataTable` y `portal-tables.css`, igual que las demás tablas del
portal: encabezado verde, filas claras y resaltado suave para mouse y foco.
Las etiquetas de estado se muestran sin punto decorativo.

La implementación usa la migración del backend
`20261027152741_pda_vinculacion_dispositivos.sql` y la ampliación de permisos
`20261027175118_pda_supervisores_gestion.sql`. La renovación añade
`20261028163604_pda_renovar_acceso.sql`. Si esos RPC aún no están
disponibles, presenta un error de actualización pendiente; no simula equipos
ni códigos en el portal real.

## Límites de esta entrega

El portal modificado permanece local, pendiente de publicación. La migración
de renovación ya se aplicó en Quijas-SCC y se verificaron sus permisos sin
reactivar dispositivos reales. La primera pantalla de vinculación y el acceso de supervisor se
implementan en GG-app-m-harvest; requieren desplegar esa versión y aplicar
`20261027181414_pda_ingreso_supervisor.sql` en el backend. La migración completa
del flujo de campo a `pda_operar` sigue pendiente; no activar todavía el acceso
vinculado obligatorio para clientes que conservan los RPC operativos anteriores.

## Verificación

Las pruebas de aplicación verifican separación de enlace común y QR, permisos,
módulo, validación de URL, aislamiento de empresa, respuestas tardías y contrato
del adapter. Las pruebas de presentación comprueban tarjetas, copia, generación
explícita, tabla, confirmación, estado vacío y error de regeneración. Incluyen
el flujo completo del supervisor sin `company.manage` y el rechazo de usuarios
con permiso de solo consulta.

Validación final: `npm test` aprobó 147 pruebas de aplicación y 298 de
presentación (445 en total). `npm run build` y `git diff --check` finalizaron
correctamente. La pantalla y el generador QR se cargan bajo demanda para no
añadirlos a la carga inicial de las otras pestañas de Cosecha.

La fixture visual utiliza datos ficticios y no llama a la base desplegada:

```text
/tests/visual.html?single&pda&ruta=%2Fcosecha%2Fapp%3Fcampania%3DA-camp
```

Se inspeccionaron la instalación y la tabla en Chrome, y la distribución a
390 píxeles de ancho. Las capturas con datos de prueba se conservan solo en
el entorno local de verificación.
