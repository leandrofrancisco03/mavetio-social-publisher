import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "./env";
import { AppError } from "./errors";
const keysets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function authenticate(headers: Headers) {
  const c = config();
  if (!c.CF_ACCESS_TEAM_DOMAIN || !c.CF_ACCESS_AUD)
    throw new AppError(
      503,
      "AUTH_NOT_CONFIGURED",
      "Acceso pendiente de configuración. El administrador debe configurar Cloudflare Access.",
    );
  const issuer = `https://${c.CF_ACCESS_TEAM_DOMAIN.replace(/^https:\/\//, "").replace(/\/$/, "")}`;
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer))
    throw new AppError(
      503,
      "AUTH_CONFIG",
      "Dominio de autenticación no válido.",
    );
  const token = headers.get("cf-access-jwt-assertion");
  if (!token)
    throw new AppError(
      401,
      "LOGIN_REQUIRED",
      "Inicia sesión con Cloudflare Access para continuar.",
    );
  try {
    let jwks = keysets.get(issuer);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
      keysets.set(issuer, jwks);
    }
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: c.CF_ACCESS_AUD,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "sub", "iat"],
    });
    if (typeof payload.email !== "string") throw new Error("No human identity");
    return { id: payload.sub!, email: payload.email };
  } catch {
    throw new AppError(
      401,
      "INVALID_SESSION",
      "La sesión no es válida o ha caducado. Vuelve a iniciar sesión.",
    );
  }
}
export function sameOrigin(request: Request) {
  const allowed = config().APP_URL || "https://social.mavetio.com";
  if (
    request.headers.get("origin") !== new URL(allowed).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new AppError(
      403,
      "INVALID_ORIGIN",
      "Solicitud bloqueada: origen no autorizado.",
    );
}
