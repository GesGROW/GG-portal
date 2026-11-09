# Exportación de tareo de Quijas

Desde Cosecha → Bonos → Exportar tareo de Quijas se consulta una semana de jueves a miércoles, independiente del período del reporte de bonos. Se respeta el filtro de cosechador. La selección de fechas y la consulta se delimitan en America/Lima.

El archivo es XLSX, hoja TAREO, con 16 columnas en el orden del ejemplo de Quijas. Los días 01–07 contienen cero numérico; asistencia N; orden de producción vacía. No incluye importes de bonos ni calcula horas. La descarga conserva los códigos como texto, incluidos ceros iniciales, y no genera fórmulas a partir de datos de entrada.

## Fuente y correspondencias

La vista previa contiene una fila por trabajador, lote y variedad con producción reportable en esa semana. No representa asistencia ni incluye automáticamente todo el padrón. La descarga agrupa combinaciones iguales de trabajador, actividad, labor y consumidor, incluso cuando provienen de distintos lotes internos.

El código externo del trabajador se administra también desde el editor de Trabajadores, después del alta. Se puede cargar un padrón XLSX con columnas CODIGO y DNI desde la exportación. La lectura ocurre en el navegador; se completan únicamente coincidencias exactas de DNI con los trabajadores mostrados. No se crean trabajadores, no se cambian nombres y no se cargan fechas de nacimiento. Los códigos se revisan antes de guardarse. Se rechazan identificadores incompletos y duplicados; no se adivinan ceros faltantes de un identificador numérico.

Actividad, labor y consumidor se configuran explícitamente por campaña, lote y variedad. Se conservan en un esquema privado para reutilizarlos; no se infieren de roles, del código del lote ni de la producción. Esta primera versión ofrece una imputación de cosecha por combinación, no un registro de varias labores y horas por persona.

## Período

Formato AAAAMM-SS. La sugerencia usa el año y mes del jueves inicial y su semana ISO; por ejemplo 2026-11-05 a 2026-11-11 propone 202611-45. Es editable porque la numeración oficial de Quijas y el mes/año de semanas que cruzan límites todavía requieren confirmación. La sugerencia no constituye un contrato de calendario externo.

## Permisos y despliegue

La consulta y descarga revalidan reports.view y acceso a campaña/cultivo mediante los controles existentes. Modificar códigos de trabajadores exige workforce.manage y el módulo WORKFORCE. Guardar imputaciones exige gestión del cultivo. Las tablas privadas no tienen acceso directo de clientes; las RPC públicas usan security invoker y delegan en funciones privadas con validaciones de empresa y permisos.

Aplicar la migración `backend/supabase/migrations/20261109203912_harvest_tareo_exportacion.sql` antes de desplegar el portal. No contiene datos personales ni códigos del padrón real. Los nuevos códigos y correspondencias comienzan sin completar; la exportación se habilita cuando todos los registros seleccionados tienen sus códigos.

Los bonos existentes y sus reglas históricas permanecen independientes de esta exportación.
