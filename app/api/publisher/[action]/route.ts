import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { authenticate, sameOrigin } from "@/lib/auth";
import { config } from "@/lib/env";
import { AppError, safeMessage } from "@/lib/errors";
import { integrations, postiz, parsePostiz } from "@/lib/postiz";
import { buildPost, submissionSchema } from "@/lib/submissions";
import { postizPostsSchema } from "@/lib/postiz-posts";
import { MAX_VIDEO_BYTES } from "@/lib/types";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ action: string }> };
const reply = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const signingKey = () => {
  const secret = config().MEDIA_SIGNING_SECRET;
  if (!secret || secret.length < 32)
    throw new AppError(
      503,
      "SIGNING_NOT_CONFIGURED",
      "Pendiente: configurar la firma segura de los archivos.",
    );
  return new TextEncoder().encode(secret);
};
async function boundedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new AppError(
      413,
      "TOO_LARGE",
      "El archivo o la solicitud supera el límite permitido.",
    );
  if (!request.body)
    throw new AppError(400, "EMPTY_BODY", "La solicitud está vacía.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw new AppError(
        413,
        "TOO_LARGE",
        "El archivo supera el límite de 25 MB.",
      );
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
async function jsonBody(request: Request): Promise<unknown> {
  try {
    return JSON.parse(
      new TextDecoder().decode(await boundedBody(request, 20000)),
    );
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(400, "INVALID_JSON", "Formato de solicitud no válido.");
  }
}
async function handle(request: Request, context: Context) {
  try {
    const user = await authenticate(request.headers);
    const { action } = await context.params;
    const c = config();
    if (request.method !== "GET") sameOrigin(request);
    if (request.method === "GET") {
      if (action === "config")
        return reply({
          postizConfigured: !!c.POSTIZ_API_KEY,
          storageConfigured: !!c.DB && !!c.MEDIA_SIGNING_SECRET,
          postizWebUrl: c.POSTIZ_WEB_URL || "https://app.postiz.com",
          sandbox: c.TIKTOK_SANDBOX !== "false",
        });
      if (action === "integrations") return reply(await integrations());
      if (action === "posts") {
        const query = new URL(request.url).searchParams;
        const start = z.iso.datetime().parse(query.get("startDate"));
        const end = z.iso.datetime().parse(query.get("endDate"));
        if (
          Date.parse(end) < Date.parse(start) ||
          Date.parse(end) - Date.parse(start) > 93 * 86400000
        )
          throw new AppError(
            400,
            "DATE_RANGE",
            "Selecciona un periodo de hasta 93 días.",
          );
        const path = `/posts?${new URLSearchParams({ startDate: start, endDate: end })}`;
        const data = parsePostiz(postizPostsSchema, await postiz(path), path);
        return reply({
          posts: data.posts.map((p) => ({
            ...p,
            error:
              typeof p.error === "string"
                ? safeMessage(p.error, [c.POSTIZ_API_KEY || ""])
                : p.error,
          })),
        });
      }
    }
    if (request.method === "POST") {
      if (action === "connect") {
        const input = z
          .object({ refresh: z.string().max(200).optional() })
          .strict()
          .parse(await jsonBody(request));
        if (
          input.refresh &&
          !(await integrations()).some(
            (i) => i.id === input.refresh && i.identifier === "tiktok",
          )
        )
          throw new AppError(
            404,
            "ACCOUNT_NOT_FOUND",
            "La cuenta no pertenece a esta organización.",
          );
        const result = z
          .object({ url: z.url() })
          .parse(
            await postiz(
              `/social/tiktok${input.refresh ? `?refresh=${encodeURIComponent(input.refresh)}` : ""}`,
            ),
          );
        const url = new URL(result.url);
        if (
          url.protocol !== "https:" ||
          !["www.tiktok.com", "tiktok.com"].includes(url.hostname) ||
          !url.searchParams.get("client_key") ||
          url.searchParams.get("client_key") === "undefined"
        )
          throw new AppError(
            502,
            "OAUTH_NOT_READY",
            "Postiz no devolvió una autorización válida de TikTok. Revisa las credenciales del proveedor en Postiz.",
          );
        return reply(result);
      }
      if (action === "upload") {
        signingKey();
        const bytes = await boundedBody(request, MAX_VIDEO_BYTES + 65536);
        const form = await new Response(bytes, {
          headers: {
            "Content-Type": request.headers.get("content-type") || "",
          },
        }).formData();
        const file = form.get("file");
        if (
          !(file instanceof File) ||
          !file.size ||
          file.size > MAX_VIDEO_BYTES ||
          !["video/mp4", "video/quicktime"].includes(file.type)
        )
          throw new AppError(
            400,
            "INVALID_VIDEO",
            "Selecciona un vídeo MP4 o MOV de hasta 25 MB.",
          );
        const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
        if (new TextDecoder().decode(head.slice(4, 8)) !== "ftyp")
          throw new AppError(
            400,
            "INVALID_VIDEO",
            "El archivo no tiene una cabecera de vídeo MP4/MOV compatible.",
          );
        const upload = new FormData();
        upload.set("file", file, file.name);
        const media = z
          .object({ id: z.string(), path: z.url() })
          .parse(await postiz("/upload", { method: "POST", body: upload }));
        if (new URL(media.path).protocol !== "https:")
          throw new AppError(
            502,
            "MEDIA_URL",
            "Postiz devolvió una URL multimedia sin HTTPS.",
          );
        const receipt = await new SignJWT(media)
          .setProtectedHeader({ alg: "HS256" })
          .setSubject(user.id)
          .setAudience("mavetio-media")
          .setIssuedAt()
          .setExpirationTime("2h")
          .sign(signingKey());
        return reply({ receipt, name: file.name });
      }
      if (action === "submit") {
        const input = submissionSchema.parse(await jsonBody(request));
        if (!c.DB)
          throw new AppError(
            503,
            "STORAGE_NOT_CONFIGURED",
            "Pendiente: configurar D1 para evitar envíos duplicados.",
          );
        if (
          input.action === "schedule" &&
          (!input.date || Date.parse(input.date) < Date.now() + 60000)
        )
          throw new AppError(
            400,
            "PAST_DATE",
            "Programa el envío al menos un minuto en el futuro.",
          );
        let media: { id: string; path: string };
        try {
          const { payload } = await jwtVerify(
            input.mediaReceipt,
            signingKey(),
            {
              audience: "mavetio-media",
              subject: user.id,
              algorithms: ["HS256"],
            },
          );
          media = z.object({ id: z.string(), path: z.url() }).parse(payload);
        } catch {
          throw new AppError(
            400,
            "MEDIA_EXPIRED",
            "El archivo no es válido para esta sesión o ha caducado. Vuelve a subirlo.",
          );
        }
        const account = (await integrations()).find(
          (i) =>
            i.id === input.integrationId &&
            i.identifier === "tiktok" &&
            !i.disabled,
        );
        if (!account)
          throw new AppError(
            400,
            "ACCOUNT_UNAVAILABLE",
            "Selecciona una cuenta TikTok habilitada en Postiz.",
          );
        const fingerprint = Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(JSON.stringify(input)),
            ),
          ),
        )
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
        const inserted = await c.DB.prepare(
          "INSERT OR IGNORE INTO submissions (id,user_id,fingerprint,status) VALUES (?,?,?,?)",
        )
          .bind(input.requestId, user.id, fingerprint, "pending")
          .run();
        if (!inserted.meta.changes) {
          const previous = await c.DB.prepare(
            "SELECT user_id,fingerprint,status,response FROM submissions WHERE id=?",
          )
            .bind(input.requestId)
            .first<{
              user_id: string;
              fingerprint: string;
              status: string;
              response: string;
            }>();
          if (
            previous?.user_id === user.id &&
            previous.fingerprint === fingerprint &&
            previous.status === "completed"
          )
            return reply(JSON.parse(previous.response));
          throw new AppError(
            409,
            "SUBMISSION_UNCERTAIN",
            "Este envío ya fue solicitado. Consulta las publicaciones en Postiz antes de crear otro para evitar duplicados.",
          );
        }
        try {
          const result = z
            .array(z.object({ postId: z.string(), integration: z.string() }))
            .parse(
              await postiz("/posts", {
                method: "POST",
                body: JSON.stringify(buildPost(input, media)),
              }),
            );
          await c.DB.prepare(
            "UPDATE submissions SET status=?,response=? WHERE id=?",
          )
            .bind("completed", JSON.stringify(result), input.requestId)
            .run();
          return reply(result, 201);
        } catch (error) {
          await c.DB.prepare("UPDATE submissions SET status=? WHERE id=?")
            .bind("unknown", input.requestId)
            .run();
          throw error;
        }
      }
    }
    throw new AppError(404, "NOT_FOUND", "Operación no disponible.");
  } catch (error) {
    if (error instanceof AppError)
      return reply({ error: error.message, code: error.code }, error.status);
    if (error instanceof z.ZodError)
      return reply(
        {
          error:
            "Los datos no tienen el formato esperado. Revisa los campos o la versión de Postiz.",
          code: "VALIDATION_ERROR",
        },
        400,
      );
    return reply(
      {
        error:
          "No se pudo completar la operación. Consulta Postiz antes de repetir un envío.",
        code: "INTERNAL_ERROR",
      },
      500,
    );
  }
}
export const GET = handle;
export const POST = handle;
