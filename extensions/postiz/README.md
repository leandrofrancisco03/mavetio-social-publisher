# Direct Post privado para Mavetio

## Estado y alcance

Implementación local, **sin despliegue ni publicaciones reales**. La API estándar
de Postiz v2.25.3 no basta: integration-settings devuelve un esquema estático y
integration-trigger no tiene una herramienta creator_info del proveedor tiktok.
Esta extensión añade una ruta propia, no una ruta preexistente de Postiz:

`GET /api/public/v1/mavetio/tiktok/:id/creator-info`

Hereda PublicAuthMiddleware y la organización de la API key; verifica pertenencia,
proveedor, cuenta habilitada y ausencia de refresh pendiente. Hace POST al endpoint
oficial creator_info con el token almacenado en Postiz. No renueva ni devuelve
tokens. Un éxito `error.code=ok` acredita acceso a la operación que requiere
video.publish; estados HTTP 200 con error también bloquean. No se infiere el permiso
de la lista de scopes solicitados en OAuth.

La respuesta es una lista explícita de campos no secretos, versión de contrato y
hora de consulta. Solo ofrece SELF_ONLY si aparece en la respuesta oficial. Nunca
se almacena el token TikTok en Cloudflare. La respuesta no se cachea.

## Archivos de Postiz afectados por apply.mjs

- `apps/backend/src/public-api/routes/v1/public.integrations.controller.ts`: ruta
  autenticada y desactivada por defecto, sin modificar rutas de subida/publicación.
- `libraries/nestjs-libraries/src/integrations/mavetio-tiktok.ts`: helper nuevo.
- `libraries/nestjs-libraries/src/integrations/social/tiktok.provider.ts`: antes
  de iniciar Direct Post, reconsulta creador y valida privacidad/interacciones.
  Solo se ejecuta cuando MAVETIO_DIRECT_POST=true. UPLOAD conserva su ejecución.

Con el flag activo, la comprobación SELF_ONLY también se aplica al Direct Post del
panel Postiz. No activar esta imagen para organizaciones que necesiten Direct Post
público o fotografías. El alcance inicial es vídeo privado de Mavetio.

## Controles en Mavetio

- `TIKTOK_DIRECT_POST_ENABLED=false` por defecto: sin activación no consulta la
  extensión ni permite DIRECT_POST. No basta cambiar el selector en el navegador.
- Con la activación, consulta al seleccionar cuenta y antes de confirmar. Sin
  respuesta vigente/compatible o sin SELF_ONLY mantiene la modalidad deshabilitada.
- Privacidad inicialmente vacía, interacciones inicialmente apagadas, límites
  según creador, IA, promoción propia y consentimiento musical. Terceros se
  deshabilita porque es incompatible con SELF_ONLY. No se permite guardar una
  elección pública aunque se manipule la solicitud.
- Confirmación final del destino y ajustes antes de subir el archivo. Direct Post
  inicialmente solo `now`, no programación ni borrador. UPLOAD mantiene los tres.
- Al subir, Mavetio lee la duración mvhd del MP4 (máximo 25 MB) y la firma en el
  recibo ligado al usuario. Direct Post rechaza recibos antiguos sin duración,
  MOV y medios sin duración reconocida. No confía en duración enviada por cliente.
- Al enviar, vuelve a consultar creator_info y valida la duración firmada. Postiz
  vuelve a comprobar privacidad/interacciones justo antes de ejecutar; TikTok es
  además responsable de validar el medio final. No se ha añadido ffmpeg a Workers.
- D1 sigue reservando requestId antes del POST /posts. Timeout: unknown y bloqueo
  de reenvío; respuesta completada: reutilización. La aceptación no es publicación.

## Construcción reproducible (solo checkout local/CI)

Base revisada: commit `a5affe62c74e39c1e7ac960d50d8418b807d532c`, consultado mediante
la referencia v2.25.3. No seguir una etiqueta flotante para construir. apply.mjs
verifica SHA256 de los dos archivos originales y rechaza cualquier otra versión
o un checkout ya parcheado. Usar una rama propia `codex/mavetio-direct-post-v1`.

1. Clonar Postiz en un directorio independiente y hacer checkout del commit indicado.
2. Desde el repositorio de Mavetio, ejecutar (sustituir la ruta):

   ```powershell
   node extensions/postiz/apply.mjs C:/ruta/postiz-custom --check
   node extensions/postiz/apply.mjs C:/ruta/postiz-custom
   ```

3. Revisar y versionar los tres archivos modificados en ese checkout. Conservar
   el commit base, esta revisión de Mavetio y hashes/digest de la imagen en CI.
4. En el checkout de Postiz, compilar la imagen con su Dockerfile y target reales:

   ```sh
   docker build --target dist -f Dockerfile.dev -t mavetio/postiz:2.25.3-direct-v1 .
   ```

   No ejecutar docker-create.sh ni docker-build.sh: los scripts upstream incluyen
   eliminación de imágenes/contenedores. No usar prisma-reset ni cambiar el esquema.

La compilación completa de la imagen Postiz NO se ha ejecutado en este entorno.
Se verificaron hashes/anclas y aplicación local del parche; el helper compartido
forma parte del typecheck/tests de Mavetio. La imagen completa debe compilarse y
probarse antes de activar. No se declara compatibilidad binaria de una imagen que
todavía no se ha construido.

Docker no está disponible en este entorno. Se verificó también la transpilación
sintáctica de los dos archivos parcheados con decoradores, pero eso no sustituye
la resolución de tipos/dependencias ni los smoke tests de la imagen completa.

## Validación en entorno aislado

1. Construir la imagen y arrancar staging aislado de la BD, Redis, Temporal, medios
   y colas de producción. No copiar tokens reales ni tareas activas de producción.
2. Verificar que ruta sin API key devuelve rechazo; clave de otra organización no
   puede consultar el canal; flag ausente devuelve 404; canal inexistente, de otra
   red, deshabilitado o con refresh pendiente no llama a TikTok.
3. Con dobles de prueba del endpoint oficial: errores de scope, cuota, 401, 5xx,
   timeout y JSON inválido mantienen Direct Post bloqueado, sin filtrar respuestas.
4. Con respuestas válidas: comprobar privacidad vacía, opciones solo SELF_ONLY,
   restricciones, duración, declaración musical, cancelación de confirmación sin
   subida y envío de payload DIRECT_POST con id del canal. No publicar contenido.
5. Hacer pasar el build upstream y smoke tests HTTP de autenticación/ruta. Estos
   smoke tests completos de Nest/imagen quedan pendientes; las pruebas locales
   no sustituyen esta comprobación.

## Despliegue autorizado y rollback (no ejecutados)

1. Guardar digest de imagen Postiz actual, configuración y backup según operación
   habitual. Mantener Mavetio con Direct Post desactivado. Esta extensión no requiere
   migración de BD ni secretos nuevos.
2. En una ventana autorizada, sustituir la imagen por el digest personalizado,
   preservando volúmenes, DB, Redis, Temporal, variables OAuth y servicios existentes.
   Revisar su entrypoint para no introducir cambios de esquema accidentales.
3. Añadir `MAVETIO_DIRECT_POST=true` al backend y al orchestrator de esa imagen.
   Si usan despliegues separados, actualizar ambos al mismo digest.
4. Verificar salud y consultas existentes. Solo después de aprobar staging, activar
   `TIKTOK_DIRECT_POST_ENABLED=true` en configuración versionada de Mavetio y realizar
   un despliegue explícitamente autorizado. No modifica Access ni secretos.
5. Abrir Nuevo vídeo, seleccionar Francisco y consultar creador (lectura). Su ID
   sigue obtenido de las integraciones reales, nunca fijado en el código.
6. Ante problemas: primero desactivar Direct Post en Mavetio; revisar tareas
   pendientes antes de restaurar el digest anterior de Postiz. No borrar ni
   reejecutar workflows. No reintentar solicitudes unknown. La API antigua hará
   que Mavetio bloquee Direct Post; UPLOAD sigue utilizando su contrato original.

No confiar en apagar el flag como cancelación de un envío ya aceptado: revisar
Postiz/Temporal/TikTok. Los mensajes enviados al proveedor no se pueden deshacer
restaurando una imagen.

## Grabación posterior, con autorización independiente

UPLOAD: mostrar entrega en bandeja y la notificación ya confirmada por el usuario.
Direct Post: mostrar creador actual, Solo yo seleccionado manualmente, controles,
vista previa, consentimientos y confirmación. Mostrar primero aceptación de Postiz,
después estado final y verificar publicación privada en TikTok. No afirmar aprobación.
La app no auditada exige además una cuenta privada según las guías de TikTok.
La extensión exige FOLLOWER_OF_CREATOR y ausencia de PUBLIC_TO_EVERYONE en las
opciones oficiales (distinción documentada por TikTok para cuentas privadas).
Si no puede establecer esa condición, bloquea; no cambia la privacidad de la cuenta.
creator_info no expone un booleano de auditoría: se mantiene la política restrictiva
sin inferir aprobación ni habilitar visibilidad pública.

Referencias: [Creator Info](https://developers.tiktok.com/docs/en/content-posting-api-reference-query-creator-info),
[Content Sharing Guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines),
[código fijado de Postiz](https://github.com/gitroomhq/postiz-app/tree/a5affe62c74e39c1e7ac960d50d8418b807d532c).
