# Direct Post: análisis histórico de la API estándar v2.25.3

**Actualización:** este documento conserva el análisis de la API estándar. Ya se
preparó una extensión privada y el flujo condicionado en Mavetio; ver
[instalación, validación y rollback](../extensions/postiz/README.md). La activación
sigue deshabilitada por defecto y pendiente de validar la imagen personalizada.
Las menciones siguientes a funcionalidad no implementada describen el estado
anterior a esa extensión, no el nuevo código condicionado.

**Documento vigente para operar la versión personalizada:** [extensions/postiz/README.md](../extensions/postiz/README.md).

## Resultado

El usuario confirmó recepción real de UPLOAD desde Mavetio y Direct Post SELF_ONLY
desde el panel de Postiz. No se repitieron esas operaciones durante esta revisión.
UPLOAD conserva payload, recibos, consentimiento, D1 y prevención de duplicados.
Direct Post desde Mavetio permanece deshabilitado: el contrato público permite
crear el post, pero no proporciona la información dinámica necesaria para construir
una interfaz conforme. No se ha implementado ni anunciado un envío Direct Post listo.

## Qué expone la versión revisada

| Interfaz real | Alcance |
| --- | --- |
| GET /integrations | ID de registro, nombre y estado; no permisos OAuth actuales ni creator_info |
| GET /integration-settings/:id | Esquema DTO, reglas, herramientas y longitud de texto; no consulta creator_info |
| POST /integration-trigger/:id | Solo métodos registrados como herramientas; no permite invocar cualquier función del proveedor |
| POST /posts | Acepta DIRECT_POST y los ajustes del DTO TikTok |
| GET /posts | Estados y errores de Postiz; no constituye comprobación directa independiente en TikTok |

El proveedor `tiktok` tiene `maxVideoLength(accessToken)`: llama internamente a
creator_info y devuelve solo la duración. No está registrado como herramienta
invocable por integration-trigger ni expone privacidad/interacciones/nickname.
No debe llamarse a un supuesto `creatorInfo` ni usar el esquema estático como
si describiera la cuenta. Una cuenta habilitada no acredita todos los permisos
vigentes. El éxito previo de SELF_ONLY no sustituye consultar al creador al abrir
la pantalla. No se probaron endpoints mutadores contra producción.

## Contrato de publicación comprobado (no habilitado en Mavetio)

POST /posts utiliza `type: now|schedule`, fecha, `posts[].integration.id`,
`value[].content` y `value[].image` con el medio de Postiz. En settings:

| Campo | Interpretación del proveedor de vídeo |
| --- | --- |
| __type | tiktok |
| content_posting_method | DIRECT_POST; UPLOAD sigue enviándose explícitamente |
| title | Campo del DTO; para vídeo el proveedor usa el contenido combinado como título TikTok |
| privacy_level | Debe ser una opción vigente elegida explícitamente; jamás omitirla, pues el proveedor tiene fallback público |
| comment, duet, stitch | Booleanos de permitir; Postiz los invierte a disable_* |
| brand_organic_toggle | Promoción propia |
| brand_content_toggle | Promoción de terceros |
| video_made_with_ai | Etiqueta IA para vídeo |
| autoAddMusic | yes/no en DTO; no implementa selección musical para vídeo del proveedor tiktok |

No confundir el proveedor `tiktok` con TikTok Business; no se añade otra integración.
La declaración musical es consentimiento en la interfaz, no un parámetro que el
DTO de Postiz haga cumplir. No se envían ajustes comerciales/IA de UPLOAD como si
TikTok los aplicara.

## Ampliación necesaria del backend de Postiz

Propuesta de capacidad, **no endpoint existente ni implementado**:

1. Una herramienta o interfaz autorizada en Postiz que verifique pertenencia del
   canal a la organización y consulte `POST /v2/post/publish/creator_info/query/`
   usando el token ya custodiado por Postiz. Requiere `video.publish`.
2. Devolver solo nickname/username, privacy_level_options, comment_disabled,
   duet_disabled, stitch_disabled, max_video_post_duration_sec y error/fecha de
   consulta. Un HTTP 200 con error distinto de ok bloquea el envío.
3. Nunca devolver tokens, cookies ni códigos. No aceptar como verdad permisos o
   creator_info enviados por el navegador. Gestionar vencimiento/errores sin una
   segunda integración OAuth. No prometer un campo can_post que TikTok no devuelve:
   las prohibiciones/cuotas se expresan mediante errores.
4. En Mavetio, consultar al renderizar/cambiar cuenta y revalidar antes de enviar;
   invalidar selección y consentimiento si cambian restricciones. Para programación,
   garantizar también validación al ejecutar sin ampliar privacidad silenciosamente.

## Interfaz y validaciones pendientes antes de habilitar

- Privacidad inicialmente vacía: opciones obtenidas del creador, intersectadas con
  la política SELF_ONLY mientras dure la restricción de la app. Si SELF_ONLY no
  aparece, bloquear; nunca inventar una opción ni usar el banner Sandbox como prueba.
- Mostrar identidad actual y validar duración del archivo contra el máximo real.
- Comentarios/dúos/Stitch apagados inicialmente y deshabilitados según restricciones.
- Divulgación comercial apagada inicialmente. Si se activa, exigir marca propia o
  terceros. Terceros es incompatible con SELF_ONLY: bloquear esa combinación, sin
  cambiarla a pública. Etiquetas y declaraciones de políticas según selección.
- Etiqueta IA de vídeo y consentimiento musical con enlace a Music Usage Confirmation;
  para terceros, declaración de Branded Content Policy aplicable.
- Vista previa, texto editable, consentimiento y confirmación final antes de subir
  o enviar. No transferir contenido anticipadamente.
- Mantener aceptación separada de publicación. Registrar respuesta e incertidumbre
  usando la misma clave D1 y evitar reintentos mutadores tras timeout.

Actualmente no se muestran controles Direct Post funcionales con datos supuestos.
El selector continúa deshabilitado y explica el bloqueo. Una petición forzada con
DIRECT_POST recibe 409 DIRECT_POST_UNAVAILABLE antes de consultar Postiz o escribir
D1, incluso si el cliente declara permisos o selecciona SELF_ONLY.

## Demostración

UPLOAD está confirmado por el usuario: mostrar el recorrido y la notificación
«Tu contenido de Mavetio Social Publisher está listo», distinguiendo bandeja de
publicación final. No hace falta repetir un envío para esta revisión del código.
Direct Post puede mostrarse como función del panel Postiz si se identifica como
tal; no presentarlo como función habilitada en Mavetio. No afirmar aprobación de
TikTok ni justificar video.publish con una demostración exclusiva de UPLOAD.
La demostración Direct Post desde Mavetio queda pendiente de la ampliación y las
validaciones anteriores. TikTok también exige un producto para una audiencia amplia,
no exclusivamente una herramienta para cuentas internas.

## Fuentes

- [Controlador público v2.25.3](https://github.com/gitroomhq/postiz-app/blob/v2.25.3/apps/backend/src/public-api/routes/v1/public.integrations.controller.ts)
- [Proveedor TikTok v2.25.3](https://github.com/gitroomhq/postiz-app/blob/v2.25.3/libraries/nestjs-libraries/src/integrations/social/tiktok.provider.ts)
- [DTO TikTok v2.25.3](https://github.com/gitroomhq/postiz-app/blob/v2.25.3/libraries/nestjs-libraries/src/dtos/posts/providers-settings/tiktok.dto.ts)
- [Creator Info](https://developers.tiktok.com/docs/en/content-posting-api-reference-query-creator-info)
- [Content Sharing Guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines)
