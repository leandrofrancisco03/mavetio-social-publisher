# POSTIZ_SCHEMA en GET posts — Postiz v2.25.3

## Causa reproducida

La muestra adjunta contiene `settings` como **string JSON** en los tres elementos. El esquema anterior exigía un objeto `{ content_posting_method?: string }` o null/undefined. Zod informó exactamente tres errores `invalid_type`, en `posts[0].settings`, `posts[1].settings` y `posts[2].settings`. Ninguna otra propiedad de esa muestra causó rechazo.

La prueba del endpoint con la muestra produjo 502 antes del cambio. Después devuelve 200 y una respuesta igual a la muestra completa. Las pruebas guardan la muestra únicamente en `tests/fixtures/postiz-v2.25.3-posts.json`; no se utiliza como dato de la aplicación ni se escribe en logs.

## Corrección

- `lib/postiz-posts.ts`: contrato compartido de `{ posts: [...] }`. Acepta settings string, objeto (compatible con el formato anterior), null u omitido. Conserva releaseId, intervalInDays, group, creationMethod, tags y metadatos de integración presentes en la muestra. Los estados se preservan como cadenas para no rechazar nuevos estados del proveedor.
- `lib/types.ts`: SocialPost se deriva del contrato. La lectura de settings es defensiva, no modifica el campo original ni falla ante JSON inválido, arrays o primitivas. Las etiquetas conservan el estado informado por Postiz.
- `app/api/publisher/[action]/route.ts`: utiliza el contrato compartido; sigue consultando la API real. No modifica estados ni elimina mensajes históricos. Mantiene la protección existente que oculta secretos en mensajes de error.
- `components/dashboard.tsx` y `app/globals.css`: la lista compartida entre Vista general y Publicaciones identifica red, cuenta, fecha y estado. ERROR muestra «Error de publicación»; un mensaje en otros estados se presenta como histórico, sin convertir el registro en un error actual.
- El HTML se convierte únicamente para presentación a texto y se renderiza en nodos de texto React. No se usa innerHTML. Las entidades decodificadas también se escapan al renderizar. El contenido original de la API se conserva.

No cambian autenticación, Access, secretos, OAuth, escrituras, configuración de Workers ni el cliente HTTP de Postiz.

## Verificación automatizada

`tests/postiz-posts.test.ts` añade la reproducción del esquema anterior, el endpoint con la muestra real, preservación de null y campos opcionales, estados, listas vacías, strings de settings inválidos, formatos objeto/null, diferencias TikTok/YouTube, renderizado de la lista y casos XSS. Incluye el caso PUBLISHED con error histórico y comprueba que ambos se conserven.

Comandos de validación:

```powershell
npm run typecheck
npm test
npm run build
node scripts/verify-worker-config.mjs
```

## Despliegue manual

Tras revisar el cambio, desde el proyecto y con tu sesión Cloudflare autorizada:

```powershell
npm run deploy
```

Este comando ejecuta la comprobación previa, recompila y despliega con `dist/server/wrangler.json`. No es necesario volver a introducir ni rotar secretos. No se ha ejecutado durante esta corrección. En Windows, detén una vista previa local que esté usando `dist/` antes de recompilar.

## Comprobar las cinco publicaciones reales

1. Entra al dashboard con Access y abre Publicaciones. Usa **el mismo rango startDate/endDate de n8n** que devolvió cinco registros; las fechas del filtro son UTC.
2. Selecciona Todos los estados y pulsa Actualizar. En Network, el GET `/api/publisher/posts` debe devolver HTTP 200 con cinco elementos. No envíes ningún vídeo para esta prueba.
3. Confirma tres PUBLISHED y dos ERROR, comparando los IDs con n8n. Los mensajes históricos no deben aumentar el número de errores: ese recuento se basa en `state`.
4. Comprueba que la publicación TikTok PUBLISHED con error histórico mantenga el estado principal publicado y muestre el mensaje histórico por separado; la publicación ERROR debe conservar su error actual.
5. Comprueba TikTok y YouTube, fechas y destinos HTTPS. Los párrafos HTML deben verse como texto legible, no como etiquetas ejecutables.
6. Vuelve a Vista general: conserva el rango durante esta navegación y muestra hasta cinco publicaciones. Con los cinco registros indicados, deben aparecer los cinco y el contador de errores debe ser dos.

La muestra entregada contiene tres publicaciones representativas, no las cinco completas. Las pruebas no afirman haber consultado las cinco reales ni verifican producción. El resultado final debe confirmarse después de tu despliegue con el rango real de n8n.
