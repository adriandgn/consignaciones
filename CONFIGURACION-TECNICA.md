# Configuración técnica

## Arquitectura

- `public/`: interfaz y estilos; el build copia los assets a `dist/`.
- `api/handler.js`: función Node de Vercel con Web Standard `fetch`.
- `server/backend.js`: autenticación, acceso PostgREST, concurrencia por revisión y adjuntos privados.
- `src/domain.js` / `src/import-stock.js`: reglas compartidas. Las acciones se validan en servidor; no se acepta un estado completo enviado por el cliente.
- `supabase/setup.sql`: PostgreSQL y bucket. RLS habilitado, sin permisos para `anon` ni `authenticated`. Solo el servidor usa `service_role` tras verificar usuario y correo autorizado.
- `src/seed.mjs`, `src/legacy-seed.json`, `test/`: fixtures y regresiones de la versión anterior. No inicializan la nueva base y no se publican como assets.

`vercel.json` dirige `/api/:path*` a una sola función y aplica encabezados de seguridad. El build no incorpora claves. Cookie de sesión HttpOnly, Secure y SameSite=Strict. Las escrituras requieren un Origin incluido en APP_URL; no habilitar comodines. El cierre de sesión elimina la cookie de este navegador; un token ya emitido vence según su duración. Retirar un correo de ADMIN_EMAILS y desplegar vuelve a bloquearlo en cada petición.

La API mantiene el compare-and-swap por revisión e identificadores de operación para reintentos idempotentes. Los metadatos de adjuntos se leen en páginas de 500. El payload de negocio sigue siendo un único JSONB, máximo 3 MB; esta arquitectura debe normalizarse para crecimiento sostenido. Se rechazan cargas mayores antes de actualizar, sin truncar el inventario. Solicitudes de acciones: 1,8 MB. Adjuntos: 4.000.000 bytes, firma de JPG/PNG/WebP/PDF y bucket privado.

## Comandos

```sh
npm ci
npm test
npm run build
```

Se incluyen pruebas del circuito financiero y la interfaz, además de pruebas de API con un doble de Supabase (no contra una cuenta real). Ver `VERIFICACION.txt` para el resultado local. El build no necesita variables de entorno; el servidor sí las necesita al atender solicitudes.

Para desarrollar con `vercel dev`, cargar variables de Development separadas y añadir `http://localhost:3000` a APP_URL. La cookie es Secure: usar HTTPS si el navegador no permite cookies seguras en localhost. Nunca debilitar la cookie del despliegue público. Preview debe apuntar a un Supabase de prueba y a un correo autorizado de prueba.

## Respaldo del nuevo Supabase

Copiar `.env.example` a `.env.local` en la computadora del administrador y completar las variables. Node puede cargarlas sin pegarlas en comandos:

```sh
node --env-file=.env.local scripts/backup.mjs
```

El script crea una carpeta nueva en `backups/` con `state.json`, `files.json`, los objetos y `manifest.json`. Hace dos lecturas del estado y los metadatos para detectar cambios mientras copia. Ejecutarlo sin operaciones concurrentes y conservar la carpeta completa en un lugar privado. Si hubo cambios o faltan objetos termina con error: no usar ese respaldo como completo. Los archivos pueden contener datos personales y bancarios.

No se incluye restauración destructiva automática. Para restaurar en un proyecto vacío: preparar esquema, validar la forma del estado, importar payload/revision y metadatos, cargar objetos con los mismos ids, verificar hashes y relaciones. No reemplazar la base activa sin respaldo. El script no exporta usuarios/contraseñas de Auth; los accesos se administran aparte.

## Pendiente para activar

- Crear Supabase, ejecutar SQL, crear usuario, definir variables, desplegar Vercel.
- Verificar login/logout y denegación sin sesión desde incógnito.
- Verificar un circuito ficticio con archivo y recarga desde dos dispositivos.
- Migrar datos y revisar contadores antes de usar códigos reales.
- Validar impresión física y lectura del código con el lector de Dux.
- Implementar integración Dux y pruebas de conciliación en una etapa posterior.

## Referencias oficiales consultadas

- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/project-configuration/vercel-json
- https://vercel.com/docs/functions/limitations
- https://vercel.com/docs/errors/function_payload_too_large
- https://supabase.com/docs/guides/api/securing-your-api
- https://supabase.github.io/auth/
- https://supabase.com/docs/guides/storage/uploads/standard-uploads
- https://supabase.com/docs/guides/storage/serving/downloads
