# Conexión y reconexión de TikTok

Revisión del código local y del tag Postiz v2.25.3. No se ejecutó OAuth ni se
accedió a tokens, cookies o códigos de producción. No se desplegó.

## Causa y alcance de la evidencia

El botón anterior enviaba `a.id` a POST `/api/publisher/connect`, que llamaba
GET `/api/public/v1/social/tiktok?refresh=<id del registro>`.
La lista pública de Postiz devuelve `integration.id`, no `internalId`.
Postiz guarda `refresh` sin convertirlo en Redis (`refresh:<state>`, una hora).
En el callback compara ese valor con el `id` devuelto por el proveedor. Si
difieren, `migrateIntegration` busca por `internalId` y lanza
“Please refresh the channel that needs to be refreshed” cuando no encuentra
el canal o no corresponde una migración. Mavetio confundía dos identificadores.

El callback obtiene la organización del estado almacenado, no de la selección
actual del navegador. La sesión de Postiz sí importa al gestionar canales desde
su interfaz. Un estado caducado/reutilizado tiene otro error. No hay evidencia
para atribuir el mensaje observado a Cloudflare Access o a permisos TikTok.
No se ha reproducido el intento concreto de producción: la discrepancia está
demostrada en el código, pero no se inspeccionaron sus datos OAuth.

Fuentes fijadas a la versión:

- [API pública: lista y social](https://github.com/gitroomhq/postiz-app/blob/v2.25.3/apps/backend/src/public-api/routes/v1/public.integrations.controller.ts)
- [Callback y consumo del estado](https://github.com/gitroomhq/postiz-app/blob/v2.25.3/apps/backend/src/api/routes/no.auth.integrations.controller.ts)
- [Validación y ruta de gestión /launches](https://github.com/gitroomhq/postiz-app/blob/v2.25.3/libraries/nestjs-libraries/src/database/prisma/integrations/integration.service.ts)
- [Inicio autenticado: redirectUrl y refresh](https://github.com/gitroomhq/postiz-app/blob/v2.25.3/apps/backend/src/api/routes/integrations.controller.ts)

## Corrección

- Conexión nueva: conserva el endpoint público sin `refresh`. Presenta el enlace
  devuelto y validado para abrirlo en otra pestaña con `noopener noreferrer`.
- Reconexión: abre `POSTIZ_WEB_URL` en `/launches`; el usuario selecciona el canal
  en Postiz. No se deduce el internalId ni se añaden parámetros no documentados.
- Peticiones antiguas con `refresh`: 409 `RECONNECT_IN_POSTIZ`, sin llamar a Postiz.
- Retorno: manual a la pestaña conservada, después Actualizar (consultas GET).
  El endpoint público no implementa `redirectUrl`; no prometemos retorno automático
  ni interpretamos volver a la pestaña como OAuth exitoso.

## Ensayo sin afectar cuentas existentes

1. Después de un despliegue autorizado, abrir Cuentas conectadas y anotar los
   estados actuales. Pulsar Gestionar en Postiz junto a Francisco.
2. Verificar nueva pestaña en `/launches`, organización correcta y cuenta correcta.
   No iniciar la reconexión de Francisco: completarla puede sustituir sus tokens.
3. Volver a Mavetio y Actualizar. Esta navegación no autoriza ni desconecta cuentas.
4. Para probar OAuth completo, usar una cuenta TikTok de prueba distinta, autorizada
   en la misma app Sandbox, y un perfil de navegador dedicado. No usar Francisco.
5. Conectar TikTok → Continuar autorización. Comprobar la app y la cuenta antes de
   consentir. Si son incorrectas, cancelar. No recargar ni reutilizar el callback.
6. Tras éxito confirmado en Postiz, volver a Mavetio y Actualizar: verificar nuevo
   canal y que Francisco y YouTube siguen presentes. No publicar ni eliminar nada.
7. No guardar ni compartir URLs de callback, HAR, cookies o cabeceras de autenticación.

Una conexión nueva con una cuenta existente puede actualizar sus tokens mediante
el upsert de Postiz; no es un ensayo inocuo de reconexión.

## Revisión TikTok

OAuth delegado puede mostrar consentimiento TikTok, pero no acredita por sí solo
Login Kit como inicio de sesión de Mavetio (el acceso sigue siendo Cloudflare Access).
Verificar que client_key, branding, callback y permisos corresponden a la aplicación
presentada, no a otra app de Postiz. No justificar todos los scopes que solicita el
proveedor con esta pantalla. `video.upload` requiere además entrega real en bandeja;
Direct Post y `video.publish` siguen pendientes en Mavetio.

Validación local: 78 pruebas sin OAuth ni llamadas a cuentas reales; TypeScript correcto.
