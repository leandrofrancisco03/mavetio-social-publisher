import { postiz } from "./postiz";
import { AppError } from "./errors";
import { parseCreator } from "../extensions/postiz/mavetio-tiktok";

export async function creatorInfo(integrationId: string) {
  // Custom, versioned endpoint supplied by extensions/postiz; not stock Postiz.
  try {
    return parseCreator(
      await postiz(
        `/mavetio/tiktok/${encodeURIComponent(integrationId)}/creator-info`,
      ),
    );
  } catch {
    // No upstream response or exception body is exposed to the browser.
    throw new AppError(
      409,
      "DIRECT_POST_UNAVAILABLE",
      "Direct Post no disponible. Comprueba la extensión privada de Postiz, el permiso video.publish y las restricciones actuales de TikTok. UPLOAD sigue disponible.",
    );
  }
}
