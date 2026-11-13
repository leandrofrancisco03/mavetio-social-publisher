# Desplegar en Cloudflare Workers

## 1. Preparar la cuenta y el dominio

Necesitas acceso a Cloudflare y a la zona `mavetio.com`, un entorno Postiz operativo y credenciales de su API pública. La aplicación no aloja Postiz ni n8n dentro del Worker.

```powershell
npm ci
npx wrangler login
npx wrangler d1 create mavetio-social-publisher
```

Copia el `database_id` devuelto a `d1_databases[0].database_id` en `wrangler.jsonc`. El ID actual, compuesto de ceros, es un marcador para desarrollo. `npm run deploy` se detiene si no se sustituye.

```powershell
npx wrangler d1 migrations apply mavetio-social-publisher --remote
```

La migración crea exclusivamente la tabla de solicitudes y un índice. D1 almacena identificador de usuario, hash de la solicitud, estado y referencias de publicaciones. Los vídeos se almacenan en Postiz, no en D1 ni en el disco del Worker.

## 2. Configurar Cloudflare Access

En Zero Trust, crea una aplicación Access de tipo self-hosted para los paths privados de `social.mavetio.com`:

- `/dashboard` y sus subrutas.
- `/api/publisher/*`.

Incluye ambos destinos en **la misma aplicación Access**, para que compartan audiencia. Deja `/` y los recursos estáticos públicos. Configura una política Allow con las identidades concretas autorizadas (por ejemplo, correo + OTP o tu proveedor SSO). No uses una regla de acceso para todo el mundo ni un Bypass sobre los paths privados. Añade el correo de revisión cuando corresponda.

La aplicación también valida el JWT en cada página privada y petición API: no basta con enviar una cabecera de correo. No acepta service tokens sin identidad humana para publicar; n8n utiliza su propia credencial Postiz.

Añade a `vars` en `wrangler.jsonc` los dos valores no secretos de tu aplicación Access:

```json
"CF_ACCESS_TEAM_DOMAIN": "tu-equipo.cloudflareaccess.com",
"CF_ACCESS_AUD": "audiencia-de-la-aplicacion"
```

También pueden suministrarse como secretos Wrangler si prefieres mantenerlos fuera del repositorio. `CF_ACCESS_TEAM_DOMAIN` nunca es el dominio de la web: es el dominio del equipo Zero Trust.

`workers_dev: false` y `preview_urls: false` evitan publicar URLs alternativas sin la política del dominio. La validación de JWT sigue siendo obligatoria en el código.

## 3. Configurar Postiz y los secretos

Para Postiz Cloud usa los valores de API y web existentes. En una instancia propia cambia ambos valores de forma explícita:

```json
"POSTIZ_API_URL": "https://postiz.tu-dominio.com/api/public/v1",
"POSTIZ_WEB_URL": "https://postiz.tu-dominio.com"
```

La clave se obtiene en la configuración de desarrolladores de Postiz. Se envía en la cabecera Authorization sin prefijo Bearer, solo desde el servidor. No utilices variables `NEXT_PUBLIC_` para secretos.

```powershell
npx wrangler secret put POSTIZ_API_KEY
npx wrangler secret put MEDIA_SIGNING_SECRET
```

Wrangler solicita cada valor sin colocarlo en el comando. Para `MEDIA_SIGNING_SECRET`, genera y conserva una cadena aleatoria de al menos 32 caracteres, por ejemplo con un gestor de contraseñas. Rotarla invalida los recibos multimedia pendientes. Los secretos permanecen en Cloudflare y no se incluyen en el build.

Los secretos de TikTok (`TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET`) se configuran **en Postiz**, nunca en este Worker. No registres `/api/auth/callback/tiktok` en Mavetio: esa ruta no existe y no es necesaria.

## 4. Confirmar las páginas legales

Los enlaces están visibles en la página pública y en el panel:

| Variable       | Ruta prevista                              |
| -------------- | ------------------------------------------ |
| `PRIVACY_URL`  | `https://mavetio.com/privacidad`           |
| `TERMS_URL`    | `https://mavetio.com/terminos`             |
| `DELETION_URL` | `https://mavetio.com/eliminacion-de-datos` |

La web de Mavetio enlaza `/privacidad`. No se ha confirmado el contenido actual ni la publicación de las otras dos rutas. Publica las páginas correspondientes o sustituye las variables por sus URL definitivas. Deben ser accesibles sin iniciar sesión y describir el funcionamiento y tratamiento de datos reales de Social Publisher. Este proyecto no publica documentos legales en mavetio.com.

## 5. Validar y desplegar

```powershell
npm run typecheck
npm test
npm run check
npm run build
npm run deploy:dry
npm run deploy
```

El proyecto se inicializó con el modo Wrangler oficial de vinext (`--legacy-wrangler-cloudflare-init`). Las versiones recientes de vinext usan `cf` y `cloudflare.config.ts` por defecto; aquí se conserva deliberadamente Wrangler, como requiere este proyecto. No mezcles ambas configuraciones.

`npm run deploy` recompila y usa `dist/server/wrangler.json`, generado desde el archivo raíz. No edites `dist/`: los cambios se perderían al compilar. En CI, establece `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN` en el almacén de secretos de tu proveedor, con los permisos mínimos para Workers, dominio y D1.

La configuración incluye:

```json
"routes": [{ "pattern": "social.mavetio.com", "custom_domain": true }]
```

Wrangler registra el Custom Domain y Cloudflare gestiona DNS y TLS en la zona autorizada. Si ya existe un registro incompatible para `social`, resuelve ese conflicto en Cloudflare antes de desplegar. No se ha cambiado ningún DNS en esta entrega.

## 6. Verificar producción

1. Abre `https://social.mavetio.com/` en incógnito: debe ser pública, con CSS y enlaces legales válidos.
2. Abre `/dashboard`: Access debe solicitar autenticación. La API no debe devolver datos a un usuario no autorizado.
3. Entra con una identidad autorizada. Comprueba cuentas y publicaciones; un error debe ser visible, nunca sustituido por datos de muestra.
4. Autoriza TikTok con Postiz. Vuelve al panel y actualiza las cuentas.
5. Envía un vídeo de prueba propio y comprueba la respuesta, cola y bandeja de TikTok. Completa la publicación en TikTok. Registra el ID y el resultado.
6. Programa otro envío en el futuro y verifica que UTC corresponde a la hora local elegida.
7. Revisa el historial real antes de repetir cualquier solicitud con resultado desconocido.

No marques el proyecto como validado para TikTok hasta completar las pruebas de [TIKTOK-REVIEW.md](TIKTOK-REVIEW.md).

## Desarrollo y operación

`.dev.vars` es local y está ignorado. En desarrollo usa `APP_URL=http://localhost:3001` o el origen exacto de tu staging/túnel autorizado. Usa siempre el mismo host al navegar para que la comprobación de origen sea consistente.

Si Windows restringe la escritura de logs de Wrangler, puedes ubicarlos en el workspace:

```powershell
$env:WRANGLER_LOG_PATH = Join-Path (Get-Location) '.wrangler/logs'
```

El límite de 25 MB es una decisión conservadora para evitar presión de memoria en Workers al procesar multipart; no representa el límite general de TikTok. Archivos mayores requieren diseñar una subida directa firmada al almacenamiento de Postiz. No se admite subida desde una URL arbitraria.

En Windows, detén `npm run preview` antes de recompilar: Wrangler puede mantener abiertos archivos de `dist/` y causar un error EPERM durante la limpieza del build. Para trabajar con recarga automática, usa `npm run dev`.

La programación se ejecuta en Postiz aunque el navegador esté cerrado. No hay cron ni scheduler duplicado en el Worker. La consulta de estados es manual para respetar los límites de la instancia; el botón Actualizar no vuelve a publicar.

Mantén el registro de solicitudes durante el periodo en que un usuario pueda reintentar operaciones. No elimines filas pending/unknown sin reconciliarlas con Postiz. Para una política de retención diferente, implementa antes un procedimiento explícito de reconciliación y eliminación de datos.
