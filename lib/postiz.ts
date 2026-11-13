import { z } from "zod";
import { config } from "./env";
import { AppError, safeMessage } from "./errors";
export async function postiz(path: string, init: RequestInit = {}) {
  const c = config();
  if (!c.POSTIZ_API_KEY)
    throw new AppError(
      503,
      "POSTIZ_NOT_CONFIGURED",
      "Pendiente: configurar la API de Postiz en el servidor.",
    );
  const base = c.POSTIZ_API_URL || "https://postiz.mavetio.com/public/v1";
  if (new URL(base).protocol !== "https:")
    throw new AppError(503, "POSTIZ_CONFIG", "Postiz debe usar HTTPS.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", c.POSTIZ_API_KEY);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new AppError(
      502,
      "POSTIZ_UNREACHABLE",
      "No se pudo confirmar la respuesta de Postiz. Consulta las publicaciones antes de volver a enviar.",
    );
  }
  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message =
      data && typeof data === "object"
        ? (data as Record<string, unknown>).message ||
          (data as Record<string, unknown>).error ||
          `Error HTTP ${response.status}`
        : `Error HTTP ${response.status}`;
    throw new AppError(
      response.status === 429 ? 429 : 502,
      `POSTIZ_${response.status}`,
      `Postiz (${response.status}): ${safeMessage(message, [c.POSTIZ_API_KEY])}`,
    );
  }
  if (data === null)
    throw new AppError(
      502,
      "POSTIZ_RESPONSE",
      "Postiz devolvió una respuesta que no se pudo interpretar.",
    );
  return data;
}
const integrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  identifier: z.string(),
  disabled: z.boolean(),
  profile: z.string().nullish(),
});
export async function integrations() {
  const parsed = z
    .array(integrationSchema)
    .safeParse(await postiz("/integrations"));
  if (!parsed.success)
    throw new AppError(
      502,
      "POSTIZ_SCHEMA",
      "Formato de cuentas no compatible. Revisa la versión de Postiz.",
    );
  return parsed.data.map((i) => ({ ...i, profile: i.profile || undefined }));
}
