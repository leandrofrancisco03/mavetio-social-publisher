# Diagnóstico del 502 de Postiz — 13 de noviembre de 2026

## Causa demostrada y alcance

El cliente anterior configuraba `fetch(..., { redirect: "error" })`. Cloudflare Workers no admite ese modo. En workerd local, con la fecha de compatibilidad del proyecto, construir la solicitud produjo:

```text
TypeError: Invalid redirect value, must be one of "follow" or "manual"
```

Esto sucede antes de enviar la petición. El `catch` de `lib/postiz.ts` descartaba la excepción y devolvía siempre HTTP 502 / `POSTIZ_UNREACHABLE`. Una prueba con fetch sustituido en Node no detectaba esta diferencia de runtime. Ahora se utiliza `manual`, se identifican los 3xx y no se sigue ninguna redirección con la credencial.

Reproducción local, sin claves ni tráfico a Postiz:

```powershell
node scripts/check-worker-redirect.mjs
```

El script usa Miniflare/workerd instalado junto con las herramientas Cloudflare del lockfile. Comprueba que el modo anterior lanza TypeError y el nuevo permite construir la solicitud.

También existía un defecto en la URL de respaldo: faltaba `/api`. Se corrigió a `https://postiz.mavetio.com/api/public/v1`. **No es la causa demostrada de esta incidencia**, porque tanto el `wrangler.jsonc` inspeccionado como su build ya contenían la variable correcta, que tiene prioridad sobre el respaldo.

## Evidencia y límites

- `config()` lee el binding `env` importado de `cloudflare:workers` en cada operación; no usa `process.env` ni variables del navegador. La clave se asigna a Authorization sin añadir Bearer.
- `/integrations` y `/posts?startDate=...&endDate=...` se añaden al prefijo `/api/public/v1` sin perder `/api`.
- Dos GET externos **sin credenciales** desde esta máquina devolvieron 401 JSON, sin redirección. Esto acredita DNS/TLS y alcance local del origen. No valida la clave del Worker ni la ruta de red desde Cloudflare.
- Se comprobó el controlador oficial de Postiz **v2.25.3**: integrations devuelve un array con `identifier` y `disabled`; posts devuelve `{ posts }`. No se modificaron payloads de publicación ni OAuth.
- No se descargaron ni cambiaron secretos, políticas Access, EasyPanel o bases de datos. No hubo publicaciones ni despliegue.

La incompatibilidad de runtime está reproducida y corregida localmente. **No se ha comprobado el resultado en producción con este cambio.** Pueden aparecer otros errores una vez que la solicitud alcance realmente Postiz.

## Clasificación de errores

| Situación | HTTP de la aplicación | Código |
| --- | --- | --- |
| Excepción antes de recibir respuesta (DNS, TLS, socket, runtime) | 502 | `POSTIZ_CONNECTION_ERROR` |
| Timeout propio durante fetch o lectura | 504 | `POSTIZ_TIMEOUT` |
| Cancelación por el llamador | 408 | `POSTIZ_ABORTED` |
| Interrupción leyendo el cuerpo | 502 | `POSTIZ_BODY_ERROR` |
| Redirección del origen | 502 | `POSTIZ_REDIRECT` |
| Autenticación/permisos del origen | 401 / 403, preservado | `POSTIZ_AUTH_ERROR` |
| Endpoint inexistente | 404 | `POSTIZ_NOT_FOUND` |
| Error de servidor del origen o proxy | 5xx original | `POSTIZ_UPSTREAM_ERROR` |
| Límite de solicitudes | 429 | `POSTIZ_429` |
| Otros rechazos HTTP | 4xx original | `POSTIZ_<status>` |
| Respuesta exitosa con JSON inválido/vacío | 502 | `POSTIZ_INVALID_JSON` |
| JSON válido con estructura incompatible | 502 | `POSTIZ_SCHEMA` |
| Clave ausente / URL inválida | 503 | `POSTIZ_NOT_CONFIGURED` / `POSTIZ_CONFIG` |

Un HTTP 504 recibido del origen es `POSTIZ_UPSTREAM_ERROR`; el timeout de esta aplicación es `POSTIZ_TIMEOUT`. Un 401 Postiz no implica que Cloudflare Access haya fallado. Un error HTTP HTML se clasifica por su estado, no como fallo JSON. Los errores de esquema de posts ya no se confunden con datos de entrada inválidos (400).

## Observabilidad segura

Cada fallo de transporte/respuesta genera `console.error("[postiz.request.failed]", ...)` con endpoint **sin query**, código de error, estado HTTP (null si nunca llegó), tiempo transcurrido y nombre/mensaje sanitizado de excepción. Cuando el runtime proporciona una causa se incluye su mensaje sanitizado y un código de red conocido.

No se registran cabeceras, cookies, cuerpos, tokens, claves, objetos completos de excepción ni Location. Los errores de JSON y HTTP usan mensajes descriptivos sin el cuerpo original. Los valores de ambos secretos se eliminan antes de registrar cualquier mensaje; también se eliminan URL y campos sensibles reconocibles. No se registra el contenido de publicaciones. DNS/TLS solo pueden distinguirse cuando el runtime facilita el detalle: un TypeError genérico no permite adivinar su causa.

## Comprobación del build

```powershell
npm run typecheck
npm test
node scripts/check-worker-redirect.mjs
npm run build
node scripts/verify-worker-config.mjs
```

El último script compara todas las `vars` de origen con `dist/server/wrangler.json`, verifica el prefijo exacto y que las claves sigan fuera de `vars`. También contrasta las opciones de dominio, fecha y seguridad de Workers. Los secretos se inyectan al ejecutar el Worker: no deben aparecer en el JSON generado. No edites manualmente `dist/`.

## Verificar después de tu despliegue

1. Despliega el build revisado por tu procedimiento habitual. Este trabajo no lo despliega automáticamente.
2. En una terminal autorizada, abre un tail temporal:

   ```powershell
   npx wrangler tail mavetio-social-publisher --format pretty
   ```

3. Inicia sesión con Access y pulsa Actualizar en el panel. Comprueba los GET de config, integrations y posts. No pulses enviar/publicar.
4. Esperado: integrations y posts devuelven 200 y muestran exclusivamente los datos reales de la organización. La prueba no requiere crear publicaciones.
5. Si falla, recoge únicamente el evento `[postiz.request.failed]` sanitizado y el JSON de error de la aplicación. Anota fecha/hora, versión desplegada y ruta consultada. No compartas un HAR, cookies, cabeceras, tokens ni el valor de la clave.
6. Si aparece `POSTIZ_AUTH_ERROR`, confirma en el entorno correcto que existe el secreto, sin mostrarlo, y contrasta su autorización con la credencial que funciona en n8n. Si hay `POSTIZ_REDIRECT`, revisa la ruta/regla responsable sin seguir la redirección con la clave. Ante DNS/TLS/5xx, correlaciona el evento con los registros del proxy/Postiz; no desactives TLS ni Access para probar.

Para confirmar la resolución todavía falta el resultado de esos GET y, si fallan, el nuevo evento seguro **desde la versión desplegada**. Las consultas locales sin credenciales y las pruebas unitarias no sustituyen esa evidencia.

Fuentes: [Cloudflare Request y modos de redirección](https://developers.cloudflare.com/workers/runtime-apis/request/), [Cloudflare Fetch](https://developers.cloudflare.com/workers/runtime-apis/fetch/), [controlador público Postiz v2.25.3](https://github.com/gitroomhq/postiz-app/blob/v2.25.3/apps/backend/src/public-api/routes/v1/public.integrations.controller.ts).
