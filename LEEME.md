# Therapy — exportación para Vercel

Este paquete contiene una copia independiente del portal: interfaz, lógica de negocio, etiquetas, API para Vercel y configuración para Supabase. No modifica el sitio anterior. Después de instalarlo, se administra desde tus cuentas de Vercel y Supabase; no necesita una sesión de ChatGPT.

**No está desplegado en tu cuenta todavía.** Hay que crear los servicios y completar las variables. La base empieza vacía. Este ZIP no es un respaldo de la base de datos ni de los adjuntos guardados en el alojamiento anterior. No se importó el listado de stock que ibas a corregir.

## 1. Crear la base y el acceso

1. Entrá en https://supabase.com con tu propia cuenta y creá un proyecto dedicado a Therapy.
2. Abrí **SQL Editor**, copiá todo `supabase/setup.sql` y ejecutalo. Crea las tablas y el contenedor privado `therapy-files`, sin datos de ejemplo. Puede repetirse sin borrar registros.
3. En **Authentication → Users**, agregá tu usuario con correo y contraseña y confirmá el correo desde el panel. Usá la opción de crear usuario con contraseña, no una invitación: esta versión no implementa la pantalla de aceptación de invitaciones.
4. Deshabilitá el registro público de usuarios en la configuración de Authentication. El portal tampoco ofrece registro abierto.
5. En la configuración de API, copiá la URL del proyecto y las claves **legacy `anon`** y **legacy `service_role`**. Esta exportación usa esas claves JWT; no intercambiarlas con una contraseña de la base de datos ni con un token personal de Supabase.

## 2. Subir a Vercel

La ruta más sencilla para mantenerlo es GitHub + Vercel:

1. Descomprimí `Therapy_Vercel.zip`.
2. Creá un repositorio **privado** en tu cuenta de GitHub. Subí el contenido de la carpeta `therapy-vercel`, incluyendo los archivos que empiezan con punto. `package.json` y `vercel.json` deben quedar en la raíz del repositorio.
3. En https://vercel.com, elegí **Add New → Project** e importá ese repositorio.
4. Usá **Framework Preset: Other**. La configuración incluida indica `npm ci`, `npm run build` y carpeta de salida `dist`. No subas solamente `dist`: también se necesita `api/` y `server/`.
5. Agregá las variables de la tabla siguiente para **Production**. No uses la base real para las pruebas de Preview.
6. Desplegá. Si todavía no conocés la dirección final, completá luego `APP_URL` con la URL `https://…vercel.app` asignada y hacé un nuevo despliegue. Hasta entonces el portal rechazará el inicio de sesión desde un origen distinto.
7. Abrí esa URL e ingresá con el usuario creado en Supabase.

| Variable | Contenido |
| --- | --- |
| `SUPABASE_URL` | URL de tu proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave legacy `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave legacy `service_role`, exclusivamente en el servidor |
| `ADMIN_EMAILS` | Tu correo exacto; varios administradores separados por coma |
| `APP_URL` | URL completa del portal, sin barra final; varias URLs explícitas separadas por coma |

No pegues claves en el código, el navegador ni un repositorio. `.env.example` contiene únicamente marcadores para completar. Todos los usuarios autorizados tienen acceso administrativo al mismo inventario; no es un portal con permisos separados por proveedor.

**Alternativa técnica sin GitHub:** con Node instalado, desde la carpeta del proyecto, ejecutar `npx vercel`, completar las variables en el panel de Vercel y después `npx vercel --prod`. Estos comandos publican en la cuenta con la que se inicie sesión. No fueron ejecutados durante esta exportación.

## 3. Conectar tu dominio

Primero comprobá el funcionamiento en la URL de Vercel. Después agregá `gestion.therapy-argentina.com` en **Settings → Domains** y configurá en tu proveedor DNS exactamente el registro que Vercel indique. Añadí `https://gestion.therapy-argentina.com` a `APP_URL` y volvé a desplegar. El sitio principal puede conservar su alojamiento actual.

## 4. Prueba inicial

1. Crear a Andrea Aguirre como proveedora y marcarla **PRUEBA**.
2. Cargar una prenda de prueba; indicar categoría, talle y precio de contado. Registrar el consentimiento antes de vender una consignación.
3. Verificar la etiqueta vertical de 50 × 80 mm: logo, PRECIO EF/TR, PRECIO LISTA, descripción, talle, barras y código. Imprimir al 100%, sin encabezados ni márgenes añadidos. Hacer una impresión y lectura reales con la Zebra antes de un lote.
4. Registrar una venta ficticia, generar la liquidación y registrar un pago ficticio. El porcentaje del proveedor se aplica sobre el precio de contado, incluso cuando se cobra a precio de lista.
5. Subir un PDF o una foto de ejemplo, recargar la página y comprobar que se conserva.
6. Probar stock propio por separado: no genera liquidación para un proveedor.

Los pagos son registros y comprobantes: el programa no envía transferencias bancarias. La impresión se realiza desde el navegador con el controlador de la impresora; no incluye envío ZPL directo ni automatización de ZebraDesigner.

## 5. Trasladar los datos y conservar los códigos

**Antes de cargar stock real, hay que decidir si se migra el inventario anterior o se empieza de cero.** La nueva base vacía comienza en THR-000001. No generar códigos definitivos desde ambas instalaciones al mismo tiempo.

Para una migración completa, el responsable técnico debe exportar del alojamiento anterior:

- El registro de `therapy_state`: `payload` completo y `revision`. Conserva prendas, proveedores, ventas, liquidaciones, pagos, auditoría y todos los contadores.
- Todas las filas de `therapy_files` y cada objeto adjunto del almacenamiento, con el mismo identificador.

Cargar esos datos en Supabase preservando los contadores y relaciones, en una ventana sin nuevas operaciones en el sitio anterior. Verificar cantidades, saldos, códigos y una muestra de adjuntos antes de cambiar de portal. Esta versión acepta adjuntos de hasta 4.000.000 bytes; los mayores deben reducirse y comprobarse antes de migrarlos. No ejecutar los archivos de prueba como si fueran un respaldo.

Si se parte del nuevo Excel, usar **Importar stock**, revisar equivalencias y guardar los códigos anteriores. Antes de confirmar, reservar la numeración THR ya usada en etiquetas o Dux. El técnico puede establecer `payload.counters.item` al mayor número THR previamente emitido, sin reducirlo. El importador no consulta Dux para detectar códigos externos.

## 6. Dux

La integración con Dux **no está implementada** en este paquete. No se guardó ni incluyó un token. El portal genera los códigos y las barras y exporta listados CSV, pero los CSV no se presentan como un formato Dux ya validado.

La siguiente etapa es verificar los endpoints y permisos de tu cuenta Dux, mapear productos/códigos, definir cuál sistema registra cada movimiento e implementar sincronización idempotente, reintentos y conciliación. Hasta verificar ese circuito, no asumir que un alta o una venta viaja automáticamente entre sistemas.

## 7. Mantenimiento y respaldos

- Vercel publica la aplicación; Supabase conserva usuarios, datos y adjuntos. Los costos, cupos y disponibilidad dependen de tus planes en ambos servicios.
- Mantener el repositorio en tu cuenta y actualizar dependencias después de ejecutar `npm test` y `npm run build`.
- Respaldar tanto la base PostgreSQL como los objetos de Storage. Un respaldo de la base por sí solo no contiene los archivos adjuntos. Probar una restauración en un proyecto separado.
- El archivo `scripts/backup.mjs` permite descargar el estado y los adjuntos del **nuevo Supabase**. No respalda automáticamente el alojamiento anterior. Ver `CONFIGURACION-TECNICA.md`.
- El acceso dura como máximo una hora. Si vence mientras trabajás, se pide ingresar nuevamente y se conserva el formulario abierto. No hay recuperación de contraseña por correo implementada: la administra el responsable desde Supabase.

## 8. Alcance de esta entrega

Se conserva la estructura anual, el diseño Therapy, stock propio/consignado, categorías Vintage/Second hand/Upcycling, importación Excel/CSV, liquidaciones a contado, devoluciones, revisiones de 90 días, fotos opcionales, exportaciones y la etiqueta aprobada.

La adaptación fue verificada localmente con pruebas automatizadas. Falta la prueba real contra tus servicios de Vercel y Supabase y una impresión física. **Los datos siguen guardándose como un documento de estado compartido**, con límite preventivo de 3 MB para evitar respuestas mayores al límite del alojamiento. El crecimiento depende también de ventas y auditoría; no equivale a una cantidad fija de prendas. Para un inventario grande y creciente conviene migrar a tablas por entidad y consultas paginadas antes de la carga masiva. No se presenta esta exportación como una integración Dux terminada ni como una migración de datos realizada.

Los adjuntos tienen límite de 4 MB en esta adaptación. El Excel puede pesar hasta 8 MB porque se procesa en el navegador; cada lote admite hasta 2.000 unidades y su solicitud final puede estar sujeta al límite de 1,8 MB.
