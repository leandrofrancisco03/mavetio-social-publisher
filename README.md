# Mavetio Social Publisher

Aplicación independiente en español para preparar vídeos y gestionar envíos a TikTok mediante Postiz. Dominio previsto: **https://social.mavetio.com**.

Implementada con Next.js App Router, TypeScript, React y Tailwind CSS. La ejecución y compilación utilizan **vinext + Vite + Cloudflare Workers**, con Wrangler y D1. No hay cuentas, publicaciones ni respuestas de API simuladas en la aplicación.

## Qué está implementado

- Página pública responsive que explica el flujo disponible.
- Dashboard protegido por Cloudflare Access; el servidor verifica firma, emisor, audiencia y caducidad del JWT.
- Consulta de cuentas y publicaciones reales de una organización Postiz, filtros por fechas/estado y errores del proveedor.
- Conexión y reconexión TikTok con la URL OAuth generada por Postiz. Postiz conserva el callback, los tokens y su renovación.
- Editor con selección de cuenta, vídeo MP4/MOV hasta 25 MB, vista previa local, título, descripción, consentimiento, borrador o envío inmediato/programado.
- Subida a Postiz exclusivamente mediante backend. Recibos multimedia firmados, ligados al usuario y con caducidad de dos horas.
- Registro D1 de solicitudes para no reenviar automáticamente una operación cuyo resultado se desconoce.
- Enlaces legales configurables en mavetio.com.

**Modo TikTok disponible: `UPLOAD`.** El vídeo llega a la bandeja de TikTok y el usuario termina de publicarlo allí. Privacidad, interacciones y etiquetas comerciales/IA se configuran en TikTok: este modo no aplica esos campos enviados por API. El panel no presenta una entrega a la bandeja como una publicación visible en el perfil.

**Direct Post está bloqueado y marcado pendiente.** La API pública y el proveedor Postiz revisados no ofrecen una herramienta pública documentada que entregue todo `creator_info`. No se han inventado endpoints ni duplicado la autenticación de TikTok. Ver [la preparación de Sandbox y revisión](docs/TIKTOK-REVIEW.md).

## Arranque local

Recomendado: Node.js 24 LTS y npm. El lockfile fija las versiones instaladas.

```powershell
npm ci
Copy-Item .dev.vars.example .dev.vars
npm run db:local
npm run dev
```

Abre http://localhost:3001. Sin credenciales, la página pública funciona y el dashboard muestra que Access está pendiente. **No hay bypass local de autenticación.** Para probar el panel completo utiliza un dominio de staging protegido por Access o un túnel propio con Access y configura `APP_URL` con su origen exacto. No publiques un túnel sin protección para facilitar pruebas.

El proyecto sirve a **una organización** Postiz; todos los usuarios admitidos por la política Access comparten esa organización. No es todavía un SaaS multiempresa. Para clientes independientes se necesita aislamiento de organizaciones y OAuth2 de Postiz por usuario.

## Comandos

| Comando              | Función                                             |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Desarrollo vinext en el runtime de Workers          |
| `npm run typecheck`  | Comprobación TypeScript                             |
| `npm test`           | 21 pruebas de autenticación, contratos y seguridad  |
| `npm run check`      | Análisis de compatibilidad vinext                   |
| `npm run build`      | Compilación RSC, SSR y cliente para Workers         |
| `npm run preview`    | Ejecutar el Worker compilado en localhost           |
| `npm run deploy:dry` | Empaquetado de despliegue sin publicar              |
| `npm run db:local`   | Aplicar la migración D1 local                       |
| `npm run deploy`     | Validar ID de D1, compilar y desplegar con Wrangler |

Para producción sigue [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Incluye secretos, Access, D1 y el dominio personalizado.

## Estado de la entrega

Verificación local: TypeScript, 21 pruebas, análisis vinext, compilación, empaquetado Wrangler y migración D1 local. La página pública y el bloqueo del dashboard se revisaron en navegador en escritorio y móvil. El panel autenticado no se ha probado visualmente con una sesión Access real.

No se ha desplegado en Cloudflare ni conectado una cuenta real. Faltan el ID de D1, secretos, política Access, configuración de Postiz y pruebas con TikTok. Las URL de términos y eliminación de datos son rutas previstas: deben publicarse o sustituirse antes de solicitar revisión. Facebook, Instagram y flujos n8n están pendientes; se documenta su extensión, sin botones que simulen su funcionamiento.

La compilación actual emite avisos del framework sobre sourcemaps y optimización de iconos, sin errores de compilación. `npm audit` no detecta vulnerabilidades tras fijar `fflate` en su parche 0.7.5. Vinext sigue bajo desarrollo activo; el análisis de compatibilidad no sustituye pruebas con servicios reales.

## Estructura

```text
app/                  Página pública, dashboard y rutas HTTP
components/           Interfaz y editor de vídeos
lib/                  Access, cliente Postiz, validación y contratos
migrations/           Registro D1 de solicitudes
tests/                Pruebas aisladas (dobles solo en tests)
docs/                 Despliegue, arquitectura y revisión TikTok
wrangler.jsonc        Worker, dominio, variables y bindings
vite.config.ts        Vinext, Tailwind y Cloudflare
```

Documentación oficial consultada el 12 de noviembre de 2026:

- [Cloudflare: Next.js](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
- [Vinext: despliegue Cloudflare](https://vinext.dev/docs/deploying/cloudflare)
- [Postiz: API pública](https://docs.postiz.com/public-api/introduction)
- [Postiz: conexión OAuth](https://docs.postiz.com/public-api/integrations/connect)
- [Postiz: TikTok](https://docs.postiz.com/public-api/providers/tiktok)
- [TikTok: Content Sharing Guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines)
- [Cloudflare: validar JWT Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
