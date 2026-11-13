// Capability of our adapter to the audited Postiz v2.25.3 public API, NOT
// TikTok account permissions. A connected account or Sandbox flag cannot unlock it.
export const DIRECT_POST_BLOCK = {
  code: "DIRECT_POST_UNAVAILABLE",
  message:
    "Direct Post no está disponible hasta activar la extensión privada de Postiz y obtener las restricciones actuales del creador. La API estándar de Postiz v2.25.3 no proporciona esos datos. UPLOAD sigue disponible.",
  requirements: [
    "Consultar la información actual del creador y comprobar video.publish desde el backend de Postiz.",
    "Elegir privacidad sin valor predeterminado; mientras exista la restricción, permitir únicamente SELF_ONLY si TikTok lo devuelve.",
    "Validar duración y restricciones de comentarios, dúos y Stitch antes del envío.",
    "Comprobar declaraciones comerciales, etiqueta de IA y consentimiento musical antes de enviar.",
  ],
} as const;
