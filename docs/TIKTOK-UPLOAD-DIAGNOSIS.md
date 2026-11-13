# Diagnóstico UPLOAD: Mavetio → Postiz → TikTok Inbox

No se envió contenido, ejecutó OAuth, modificó configuración ni desplegó durante
esta revisión. Falta el ID/estado/error/fecha del envío real; no se puede atribuir
su falta de confirmación a una avería concreta sin esos datos.

## Recorrido verificado en código

1. El formulario llama a `/api/publisher/upload`: el backend carga a `/upload` de
   Postiz y devuelve un recibo firmado. Esto solo acredita almacenamiento.
2. Después llama a `/api/publisher/submit`. El servidor comprueba el recibo, usuario,
   cuenta TikTok habilitada y consentimiento. Envía POST `/posts` con
   `type: now|schedule|draft`, `integration.id` seleccionado y
   `settings.content_posting_method: UPLOAD`. Direct Post sigue rechazado.
3. El HTTP 201 de Mavetio contiene los IDs aceptados por Postiz. D1 `completed`
   significa que se registró esa respuesta, no que TikTok recibió el vídeo.
4. Postiz guarda la publicación y arranca un workflow asíncrono. `now` usa la fecha
   actual; no ejecuta todo TikTok dentro de la respuesta HTTP. Una API saludable
   no prueba que el worker esté consumiendo la cola.
5. El proveedor de TikTok usa `/inbox/video/init/` para vídeos UPLOAD. Después,
   `checkPostStatus` consulta `/v2/post/publish/status/fetch/` con el publish_id.
   `SEND_TO_USER_INBOX` termina como completed con URL de mensajes y postId
   `missing`; `PUBLISH_COMPLETE` también completa; `FAILED` genera error.

Fuentes de Postiz v2.25.3:

- [Creación y startWorkflow](https://github.com/gitroomhq/postiz-app/blob/v2.25.3/libraries/nestjs-libraries/src/database/prisma/posts/posts.service.ts)
- [Workflow V112](https://github.com/gitroomhq/postiz-app/blob/v2.25.3/apps/orchestrator/src/workflows/post-workflows/post.workflow.v1.1.2.ts)
- [Proveedor TikTok](https://github.com/gitroomhq/postiz-app/blob/v2.25.3/libraries/nestjs-libraries/src/integrations/social/tiktok.provider.ts)
- [Servicios de referencia](https://github.com/gitroomhq/postiz-app/blob/v2.25.3/docker-compose.yaml)

## Estados y límites

| Evidencia | Qué acredita |
| --- | --- |
| Archivo en biblioteca | Almacenamiento; podría haber fallado el paso siguiente |
| postId / 201 | Publicación aceptada por Postiz |
| DRAFT | Borrador, sin envío solicitado |
| QUEUE | Programada, esperando ejecución o procesándose; sin detalle de etapa en nuestra API |
| ERROR | Fallo o resultado no confirmado; revisar mensaje antes de reenviar |
| PUBLISHED + UPLOAD | Flujo completado según Postiz; no equivale a publicación en perfil |
| SEND_TO_USER_INBOX | TikTok confirma envío a bandeja, si se obtiene del estado oficial vía Postiz |
| Vídeo visible en bandeja | Evidencia visual del recorrido para la demostración |

Antes, el dashboard convertía PUBLISHED+UPLOAD en «Enviado a TikTok». No lo hacía
para una simple aceptación 201, pero ocultaba que la fuente era Postiz. Ahora
indica «Completado según Postiz · UPLOAD» y explica los límites. La respuesta de
GET /posts consumida por Mavetio no incluye el estado bruto de TikTok ni toda la
historia de procesamiento. Un releaseURL o releaseId aislado no prueba entrega.

No se añadirá una llamada directa a TikTok con la API key de Postiz: son credenciales
distintas. El polling oficial ya pertenece a Postiz; duplicarlo exige acceso al
token TikTok y publish_id que Mavetio no maneja. Si se necesita mayor precisión,
exponer esos resultados mediante una capacidad soportada de Postiz, no inventar
un endpoint ni transferir secretos al navegador.

## Comprobación del envío existente, sin reenviar

1. En Postiz, distinguir Biblioteca de archivos de Publicaciones. Localizar la
   publicación por postId/texto/fecha y comprobar cuenta Francisco, modo UPLOAD,
   tipo de envío y fecha/zona horaria. No guardar cambios, reprogramar ni pulsar
   publicar: esas acciones pueden iniciar o repetir el envío.
2. Si no existe publicación, comprobar si Mavetio obtuvo 201 de submit, si mostró
   error y si el registro D1 quedó pending/unknown. No exportar HAR ni secretos.
3. Si DRAFT, no había un envío solicitado. Si QUEUE y venció la fecha, revisar
   en modo lectura la salud de Temporal y del proceso orchestrator, conexión
   configurada a Temporal y consumidores de las colas main/tiktok. Si existe
   acceso a Temporal UI, buscar workflow `post_<postId>` y actividad pendiente.
   No reiniciar, reejecutar ni cambiar configuración como parte del diagnóstico.
4. Si ERROR, conservar solo mensaje sanitizado y fecha. Puede ser formato,
   permisos, cuota, transferencia o resultado incierto: no inferirlo sin error.
5. Si PUBLISHED, consultar la cuenta exacta en la app móvil TikTok, notificaciones
   de bandeja y vídeo recibido. No buscarlo únicamente en el perfil. Postiz advierte
   que el usuario debe completar el flujo dentro de 24 horas; un envío antiguo
   puede ya no estar disponible para una grabación.
6. Si hace falta evidencia técnica adicional, obtener de los registros internos
   de Postiz únicamente estado TikTok/fail_reason y tiempos relativos al postId;
   nunca compartir tokens, cabeceras, cookies ni URLs de subida firmadas.

## Duplicados y reconexión

Mavetio no reintenta automáticamente POST /posts. Registra la intención antes de
enviarla; un timeout deja D1 unknown y reutilizar el mismo requestId devuelve 409.
Una respuesta completada se reutiliza sin otro POST. El navegador bloquea el envío
incierto y conserva un marcador en sessionStorage. Una nueva clave manual no es
deduplicación global: comprobar Postiz y TikTok antes de preparar otro envío.

La corrección anterior de reconexión sigue en el código: abre `/launches` y bloquea
`refresh` desde Mavetio. La versión anterior confundía ID de registro con internalId
del proveedor. Si producción aún inicia ese OAuth, verificar qué versión del
frontend/backend está desplegada; no reautorizar Francisco para diagnosticarlo.

## Demostración

Usar primero el envío existente. Mostrar cuenta, postId, modo UPLOAD, estado
actualizado y vídeo en la bandeja de esa misma cuenta. Detenerse antes de Publicar
en TikTok. Si no hay vídeo verificable, no afirmar entrega: falta completar el
diagnóstico. Un nuevo ensayo requerirá autorización separada. No demostrar
video.publish ni Direct Post con este flujo.
