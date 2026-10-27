# GesGROW · Portal

Portal administrativo en React y Vite. Repositorio independiente de la aplicación de campo.

## Desarrollo

Requiere Node.js 24 y npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Configurar VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY con la URL y la clave
pública del proyecto. Nunca colocar una clave service_role en el frontend.
En PowerShell puede usarse Copy-Item .env.example .env.local.
Puerto de desarrollo: 5174. La sesión del Portal tiene almacenamiento separado del PWA.

## Validación y publicación

```sh
npm test
npm run build
```

Publicar dist/ en un origen propio con fallback de rutas hacia index.html. El Portal
no registra un service worker. En Supabase deben configurarse ese origen y la ruta
/aceptar-invitacion como destinos de Auth, y PORTAL_ORIGIN de invitar-usuario.
La CI ejecuta las pruebas y la compilación; no despliega ni altera Supabase.

## Código compartido

Este repositorio incluye en vendor/ la entrega exacta de @gesgrow/core 0.1.0.
package-lock.json fija su integridad. npm ci funciona sin clonar los otros proyectos,
sin una carpeta shared/ externa y sin acceso a un registro privado.
La fuente canónica se mantiene en GG-backend, dentro de
supabase/functions/_shared/core/, para que también sea desplegable por las Edge Functions.

Para actualizar el paquete se recibe un nuevo .tgz, se cambia la dependencia file:
y se actualiza package-lock.json con npm install. No modificar node_modules ni editar
copias independientes de las reglas.

## Documentación

Los archivos de docs/ conservan las decisiones y verificaciones del desarrollo.
Algunos informes históricos describen la antigua estructura SCC; las instrucciones
vigentes de instalación son las de este README.

## Proyectos

La pantalla de [App de Cosecha y dispositivos PDA](docs/app-cosecha-pda.md)
incluye instalación, QR de vinculación y administración de equipos. El enlace
de la aplicación se configura opcionalmente con `VITE_COSECHA_APP_URL`.

- Portal: https://github.com/GesGROW/GG-portal
- Backend: https://github.com/GesGROW/GG-backend
- PWA Cosecha: https://github.com/GesGROW/GG-app-m-harvest

La primera versión de este repositorio parte del código actual, sin importar el
historial del repositorio anterior Quijas-SCC.
