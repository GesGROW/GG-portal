# Configuración de campaña

La sección **Configuración de campaña** está disponible desde el icono de
ajustes en la navegación interna de Cosecha. Mantiene la campaña seleccionada
en `/cosecha/ajustes?campania=...` y usa el mismo contenedor, tipografía,
colores y controles de las pantallas operativas del portal.

Permite editar nombre y fechas, renombrar variedades y lotes sin historial,
agregar variedades y lotes de campo, seleccionar variedades por lote y
activar o desactivar lotes. Los lotes de campo son independientes de los
lotes de tickets impresos.

## Alcance e historial

- Requiere `harvest.manage`, HARVEST habilitado y participación del usuario
  en el cultivo. Un owner sin permiso operativo no adquiere acceso por su
  condición de propietario.
- La campaña conserva su identidad, cultivo y estado. Esta sección no
  cierra campañas ni cambia su cultivo.
- Las fechas históricas son válidas al editar. El rango debe incluir las
  sesiones y la cosecha registrada, considerando America/Lima.
- Los nombres de lotes con sesiones se protegen. Los nombres de variedades
  con sesiones o compartidas con otra campaña también se protegen.
- Las variedades pertenecen al catálogo del cultivo. Agregarlas no altera
  las asociaciones de otras campañas. Las plantillas para nuevas campañas
  conservan sus lotes y relaciones existentes.
- Los lotes existentes se desactivan, no se eliminan. Retirar una variedad
  desactiva su asociación con el lote, conservando sus referencias históricas.
- Antes de desactivar un lote o retirar una variedad usada por una sesión
  activa, es necesario cerrar esa sesión.
- Las variedades inactivas ya asociadas se conservan y se muestran como
  inactivas. No se pueden asignar a lotes nuevos ni a otros lotes.
- Los cambios del formulario se guardan juntos. **Descartar cambios** vuelve
  a los datos cargados. Los errores conservan el borrador para corregir o
  reintentar; recargar la configuración reemplaza ese borrador.

## Implementación

La validación del comando está en `src/application/configuracionCampania.js`;
el servicio usa el scope de `cultivosCosecha.js`. El adaptador Supabase
transmite únicamente la intención normalizada. La presentación está en
`src/presentation/ConfiguracionCampania.jsx`, con carga dinámica de su módulo
y estilos para mantener aislada la sección.

La migración backend
`20261105101201_harvest_configuracion_campania.sql` agrega dos RPC:

- `harvest_admin_configuracion_campania(tenant,campania)`.
- `harvest_admin_guardar_configuracion_campania(tenant,operacion,campania,datos)`.

La huella `revision` detecta cambios simultáneos. Los bloqueos siguen el
orden cultivo → campaña → lotes → variedades. Cada guardado registra un
recibo en `harvest_cultivo_operaciones`; un reintento con la misma intención
recupera el resultado sin duplicar lotes ni variedades. Reutilizar el UUID
para otro actor, empresa, campaña o contenido se rechaza.

Se reutilizan las autorizaciones y tablas existentes, sin conceder acceso
CRUD. El DTO interno no es ejecutable por roles públicos; solo las dos
fachadas están habilitadas para `authenticated` y revalidan la autorización.

## Verificación y publicación

Las pruebas cubren validación y normalización, aislamiento, permisos,
idempotencia, respuesta perdida, conflicto de revisión, guardado atómico,
sesiones activas, desactivación con historial, navegación y formulario.
La fixture local se abre en
`/tests/visual.html?single&campaign&ruta=/cosecha/ajustes?campania=A-camp`.

Aplicar la migración antes de publicar la versión del portal que utiliza
las dos RPC. Esta implementación no modifica datos de negocio al instalarse.
La revisión visual automática en Chrome quedó pendiente porque Computer
Use detuvo el acceso al no poder verificar la URL de Windows con confianza.

Verificación local del 5 de noviembre de 2026:

- Suite completa de backend: 671 pruebas aprobadas antes del ajuste de
  variedades inactivas. Después del ajuste, el archivo SQL afectado pasó
  sus 31 pruebas, incluida la nueva regresión.
- Suite completa del portal: 186 pruebas Node y 324 pruebas de presentación
  aprobadas. Después del ajuste, las 7 pruebas del formulario aprobaron.
- Compilación de producción y revisión de espacios de Git correctas.
- Revisión visual: pendiente; faltan capturas de escritorio y móvil.

La migración está preparada en el repositorio y no se ha aplicado al
proyecto remoto. El portal tampoco se ha publicado con esta funcionalidad.
