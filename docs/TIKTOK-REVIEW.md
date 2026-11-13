# TikTok Sandbox y revisión

## Alcance real

La aplicación prepara vídeos y los envía a la bandeja de TikTok mediante Postiz (`UPLOAD`). Guarda borradores y programa envíos reales cuando se configura el servicio. El usuario termina la publicación en TikTok. `PUBLISHED` de Postiz en este modo significa entrega a la bandeja, no visibilidad en el perfil.

Direct Post está pendiente y se rechaza en el backend. Una pantalla o un vídeo demostrativo por sí solos no garantizan aceptación.

## Decisión de integración

Se revisaron la [API de herramientas de Postiz](https://docs.postiz.com/public-api/integrations/settings) y el [proveedor oficial TikTok](https://github.com/gitroomhq/postiz-app/blob/main/libraries/nestjs-libraries/src/integrations/social/tiktok.provider.ts). El proveedor consulta información del creador internamente para duración, pero no expone una herramienta pública documentada con todas las capacidades requeridas para la interfaz Direct Post.

Por ello no se usa un método supuesto como `creatorInfo`, no se recogen tokens TikTok desde el navegador y no se reconstruye su OAuth. Para activar Direct Post debe añadirse primero una capacidad soportada en Postiz (o acordarse una extensión allí) que entregue las opciones vigentes del creador. Después se implementará y probará la experiencia requerida, incluida su revalidación al confirmar. No basta cambiar `UPLOAD` por `DIRECT_POST`.

## Requisitos de TikTok que afectan al proyecto

Las [guías oficiales](https://developers.tiktok.com/docs/en/content-sharing-guidelines) exigen para Direct Post información actual del creador, privacidad elegida sin valor predeterminado, controles de interacción sujetos a capacidades, límite de duración, declaraciones comerciales, consentimiento y seguimiento de estado. Los clientes sin auditoría tienen restricciones de privacidad y usuarios. La finalidad tampoco debe limitarse a las cuentas del equipo interno.

La implementación actual es de una sola organización. Si Mavetio solicitará una app destinada a creadores externos, debe concretar ese producto y ampliar el aislamiento de usuarios/organizaciones antes de presentarla como tal. No declares funcionalidades, aprobación ni alcance que aún no existan.

## Preparación externa

1. Decide si usarás Postiz Cloud o una instancia propia. Para revisar una app TikTok de Mavetio con credenciales Sandbox propias necesitas que la instancia permita configurar ese cliente; no asumas que Postiz Cloud usa tu app.
2. Crea/configura la app y su Sandbox en TikTok Developers. Añade los usuarios de prueba y verifica los productos y scopes realmente concedidos. La disponibilidad depende de la app.
3. Configura `TIKTOK_CLIENT_ID` y `TIKTOK_CLIENT_SECRET` exclusivamente en Postiz. Reinicia ese servicio según su procedimiento.
4. Registra el callback que Postiz emite. En el proveedor revisado se construye como `${FRONTEND_URL}/integrations/social/tiktok`; confirma el valor exacto de tu instancia en la autorización, incluidos esquema y host. No uses social.mavetio.com como callback salvo que ese sea realmente el frontend de Postiz.
5. Comprueba el conjunto de scopes pedido por la versión instalada de Postiz. El proveedor revisado pide más que `video.upload`; si Sandbox no concede alguno, resuelve esa incompatibilidad en Postiz y en el registro de la app, sin inventar un flujo alternativo en Mavetio.
6. Si el mecanismo multimedia de tu instancia usa descarga desde URL, verifica en TikTok la propiedad del dominio/prefijo que aloja los vídeos. El dominio del frontend y el dominio de almacenamiento pueden ser distintos.
7. Configura Access para que las identidades de prueba/revisión puedan entrar. Publica las páginas legales y comprueba los enlaces en incógnito.

`TIKTOK_SANDBOX=true` solo muestra un aviso de preparación en Mavetio. **No cambia endpoints ni credenciales de TikTok y no activa Sandbox por sí mismo.**

## Guion demostrable

- Mostrar la página pública y sus enlaces legales.
- Iniciar sesión en el dashboard mediante Access.
- Conectar una cuenta mediante OAuth de Postiz y volver al panel. Mostrar la cuenta que devuelve la API.
- Seleccionar un vídeo original, reproducirlo y editar título y descripción.
- Mostrar que el destino y el modo son explícitos; explicar que privacidad e interacciones se eligen al finalizar en TikTok.
- Dar consentimiento y enviar. Mostrar el ID devuelto por Postiz y actualizar el estado.
- Abrir la bandeja de TikTok, revisar las opciones y completar la publicación. Confirmar su resultado en la app.
- Realizar y documentar un envío programado con su hora y zona; confirmar que Postiz lo procesa a esa hora.
- Mostrar un fallo real controlado, cuando esté disponible, y que su mensaje no se sustituye por éxito.

No hay un vídeo de demostración incluido: requiere credenciales, una cuenta autorizada y material propio. No se ha realizado ningún envío a TikTok durante el desarrollo.

## Antes de presentar

- [ ] Dominio HTTPS desplegado y accesible.
- [ ] Textos legales publicados en mavetio.com, con contacto y procedimiento de eliminación.
- [ ] App/credenciales de TikTok identificadas; permisos y callback verificados en Postiz.
- [ ] Recorrido OAuth probado con una cuenta Sandbox real.
- [ ] Subida, envío, recepción y finalización comprobados; IDs y horas registrados.
- [ ] Acceso para revisión probado desde una sesión nueva.
- [ ] Grabación que muestra exclusivamente capacidades disponibles.
- [ ] Alcance y audiencia declarados coherentes con el producto real.

Referencias adicionales: [registro y Sandbox](https://developers.tiktok.com/docs/en/getting-started-create-an-app), [estados de publicación](https://developers.tiktok.com/docs/en/content-posting-api-reference-get-video-status), [configuración TikTok de Postiz](https://docs.postiz.com/public-api/providers/tiktok).
