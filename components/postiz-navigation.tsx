export function postizManagementUrl(value?: string): string | undefined {
  try {
    const url = new URL(value || "");
    if (url.protocol !== "https:" || url.username || url.password) return;
    return new URL("/launches", url.origin).href;
  } catch {
    return;
  }
}

export function PostizReconnectLink({
  baseUrl,
  name,
}: {
  baseUrl?: string;
  name: string;
}) {
  const href = postizManagementUrl(baseUrl);
  if (!href) return <span>Gestión de Postiz no configurada</span>;
  return (
    <a
      className="button secondary small"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Gestionar reconexión de ${name} en Postiz`}
    >
      Gestionar en Postiz ↗
    </a>
  );
}

export function TikTokAuthorizationLink({ url }: { url: string }) {
  return (
    <a
      className="button small"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      Continuar autorización en TikTok ↗
    </a>
  );
}
