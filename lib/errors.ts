export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function safeMessage(value: unknown, secrets: string[] = []): string {
  let text =
    typeof value === "string"
      ? value
      : JSON.stringify(value) || "Respuesta sin detalle";
  for (const secret of secrets)
    if (secret) text = text.split(secret).join("[oculto]");
  return text
    .replace(/(bearer\s+)[\w.~-]+/gi, "$1[oculto]")
    .replace(
      /((?:access_token|refresh_token|client_secret|api_key|authorization)["\s:=]+)[^\s,"}]+/gi,
      "$1[oculto]",
    )
    .slice(0, 900);
}
