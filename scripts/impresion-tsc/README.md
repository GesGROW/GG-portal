# Impresión local GesGROW · TSC TTP-247 · Windows

Servicio Node.js sin dependencias npm, limitado a `127.0.0.1:18191`. El portal proporciona TSPL generado por su encoder JSBarcode; este servicio valida una gramática cerrada y envía los bytes RAW a **una cola configurada** mediante PowerShell y P/Invoke `winspool.drv`. No recodifica Code128: conserva cada `BAR` recibido. No modifica backend ni portal.

## Instalación y configuración

Requisitos: Windows, Node.js 22 o posterior, Windows PowerShell 5.1, controlador/cola de la TTP-247 instalados y servicio Windows Print Spooler disponible. Use Node de 64 bits para trabajos grandes. No se ejecuta `npm install`.

Desde `portal/scripts/impresion-tsc/`:

```powershell
node setup.mjs --origin http://localhost:5174 --printer "TSC TTP-247"
node server.mjs
```

`setup.mjs` crea `config.local.json` con un token aleatorio de 256 bits y `dryRun: true`; no muestra el token y nunca sobrescribe un archivo existente. El archivo está excluido por el `.gitignore` de esta carpeta. `config.example.json` solo documenta la estructura: su token de ejemplo es rechazado. El fichero local contiene:

```json
{
  "port": 18191,
  "origins": ["http://localhost:5174", "https://portal.example.com"],
  "token": "<token local generado por setup.mjs>",
  "printer": "TSC TTP-247",
  "dryRun": true
}
```

Edite los orígenes y el nombre **exacto** de la cola mediante un editor local. Los orígenes incluyen esquema y puerto cuando corresponda, sin ruta ni barra final. `localhost` y `127.0.0.1` son orígenes distintos. No se admiten `*`, `null`, prefijos ni expresiones regulares. El bind siempre es `127.0.0.1`; `host` no es una opción válida. El puerto es configurable (1024–65535), pero **la integración actual del portal exige 18191**. Reinicie después de cambiar el archivo. Puede usar `node server.mjs --config ruta.json` con otra ubicación protegida.

Proteja el archivo local con ACL del usuario que ejecuta el servicio. Por ejemplo, desde PowerShell con ese usuario:

```powershell
$printIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls.exe .\config.local.json /inheritance:r /grant:r "${printIdentity}:(F)"
```

Esto restringe la herencia; revise y retire permisos explícitos sobrantes si el archivo ya existía. La carpeta y el helper también deben ser modificables únicamente por usuarios de confianza. El servicio escribe solo dirección y modo al arrancar; no imprime tokens, cuerpos, TSPL, diagnósticos PowerShell ni excepciones sensibles. No pase el token como argumento de consola, URL, variable pública `VITE_*` ni código versionado. Configure el token por estación y entréguelo al portal mediante una entrada local de operador; manténgalo preferentemente en memoria. El portal incluye estos campos en la salida de impresión directa.

El helper se inicia oculto con `-NoProfile -NonInteractive -ExecutionPolicy Bypass`, únicamente para ese proceso y ese archivo local fijo. No cambia la política global. Una política corporativa puede exigir firma o impedir la ejecución; el servicio devolverá un error controlado.

**Desarrollo:** mantenga `dryRun: true`. Valida el trabajo completo y calcula su hash, sin iniciar PowerShell para imprimir. El listado de impresoras sí es una operación de lectura de Windows. Para una puesta en servicio posterior, cambie deliberadamente a `dryRun: false` y reinicie. El primer POST válido en ese modo puede producir impresión física. No se ha realizado ninguna impresión física durante el desarrollo.

Ejecute Node al iniciar sesión si necesita arranque automático: use una tarea de Windows bajo el mismo usuario con acceso a la cola, ejecutable `node.exe` y argumentos con la ruta absoluta a `server.mjs` y `--config`. Esto es un proceso local de consola; no se instala automáticamente como servicio SCM ni se crean tareas, reglas de firewall o permisos de administrador.

## Contrato HTTP exacto

Base del portal: `http://127.0.0.1:18191`. Todas las rutas de aplicación requieren:

```http
Origin: http://localhost:5174
X-Gesgrow-Print-Token: <token de config.local.json>
```

El navegador envía `Origin` automáticamente. También es obligatorio en clientes de consola. `Host` debe ser `127.0.0.1:18191` o `localhost:18191`. No hay autenticación en parámetros, cookies ni `Authorization`. Las respuestas JSON usan UTF-8, `Cache-Control: no-store` y `Vary: Origin`.

### `POST /imprimir`

`Content-Type: application/json` (también `application/json; charset=utf-8`). Sin compresión. Solo admite estas tres propiedades:

```json
{
  "trabajoId": "754a95c1-3497-45d4-8827-5279a0a03663",
  "impresora": "TSC TTP-247",
  "tspl": "SIZE 96 mm,20 mm\r\nGAP 2 mm,0 mm\r\nDIRECTION 1\r\nREFERENCE 0,0\r\nOFFSET 0 mm\r\nSET TEAR ON\r\nCLS\r\nBAR 16,16,2,80\r\nBAR 20,16,4,80\r\nTEXT 16,112,\"1\",0,1,1,\"GG-000001\"\r\nPRINT 1,1\r\n"
}
```

El ejemplo ilustra la gramática: sus dos barras **no constituyen un Code128 completo**. En producción envíe todas las barras vectoriales del encoder. `trabajoId` es UUID (use `crypto.randomUUID()`), normalizado a minúsculas. `impresora` debe coincidir exactamente con `printer` en la configuración; no permite redirigir trabajos a otra cola.

Éxito real: **202 Accepted**:

```json
{
  "enviado": true,
  "trabajoId": "754a95c1-3497-45d4-8827-5279a0a03663",
  "estado": "encolado",
  "modo": "raw",
  "simulado": false,
  "impresora": "TSC TTP-247",
  "paginas": 1,
  "bytesSolicitados": 212,
  "bytesEscritos": 212,
  "idCola": 73,
  "sha256": "<64 caracteres hexadecimales>"
}
```

Los valores de bytes e ID son ilustrativos. En modo seco devuelve **200 OK**, `enviado: true`, `estado: "simulado"`, `modo: "dry-run"`, `simulado: true`, `bytesEscritos: 0`, `idCola: null`. `enviado` significa **solicitud aceptada**; el portal debe usar `simulado`/`modo` para distinguir validación de envío a la cola. Ni `202` ni los bytes escritos acreditan salida física del papel.

Todos los errores de aplicación contienen **`error` como string**:

```json
{
  "error": "Fallo del spooler de Windows; revise etapa, codigo Win32 y bytes. No reintente automaticamente.",
  "codigo": "SPOOL_ERROR",
  "trabajoId": "754a95c1-3497-45d4-8827-5279a0a03663",
  "etapa": "WritePrinter",
  "win32": 5,
  "idCola": 73,
  "bytesSolicitados": 212,
  "bytesEscritos": 10,
  "resultadoIncierto": true,
  "abortoIntentado": true,
  "abortoConfirmado": true
}
```

Los detalles dependen de la etapa. `bytesEscritos: null` significa cantidad desconocida, especialmente tras timeout o respuesta corrupta del helper. Un aborto confirmado no garantiza que el dispositivo no haya recibido datos. No se incluyen mensajes nativos que puedan revelar contenido sensible.

| HTTP | Código / causa |
| --- | --- |
| 400 | `JOB_INVALIDO`, `IMPRESORA_NO_PERMITIDA`, `TSPL_INVALIDO` (con `linea`), `JSON_INVALIDO`, `CUERPO_INCOMPLETO` |
| 401 | `TOKEN_INVALIDO` |
| 403 | `ORIGIN_NO_PERMITIDO`, `HOST_NO_PERMITIDO`, `PREFLIGHT_INVALIDO` |
| 404 / 405 | `RUTA_NO_ENCONTRADA` / `METODO_NO_PERMITIDO` |
| 408 | `CUERPO_TIMEOUT` |
| 409 | `JOB_CONFLICTO`: UUID utilizado con otros bytes |
| 413 | `CUERPO_GRANDE`, `TSPL_GRANDE` |
| 415 | `TIPO_INVALIDO`, `CODIFICACION_INVALIDA` |
| 429 | `SERVICIO_OCUPADO`: otro cuerpo en recepción, trabajo en envío o 1000 UUID retenidos |
| 502 | `SPOOL_ERROR`, `SPOOL_TIMEOUT`, `HELPER_NO_DISPONIBLE`, `HELPER_RESPUESTA_INVALIDA`, `ESCRITURA_INCOMPLETA` |
| 503 | `WINDOWS_REQUERIDO` |
| 500 | `ERROR_INTERNO` sin detalles sensibles |

Un error CORS puede ser visible para JavaScript como fallo de red. Errores de protocolo HTTP, desconexiones o límites del parser de Node pueden producir una respuesta de transporte sin JSON.

### `GET /estado` y `GET /health`

Ambos devuelven **200** con la misma forma:

```json
{
  "ok": true,
  "servicio": "gesgrow-impresion-tsc",
  "version": 1,
  "modo": "dry-run",
  "impresora": "TSC TTP-247",
  "ocupado": false,
  "limites": {
    "paginas": 100000,
    "cuerpoBytes": 104857600,
    "tsplBytes": 104857600,
    "retencionJobMs": 3600000
  }
}
```

Es salud del proceso local: no llama al spooler ni confirma disponibilidad, papel, ribbon o estado físico. `ocupado` incluye recepción y envío.

### `GET /impresoras`

Enumera colas locales y conexiones visibles al usuario de Windows (sin imprimir), **200**:

```json
{
  "ok": true,
  "impresoras": ["TSC TTP-247", "Microsoft Print to PDF"],
  "impresoraConfigurada": "TSC TTP-247",
  "disponible": true
}
```

Una lista vacía es válida. Una cola enumerada puede estar pausada o sin conexión. Los fallos de enumeración devuelven `502`; no se convierten en lista vacía.

### CORS / `OPTIONS`

Solo un origen exacto autorizado recibe `Access-Control-Allow-Origin: <origin>`. El preflight no lleva token, pero exige origen, Host, ruta y método válidos. Responde **204**, permite `GET` o `POST` según la ruta, y únicamente `Content-Type, X-Gesgrow-Print-Token`. No habilita credenciales. Expone `X-Idempotent-Replay`. Si se solicita Private Network Access, responde `Access-Control-Allow-Private-Network: true` para ese origen autorizado. El navegador puede exigir además autorización de acceso a red local y que la política CSP del portal permita `connect-src http://127.0.0.1:18191`; las cabeceras del servicio no anulan políticas del navegador o de la organización.

## Gramática TSPL permitida

Cabecera única, en este orden:

```text
SIZE <ancho> mm,20 mm
GAP <vertical> mm,0 mm
DIRECTION 1
REFERENCE 0,0
OFFSET 0 mm
SET TEAR ON
```

Después, una o más páginas/filas:

```text
CLS
BAR <x>,<y>,<ancho>,<alto>
TEXT <x>,<y>,"1",0,1,1,"<ASCII>"
PRINT 1,1
```

Cada página tiene al menos un `BAR`, como máximo 1024 barras y 16 textos opcionales. Las barras y textos se pueden intercalar entre `CLS` y `PRINT`. `PRINT 1,1` es fijo, sin multiplicadores ni copias. No hay `BARCODE`, `QRCODE`, `DOWNLOAD`, scripts, archivos, expresiones ni otros comandos. El servicio valida la seguridad y la geometría, no la corrección semántica de un Code128: esa corresponde al encoder común de PDF y TSPL.

Ancho de medio entre 10 y 108 mm, altura fija 20 mm; para tres tickets de 30 mm, `90 + 2 × gapHorizontal + márgenes <= 108`. `GAP` vertical entre 0 y 10 mm. Estos dos valores permiten hasta tres decimales; no aceptan signos, exponentes ni expresiones. A 8 dots/mm, cada barra debe quedar dentro de `floor(anchoMm × 8)` por 160 dots. Coordenadas y dimensiones de `BAR` son enteros no negativos; ancho y alto son positivos. `TEXT` usa exclusivamente fuente `"1"`, rotación 0, escalas 1,1, de 8 × 12 dots por carácter, y también debe caber. Solo ASCII imprimible, excluyendo comillas dobles, barra inversa y controles. Máximo 108 caracteres por texto, limitado además por la geometría. No se truncan textos ni barras.

Comandos en mayúsculas, un comando por línea, LF o CRLF. Sin líneas vacías; se admiten espacios después de las comas de `SIZE`, `GAP`, `BAR` y `TEXT`. Si falta el salto final, se añade CRLF para terminar `PRINT`. El resto de bytes permanece intacto. Máximo 256 caracteres por línea. La cabecera no se repite dentro de un trabajo.

## Volumen, tiempos y reintentos

- Límite de **100 MiB = 104857600 bytes para todo el cuerpo HTTP JSON**, incluyendo escapes y metadatos, con o sin `Content-Length`. TSPL tiene el mismo techo absoluto. Un TSPL de 100 MiB puede exceder el límite al serializarlo a JSON: el cliente debe medir `new TextEncoder().encode(JSON.stringify(body)).length`. No se comprime el cuerpo.
- Hasta **100000 `PRINT 1,1`** por trabajo. `paginas` cuenta filas de impresión, no códigos individuales: una fila de tres columnas puede contener tres tickets. Se admiten 100000 tickets sin reducir el trabajo; el test de carga valida incluso 100000 páginas con 50 barras por página. Las solicitudes que exceden un límite fallan completas antes de abrir una cola: no se imprime ni se devuelve silenciosamente un prefijo.
- Un solo cuerpo en recepción y un solo envío RAW a la vez; otros trabajos pueden recibir `429`. Recepción: 120 segundos absolutos. Helper: 120 segundos incluyendo arranque y spool. El cliente puede necesitar esperar más de 240 segundos con margen de validación; interrumpir `fetch` no cancela un trabajo que ya llegó a Windows.
- El JSON se valida completo antes del spool; no se imprime mientras todavía llegan datos. El TSPL se recorre línea a línea sin crear un array de millones de líneas. La transferencia al helper usa stdin binario, con metadatos pequeños y sin base64/archivo temporal. Node y PowerShell mantienen buffers grandes; reserve memoria suficiente (aproximadamente 1 GiB libre para cargas cercanas al límite). Para cargas mayores, el encoder debe crear trabajos independientes por grupos de páginas completas, cada uno con cabecera y UUID propio, y pedir confirmación de operador si un grupo tiene resultado incierto. El servicio no divide trabajos automáticamente.
- Idempotencia en memoria, **una hora desde finalizar**, hasta 1000 UUID. Repetir UUID y mismos bytes devuelve la respuesta original (incluidos errores del spool) con `X-Idempotent-Replay: true`; un duplicado durante el envío espera ese mismo resultado. Otros bytes con el mismo UUID producen `409`. Reiniciar el servicio o vencer la retención elimina esta protección. No cambie el UUID solo para eludir un error del spool.
- Ante pérdida de red, timeout o `resultadoIncierto`, la UI debe avisar **revisar la cola antes de reintentar**, como está previsto por el portal. No hay reintentos automáticos. Un nuevo UUID puede duplicar papel incluso después de un aborto. No existe cancelación remota ni garantía de impresión física.

## Ejemplo de integración del portal

El request vigente del portal es compatible. Distinga el modo seco para no mostrar una confirmación física:

```js
const trabajo = { trabajoId: crypto.randomUUID(), impresora, tspl };
// tokenLocal llega de la configuración de esta estación; no se registra ni se versiona.
const response = await fetch('http://127.0.0.1:18191/imprimir', {
  method: 'POST',
  credentials: 'omit',
  headers: {
    'Content-Type': 'application/json',
    'X-Gesgrow-Print-Token': tokenLocal,
  },
  body: JSON.stringify(trabajo),
});
const result = await response.json();
if (!response.ok) throw new Error(result.error || 'Error del servicio local');
if (result.simulado) {
  mostrar('Validado en modo seco; no enviado a la cola');
} else {
  mostrar(`Encolado en Windows. Trabajo ${result.idCola}`);
}
// Conservar trabajoId y contenido si falla la red. Revisar la cola antes de reintentar.
```

Para estado o impresoras, use `fetch` con el mismo token y `GET`; el navegador conserva el origen automático. Nunca construya manualmente una cabecera `Origin` en JavaScript del navegador.

## Spool y pruebas

Secuencia nativa: `OpenPrinterW` → `StartDocPrinterW` (`pDataType=RAW`, sin archivo de salida) → `StartPagePrinter` → `WritePrinter` hasta completar todos los bytes, continuando escrituras parciales → `EndPagePrinter` → `EndDocPrinter` → `ClosePrinter`. Ante fallo se intenta `AbortPrinter` y se cierra el handle en `finally`. Cada error conserva etapa, código Win32, ID de trabajo y conteo acumulado cuando se conoce. Un `WritePrinter` exitoso con cero bytes se trata como fallo. El helper enumera mediante `EnumPrintersW`, sin módulos de terceros ni utilidades de impresión.

```powershell
node --test tests/*.test.mjs
# Alternativa: npm test
```

Las pruebas HTTP escuchan en un puerto efímero sobre `127.0.0.1`. Las pruebas RAW sustituyen el spooler/proceso por memoria; **ninguna ejecuta `Print` contra PowerShell**. En Windows, `SelfTest` compila el C# de P/Invoke sin llamar a ninguna API nativa de impresoras. Se verifican contrato del portal, origen, token, preflight, gramática, geometría, volumen de 100000 páginas, límites, bytes completos, errores parciales, timeout, concurrencia e idempotencia. No se ha verificado papel, calibración, ribbon o calidad de lectura física.

Referencia primaria de Microsoft para la secuencia y las garantías limitadas del spool: [StartDocPrinter](https://learn.microsoft.com/windows/win32/printdocs/startdocprinter) y [WritePrinter](https://learn.microsoft.com/windows/win32/printdocs/writeprinter). Una respuesta de spool exitosa indica aceptación por Windows, no confirmación física de salida.
