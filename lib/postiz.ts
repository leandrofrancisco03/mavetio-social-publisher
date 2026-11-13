import { z } from "zod";
import { config } from "./env";
import { AppError, safeMessage } from "./errors";

export const POSTIZ_BASE_URL = "https://postiz.mavetio.com/api/public/v1";
export const POSTIZ_TIMEOUT_MS = 60_000;
function endpointUrl(path: string) {
  try {
    const base = new URL(config().POSTIZ_API_URL || POSTIZ_BASE_URL);
    if (
      base.protocol !== "https:" ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      !path.startsWith("/") ||
      path.startsWith("//")
    )
      throw new Error();
    return new URL(`${base.href.replace(/\/$/, "")}${path}`);
  } catch {
    throw new AppError(
      503,
      "POSTIZ_CONFIG",
      "La URL base de Postiz debe ser HTTPS, sin credenciales ni parámetros.",
    );
  }
}
// No raw exceptions, headers, bodies, query strings or redirect destinations.
function diagnosticMessage(value: unknown) {
  const c = config();
  return safeMessage(
    typeof value === "string" ? value : "Detalle no disponible",
    [c.POSTIZ_API_KEY || "", c.MEDIA_SIGNING_SECRET || ""],
  )
    .replace(
      /(?:authorization|proxy-authorization|cookie|set-cookie|cf-access-jwt-assertion|[\w-]*(?:token|secret|api[_-]?key))["'\s]*[:=][^\r\n]*/gi,
      "[credencial omitida]",
    )
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[URL omitida]")
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, "[token omitido]")
    .replace(/[\r\n\t]/g, " ")
    .slice(0, 500);
}
function logFailure(
  url: URL,
  code: string,
  status: number | null,
  error: unknown,
  started: number,
) {
  const exception =
    error instanceof Error ? error : new Error("Excepción sin detalle seguro");
  const cause = exception.cause instanceof Error ? exception.cause : undefined;
  const causeCode = cause && "code" in cause ? cause.code : undefined;
  const safeCodes = [
    "ENOTFOUND",
    "EAI_AGAIN",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "CERT_HAS_EXPIRED",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "ERR_TLS_CERT_ALTNAME_INVALID",
  ];
  console.error("[postiz.request.failed]", {
    endpoint: `${url.origin}${url.pathname}`,
    code,
    httpStatus: status,
    elapsedMs: Math.max(0, Date.now() - started),
    exceptionName: [
      "Error",
      "TypeError",
      "TimeoutError",
      "AbortError",
      "SyntaxError",
      "ZodError",
    ].includes(exception.name)
      ? exception.name
      : "Error",
    exceptionMessage: diagnosticMessage(exception.message),
    ...(cause ? { causeMessage: diagnosticMessage(cause.message) } : {}),
    ...(typeof causeCode === "string" && safeCodes.includes(causeCode)
      ? { causeCode }
      : {}),
  });
}
export async function postiz(path: string, init: RequestInit = {}) {
  const c = config();
  if (!c.POSTIZ_API_KEY)
    throw new AppError(
      503,
      "POSTIZ_NOT_CONFIGURED",
      "Pendiente: configurar la API de Postiz en el servidor.",
    );
  const url = endpointUrl(path);
  const started = Date.now();
  const headers = new Headers(init.headers);
  headers.set("Authorization", c.POSTIZ_API_KEY);
  headers.set("Accept", "application/json");
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const timeout = AbortSignal.timeout(POSTIZ_TIMEOUT_MS);
  const signal = init.signal
    ? AbortSignal.any([timeout, init.signal])
    : timeout;
  const uncertain =
    init.method && !["GET", "HEAD"].includes(init.method.toUpperCase())
      ? " Consulta las publicaciones antes de volver a enviar."
      : "";
  function transportFailure(error: unknown, status: number | null): never {
    const timedOut =
      timeout.aborted ||
      (error instanceof Error && error.name === "TimeoutError");
    const aborted = !timedOut && signal.aborted;
    const code = timedOut
      ? "POSTIZ_TIMEOUT"
      : aborted
        ? "POSTIZ_ABORTED"
        : status === null
          ? "POSTIZ_CONNECTION_ERROR"
          : "POSTIZ_BODY_ERROR";
    logFailure(url, code, status, error, started);
    throw new AppError(
      timedOut ? 504 : aborted ? 408 : 502,
      code,
      (timedOut
        ? "Postiz no completó la respuesta en 60 segundos."
        : aborted
          ? "La consulta a Postiz fue cancelada."
          : status === null
            ? "No se pudo establecer la solicitud a Postiz. Revisa el diagnóstico del Worker (conexión, DNS, TLS o runtime)."
            : "Se interrumpió la lectura de la respuesta de Postiz.") +
        uncertain,
    );
  }
  let response: Response;
  try {
    response = await fetch(url.href, {
      ...init,
      headers,
      cache: "no-store",
      redirect: "manual",
      signal,
    });
  } catch (error) {
    return transportFailure(error, null);
  }
  // Workers rejects redirect:"error" before networking. Never follow redirects
  // automatically: they could forward credentials to another origin or HTTP.
  if (response.status >= 300 && response.status < 400) {
    logFailure(
      url,
      "POSTIZ_REDIRECT",
      response.status,
      new Error(
        `HTTP ${response.status}: redirección rechazada; destino omitido`,
      ),
      started,
    );
    await response.body?.cancel().catch(() => {});
    throw new AppError(
      502,
      "POSTIZ_REDIRECT",
      `Postiz respondió con una redirección HTTP ${response.status}. Revisa la URL base y las reglas de acceso del origen.`,
    );
  }
  // Classify HTTP failures before parsing any potentially non-JSON error body.
  if (!response.ok) {
    const status = response.status;
    const code =
      status === 401 || status === 403
        ? "POSTIZ_AUTH_ERROR"
        : status === 404
          ? "POSTIZ_NOT_FOUND"
          : status >= 500
            ? "POSTIZ_UPSTREAM_ERROR"
            : `POSTIZ_${status}`;
    logFailure(
      url,
      code,
      status,
      new Error(`Postiz HTTP ${status}; cuerpo omitido`),
      started,
    );
    await response.body?.cancel().catch(() => {});
    const message =
      status === 401 || status === 403
        ? "Postiz rechazó la autenticación o los permisos de la API. La sesión de Cloudflare Access es independiente."
        : status === 404
          ? "Postiz no encontró el endpoint. Verifica la base /api/public/v1 y la ruta."
          : status >= 500
            ? "Postiz o su proxy devolvió un error de servidor."
            : status === 429
              ? "Postiz ha limitado las solicitudes. Vuelve a consultar más tarde."
              : "Postiz rechazó la solicitud.";
    throw new AppError(
      status,
      code,
      `Postiz (HTTP ${status}): ${message}${uncertain}`,
    );
  }
  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    return transportFailure(error, response.status);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // SyntaxError messages may embed response content. Omit it entirely.
    logFailure(
      url,
      "POSTIZ_INVALID_JSON",
      response.status,
      new SyntaxError("JSON inválido o vacío; contenido omitido"),
      started,
    );
    throw new AppError(
      502,
      "POSTIZ_INVALID_JSON",
      "Postiz respondió, pero el contenido no es JSON válido." + uncertain,
    );
  }
}
export function parsePostiz<T>(
  schema: z.ZodType<T>,
  data: unknown,
  path: string,
): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    logFailure(
      endpointUrl(path),
      "POSTIZ_SCHEMA",
      200,
      new Error("Estructura JSON incompatible; valores omitidos"),
      Date.now(),
    );
    throw new AppError(
      502,
      "POSTIZ_SCHEMA",
      "Postiz devolvió JSON con una estructura no compatible. Revisa el contrato de la versión instalada.",
    );
  }
  return parsed.data;
}
const integrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  identifier: z.string(),
  disabled: z.boolean(),
  profile: z.string().nullish(),
});
export async function integrations() {
  return parsePostiz(
    z.array(integrationSchema),
    await postiz("/integrations"),
    "/integrations",
  ).map((i) => ({ ...i, profile: i.profile || undefined }));
}
