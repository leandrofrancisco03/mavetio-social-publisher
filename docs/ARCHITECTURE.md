# Arquitectura y extensiones

```text
Navegador
  ├─ /                         Página pública
  └─ Cloudflare Access         Login y política de identidades
      └─ Worker vinext         JWT verificado + origen + validación
          ├─ D1                Exclusión de solicitudes repetidas
          └─ Postiz API        Clave solo en backend
              ├─ OAuth TikTok Callback y tokens en Postiz
              ├─ Media        Almacenamiento de vídeos
              └─ Scheduler    Cola y envío → TikTok → usuario finaliza
```

## Fronteras de confianza

- `lib/env.ts` es importado únicamente por módulos del servidor. No se introduce configuración secreta en componentes cliente.
- No hay un proxy abierto a rutas/URLs arbitrarias. El backend ofrece acciones concretas y construye los payloads.
- Los identificadores de cuenta se contrastan con las integraciones de la organización antes de reconectar o enviar.
- Cada mutación requiere JWT válido y Origin exactamente igual a `APP_URL`. El archivo tiene un límite durante la lectura, MIME permitido y comprobación de cabecera; esto no sustituye la validación/transcodificación del proveedor.
- El navegador no puede elegir una URL de vídeo para publicar: el backend firma la respuesta de `/upload` para el usuario, con expiración y audiencia específicas.
- Las respuestas Postiz se reducen a campos necesarios. No se devuelve ni registra su cabecera Authorization. Los mensajes de error se limitan y se ocultan valores de credenciales reconocibles.
- Cabeceras de seguridad, privacidad de caché y bloqueo de framing en `proxy.ts`. No hay caché compartida de contenido privado.

## Garantía de reintentos

Antes de crear un post se hace `INSERT OR IGNORE` en D1 con un UUID. Una segunda petición con ese UUID no vuelve a invocar Postiz. Si ya hay respuesta confirmada y coincide usuario/hash, se devuelve esa respuesta. Si la operación está en curso o quedó incierta, se responde 409. No se reintenta automáticamente después de timeout.

El navegador conserva un marcador de solicitud pendiente en sessionStorage y bloquea el formulario hasta que el usuario revise Postiz. No contiene claves ni tokens sociales. Crear expresamente un nuevo UUID, usar otra pestaña o preparar otro envío puede producir otra publicación del mismo contenido: no es una garantía global de entrega exactamente una vez. Una subida que termina pero cuyo resultado no llega al navegador puede dejar un archivo sin usar en Postiz.

## Contratos usados

| Servicio                                      | Operación                                 |
| --------------------------------------------- | ----------------------------------------- |
| Postiz `GET /integrations`                    | Cuentas reales                            |
| Postiz `GET /social/tiktok`                   | URL de OAuth; `refresh` para reconexión   |
| Postiz `POST /upload`                         | Archivo multipart, devuelve `id` y `path` |
| Postiz `POST /posts`                          | Borrador, envío inmediato o programado    |
| Postiz `GET /posts?startDate=...&endDate=...` | Historial y errores por periodo           |

No se implementan callbacks sociales, renovación de tokens, colas, edición avanzada ni borrado de canales ya resueltos por Postiz. La gestión adicional abre la instancia configurada de Postiz.

## n8n

n8n se conecta directamente a la API de Postiz desde el servidor de n8n, mediante una credencial guardada en su almacén. No expongas una API key en un webhook público ni copies un JWT de usuario de Access a una automatización.

Flujo recomendado: contenido autorizado → aprobación humana → subida a Postiz → creación de borrador/envío → consulta de estados o webhook Postiz → notificación interna. Conserva correlación e idempotencia en n8n; no reutilices `requestId` de este panel ni asumas que el registro D1 cubre operaciones externas.

La ejecución automática y los webhooks no están activados en este proyecto. Su autenticación, eventos y política de reintentos se deben validar contra la instancia real. Para probar el flujo primero usa borradores y material propio.

## Facebook e Instagram

Las cuentas existentes pueden aparecer en el listado real de Postiz, pero el editor permite únicamente TikTok. Para habilitar otras redes se deben añadir contratos tipados de cada proveedor, validación de medios, permisos y controles específicos, además de pruebas con las cuentas de destino. El OAuth continuará en Postiz.

## Multiempresa

La clave actual representa una organización. No admitas clientes independientes en la misma política Access como si sus datos estuvieran aislados. La extensión adecuada es OAuth2 de Postiz, asociación usuario/organización del lado servidor, almacenamiento cifrado de tokens y control de autorización por recurso.

## Datos y eliminación

La desconexión se realiza en Postiz y puede afectar sus publicaciones futuras. El operador debe gestionar por separado medios, registros D1 y datos de n8n según la política publicada en Mavetio. Cerrar la sesión de Access no borra esos datos. El enlace de eliminación de datos no ejecuta un borrado automático.
