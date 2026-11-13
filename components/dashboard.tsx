"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CalendarClock,
  CircleHelp,
  CirclePlus,
  FileVideo,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { Brand } from "./brand";
import {
  PostizReconnectLink,
  TikTokAuthorizationLink,
} from "./postiz-navigation";
import {
  MAX_VIDEO_BYTES,
  postLabel,
  readPostSettings,
  postNetwork,
  postContentText,
  type Integration,
  type PublicConfig,
  type SocialPost,
} from "@/lib/types";

type Tab = "overview" | "posts" | "accounts" | "compose" | "setup";
async function api<T>(action: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/publisher/${action}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers:
      body instanceof FormData || body === undefined
        ? undefined
        : { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await response
    .json()
    .catch(() => ({ error: "No se pudo leer la respuesta del servidor." }));
  if (!response.ok)
    throw new Error(data.error || `Error HTTP ${response.status}`);
  return data as T;
}
function httpsLink(value?: string | null) {
  try {
    return value && new URL(value).protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}
const shortDate = (date: string) =>
  new Date(date).toLocaleString("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const isoDate = (offset: number) =>
  new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

export function Dashboard({
  email,
  footer,
}: {
  email: string;
  footer: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [accounts, setAccounts] = useState<Integration[] | null>(null);
  const [posts, setPosts] = useState<SocialPost[] | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string>();
  const [range, setRange] = useState({ start: isoDate(-30), end: isoDate(30) });
  const [filter, setFilter] = useState("ALL");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [authorizationUrl, setAuthorizationUrl] = useState("");
  const loadGeneration = useRef(0);
  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setErrors([]);
    const results = await Promise.allSettled([
      api<PublicConfig>("config"),
      api<Integration[]>("integrations"),
      api<{ posts: SocialPost[] }>(
        `posts?${new URLSearchParams({ startDate: `${range.start}T00:00:00.000Z`, endDate: `${range.end}T23:59:59.999Z` })}`,
      ),
    ]);
    if (generation !== loadGeneration.current) return;
    setConfig(results[0].status === "fulfilled" ? results[0].value : null);
    setAccounts(results[1].status === "fulfilled" ? results[1].value : null);
    setPosts(results[2].status === "fulfilled" ? results[2].value.posts : null);
    setErrors(
      results.flatMap((r) =>
        r.status === "rejected" ? [String(r.reason.message || r.reason)] : [],
      ),
    );
    setLastSync(
      new Date().toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    setLoading(false);
  }, [range.start, range.end]);
  useEffect(() => {
    void load();
  }, [load]);
  async function connect() {
    setConnecting(true);
    setConnectError("");
    setAuthorizationUrl("");
    try {
      const { url } = await api<{ url: string }>("connect", {});
      setAuthorizationUrl(url);
    } catch (e) {
      setConnectError((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }
  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Vista general", icon: LayoutDashboard },
    { id: "posts", label: "Publicaciones", icon: CalendarClock },
    { id: "accounts", label: "Cuentas conectadas", icon: Link2 },
    { id: "setup", label: "Configuración", icon: Settings2 },
  ];
  const title = {
    overview: "Tu contenido, bajo control.",
    posts: "Cada publicación, en su lugar.",
    accounts: "Conecta tu próxima historia.",
    compose: "Prepara tu próximo vídeo.",
    setup: "Todo listo, paso a paso.",
  }[tab];
  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">ESPACIO DE TRABAJO</div>
        <nav aria-label="Panel principal">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={tab === id ? "nav-item active" : "nav-item"}
              onClick={() => setTab(id)}
            >
              <Icon size={19} />
              {label}
              {tab === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-tip">
          <ShieldCheck size={22} />
          <strong>Tú decides qué compartir</strong>
          <p>
            Revisa el vídeo y confirma cada envío. Tu cuenta siempre está bajo
            tu control.
          </p>
          <button onClick={() => setTab("setup")}>
            Ver el estado del proyecto <ArrowRight size={14} />
          </button>
        </div>
        <div className="sidebar-user">
          <span className="avatar">{email[0]?.toUpperCase()}</span>
          <div>
            <strong>Mi organización</strong>
            <small title={email}>{email}</small>
          </div>
          <a href="/cdn-cgi/access/logout" aria-label="Cerrar sesión">
            <LogOut size={17} />
          </a>
        </div>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-top">
          <span>
            Espacio de trabajo{" "}
            <span className="crumb">
              /{" "}
              {tab === "compose"
                ? "Nuevo vídeo"
                : tabs.find((t) => t.id === tab)?.label}
            </span>
          </span>
          <a href="mailto:contacto@mavetio.com" className="support-link">
            <CircleHelp size={17} /> Ayuda
          </a>
        </header>
        <main id="contenido" className="dashboard-content">
          <div className="dashboard-heading">
            <div>
              <span className="eyebrow">MAVETIO SOCIAL PUBLISHER</span>
              <h1>{title}</h1>
              <p>Prepara, organiza y consulta tus envíos a redes sociales.</p>
            </div>
            {tab !== "compose" && (
              <button className="button" onClick={() => setTab("compose")}>
                <CirclePlus size={18} /> Nuevo vídeo
              </button>
            )}
          </div>
          {config?.sandbox && (
            <div className="sandbox-banner">
              <span className="tag">PREPARACIÓN SANDBOX</span>
              <span>
                La conexión y los permisos se verifican en Postiz y TikTok. Este
                indicador no confirma aprobación.
              </span>
              <button onClick={() => setTab("setup")}>
                Ver requisitos <ArrowUpRight size={15} />
              </button>
            </div>
          )}
          {errors.length > 0 && (
            <div className="notice error" role="alert">
              <AlertCircle size={19} />
              <div>
                <strong>No se pudo completar la consulta</strong>
                {[...new Set(errors)].map((e) => (
                  <p key={e}>{e}</p>
                ))}
                <button className="text-link" onClick={load} disabled={loading}>
                  Volver a consultar
                </button>
              </div>
            </div>
          )}
          {tab === "overview" && (
            <>
              <div className="stats-grid">
                {[
                  {
                    label: "Cuentas conectadas",
                    value: accounts?.filter((a) => !a.disabled).length,
                    icon: Link2,
                    note: "Habilitadas en Postiz",
                  },
                  {
                    label: "En cola",
                    value: posts?.filter((p) => p.state === "QUEUE").length,
                    icon: CalendarClock,
                    note: "Dentro del periodo consultado",
                  },
                  {
                    label: "Envíos con error",
                    value: posts?.filter((p) => p.state === "ERROR").length,
                    icon: AlertCircle,
                    note: "Requieren tu atención",
                  },
                ].map((s) => (
                  <div className="stat" key={s.label}>
                    <div>
                      {s.label}
                      <s.icon size={19} />
                    </div>
                    <strong>{loading ? "…" : (s.value ?? "—")}</strong>
                    <small>{s.note}</small>
                  </div>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Tu siguiente publicación empieza aquí</h2>
                    <FileVideo size={21} />
                  </div>
                  <div className="start-content">
                    <div className="upload-symbol">
                      <Upload size={30} />
                    </div>
                    <h3>Una idea. Un vídeo. Tu audiencia.</h3>
                    <p>
                      Selecciona un vídeo y prepara el mensaje que lo acompaña.
                      Podrás guardarlo como borrador o programar su envío.
                    </p>
                    <button
                      className="button secondary"
                      onClick={() => setTab("compose")}
                    >
                      Preparar un vídeo <ArrowRight size={16} />
                    </button>
                  </div>
                </section>
                <section className="panel account-panel">
                  <div className="panel-heading">
                    <h2>Tus plataformas</h2>
                    <Link2 size={20} />
                  </div>
                  <div className="network-row">
                    <span className="network-icon">♪</span>
                    <div>
                      <strong>TikTok</strong>
                      <small>
                        {accounts === null
                          ? "Sin datos de conexión"
                          : `${accounts.filter((a) => a.identifier === "tiktok").length} cuenta(s) en Postiz`}
                      </small>
                    </div>
                    <button
                      className="icon-button"
                      onClick={() => setTab("accounts")}
                      aria-label="Gestionar TikTok"
                    >
                      <ArrowUpRight size={19} />
                    </button>
                  </div>
                  {["Facebook", "Instagram"].map((n, i) => (
                    <div className="network-row future" key={n}>
                      <span className="network-icon">{i ? "◎" : "f"}</span>
                      <div>
                        <strong>{n}</strong>
                        <small>Integración pendiente</small>
                      </div>
                      <span className="tag muted">Después</span>
                    </div>
                  ))}
                  <p className="panel-caption">
                    Cada plataforma se autoriza a través de Postiz.
                  </p>
                </section>
              </div>
              <div className="panel">
                <div className="panel-heading">
                  <h2>Actividad en el periodo</h2>
                  <button className="text-link" onClick={() => setTab("posts")}>
                    Ver publicaciones <ArrowRight size={15} />
                  </button>
                </div>
                <PostList
                  posts={posts?.slice(0, 5) ?? null}
                  loading={loading}
                />
              </div>
            </>
          )}
          {tab === "posts" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>Publicaciones</h2>
                <button
                  className="button secondary small"
                  onClick={load}
                  disabled={loading}
                >
                  <RefreshCw size={15} className={loading ? "spin" : ""} />{" "}
                  Actualizar
                </button>
              </div>
              <div className="filters">
                <label>
                  Desde (UTC)
                  <input
                    type="date"
                    value={range.start}
                    onChange={(e) =>
                      setRange({ ...range, start: e.target.value })
                    }
                  />
                </label>
                <label>
                  Hasta (UTC)
                  <input
                    type="date"
                    value={range.end}
                    onChange={(e) =>
                      setRange({ ...range, end: e.target.value })
                    }
                  />
                </label>
                <label>
                  Estado
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="ALL">Todos los estados</option>
                    <option value="QUEUE">En cola</option>
                    <option value="PUBLISHED">Completados en Postiz</option>
                    <option value="DRAFT">Borradores</option>
                    <option value="ERROR">Con error</option>
                  </select>
                </label>
              </div>
              <PostList
                posts={
                  posts?.filter(
                    (p) => filter === "ALL" || p.state === filter,
                  ) ?? null
                }
                loading={loading}
              />
              <p className="panel-caption">
                Horas en la zona de tu dispositivo. Un envío a la bandeja de
                TikTok requiere finalizar en la app dentro de 24 horas. La
                disponibilidad en el perfil puede tardar unos minutos.
              </p>
            </section>
          )}
          {tab === "accounts" && (
            <section className="panel">
              <div className="panel-heading">
                <h2>Cuentas de tu organización</h2>
                <button
                  className="button small"
                  disabled={connecting || !config?.postizConfigured}
                  onClick={() => connect()}
                >
                  {connecting ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <CirclePlus size={16} />
                  )}{" "}
                  Conectar TikTok
                </button>
              </div>
              {connectError && (
                <div className="notice error" role="alert">
                  {connectError}
                </div>
              )}
              {authorizationUrl && (
                <TikTokAuthorizationLink url={authorizationUrl} />
              )}
              <div className="notice">
                <ShieldCheck size={20} />
                <p>
                  La autorización se abre en otra pestaña y la gestiona Postiz.
                  Para reconectar, abre la gestión de Postiz, comprueba la
                  organización y selecciona allí el canal correcto. Después,
                  vuelve a esta pestaña y pulsa «Actualizar». Actualizar
                  consulta las cuentas; no confirma por sí solo que OAuth haya
                  terminado. No reutilices un enlace de autorización ya usado o
                  caducado.
                </p>
              </div>
              {accounts?.length ? (
                accounts.map((a) => (
                  <div className="network-row" key={a.id}>
                    <span className="network-icon">
                      {a.identifier === "tiktok"
                        ? "♪"
                        : a.identifier.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <strong>{a.name}</strong>
                      <small>
                        {a.identifier} · {a.profile || "Sin alias"} ·{" "}
                        {a.disabled
                          ? "Deshabilitada"
                          : "Habilitada según Postiz"}
                      </small>
                    </div>
                    {a.identifier === "tiktok" && (
                      <PostizReconnectLink
                        baseUrl={config?.postizWebUrl}
                        name={a.name}
                      />
                    )}
                  </div>
                ))
              ) : (
                <div className="empty">
                  <Link2 size={30} />
                  <h3>
                    {accounts === null
                      ? "No hay datos disponibles"
                      : "Aún no hay cuentas conectadas"}
                  </h3>
                  <p>
                    {accounts === null
                      ? "Configura Postiz y vuelve a consultar."
                      : "Conecta TikTok para empezar a preparar tus vídeos."}
                  </p>
                </div>
              )}
              <div className="panel-actions">
                <button
                  className="button secondary small"
                  onClick={load}
                  disabled={loading}
                >
                  <RefreshCw size={16} /> Actualizar
                </button>
                <a
                  className="text-link"
                  href={
                    httpsLink(config?.postizWebUrl) || "https://app.postiz.com"
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  Administrar o desconectar en Postiz <ArrowUpRight size={16} />
                </a>
              </div>
              <p className="panel-caption">
                Desconectar una cuenta puede afectar sus publicaciones
                programadas. Revisa y confirma esta acción dentro de Postiz.
              </p>
            </section>
          )}
          {tab === "compose" && (
            <Composer
              accounts={accounts || []}
              ready={!!config?.postizConfigured && !!config.storageConfigured}
              onCreated={() => {
                void load();
              }}
            />
          )}
          {tab === "setup" && (
            <div className="setup-grid">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Estado de la configuración</h2>
                  <Settings2 size={20} />
                </div>
                {[
                  {
                    label: "Autenticación de la organización",
                    text: "Sesión verificada con Cloudflare Access.",
                    ready: true,
                  },
                  {
                    label: "API de Postiz",
                    text: config?.postizConfigured
                      ? "Clave configurada. Las consultas confirman su validez."
                      : "Pendiente: añadir POSTIZ_API_KEY al Worker.",
                    ready: !!config?.postizConfigured,
                  },
                  {
                    label: "Registro de envíos y archivos",
                    text: config?.storageConfigured
                      ? "Bindings configurados; se comprueban al enviar."
                      : "Pendiente: D1, migración y MEDIA_SIGNING_SECRET.",
                    ready: !!config?.storageConfigured,
                  },
                  {
                    label: "Conexión de TikTok",
                    text: accounts?.some(
                      (a) => a.identifier === "tiktok" && !a.disabled,
                    )
                      ? "Cuenta habilitada según Postiz. Verifica permisos con un envío real."
                      : "Pendiente: autorizar una cuenta desde Postiz.",
                    ready: !!accounts?.some(
                      (a) => a.identifier === "tiktok" && !a.disabled,
                    ),
                  },
                  {
                    label: "Publicación directa (Direct Post)",
                    text: "Pendiente: Postiz no expone aquí toda la información dinámica del creador requerida. No disponible en este panel.",
                    ready: false,
                  },
                  {
                    label: "Facebook, Instagram y n8n",
                    text: "Pendiente de configuración y validación específica. No se ejecutan automatizaciones desde este panel.",
                    ready: false,
                  },
                ].map((x) => (
                  <div className="check-row" key={x.label}>
                    {x.ready ? (
                      <CheckCircle2 size={21} />
                    ) : (
                      <CircleHelp size={21} />
                    )}
                    <div>
                      <strong>{x.label}</strong>
                      <p>{x.text}</p>
                    </div>
                  </div>
                ))}
              </section>
              <section className="panel guide-panel">
                <span className="eyebrow">DEMOSTRACIÓN SANDBOX</span>
                <h2>Prueba el recorrido completo.</h2>
                <ol>
                  <li>
                    Configura las credenciales Sandbox en tu instancia de Postiz
                    y registra su callback exacto en TikTok.
                  </li>
                  <li>
                    Añade una cuenta de prueba autorizada y comprueba los scopes
                    disponibles.
                  </li>
                  <li>
                    Conecta TikTok, selecciona un vídeo propio y confirma un
                    envío a la bandeja.
                  </li>
                  <li>
                    Consulta el estado real y termina la publicación en la app
                    de TikTok.
                  </li>
                  <li>
                    Graba el recorrido y verifica que las páginas legales
                    públicas estén disponibles.
                  </li>
                </ol>
                <div className="notice">
                  <p>
                    Sandbox no equivale a aprobación. TikTok evalúa el uso del
                    producto; Direct Post no está destinado a herramientas
                    exclusivamente internas.
                  </p>
                </div>
                <a
                  className="text-link"
                  href="https://developers.tiktok.com/docs/en/content-sharing-guidelines"
                  target="_blank"
                  rel="noreferrer"
                >
                  Requisitos oficiales <ArrowUpRight size={16} />
                </a>
              </section>
            </div>
          )}
          <div className="sync-line">
            <span className="dot" /> Fuente: API de Postiz ·{" "}
            {loading
              ? "Consultando…"
              : `Último intento de consulta ${lastSync || "—"}`}
            <button
              onClick={load}
              disabled={loading}
              aria-label="Actualizar datos"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </main>
        {footer}
      </div>
    </div>
  );
}

export function PostList({
  posts,
  loading,
}: {
  posts: SocialPost[] | null;
  loading: boolean;
}) {
  if (loading)
    return (
      <div className="empty" role="status">
        <LoaderCircle className="spin" size={28} />
        <p>Consultando publicaciones reales…</p>
      </div>
    );
  if (!posts?.length)
    return (
      <div className="empty">
        <CalendarClock size={29} />
        <h3>
          {posts === null
            ? "Publicaciones no disponibles"
            : "Tu calendario tiene espacio"}
        </h3>
        <p>
          {posts === null
            ? "No se ha podido consultar Postiz."
            : "No hay publicaciones en este periodo. Prepara tu primer vídeo o cambia las fechas."}
        </p>
      </div>
    );
  return (
    <div className="post-list">
      {[...posts]
        .sort((a, b) => Date.parse(b.publishDate) - Date.parse(a.publishDate))
        .map((p) => (
          <article className="post-row" key={p.id}>
            <span className="post-icon">
              <FileVideo size={22} />
            </span>
            <div className="post-content">
              <strong>{postContentText(p.content) || "Sin texto"}</strong>
              <small>
                {postNetwork(p)} · {p.integration?.name || "Cuenta de Postiz"} ·{" "}
                {shortDate(p.publishDate)}
              </small>
              {p.error && (
                <p
                  className={
                    p.state === "ERROR" ? "post-error" : "post-history"
                  }
                >
                  {p.state === "ERROR"
                    ? "Error de publicación: "
                    : "Mensaje histórico informado por Postiz (no cambia el estado): "}
                  {p.error}
                </p>
              )}
              <small className="post-id">ID: {p.id}</small>
            </div>
            <div className="post-state">
              <span className={`status status-${p.state.toLowerCase()}`}>
                {postLabel(p)}
              </span>
              {httpsLink(p.releaseURL) && (
                <a
                  href={httpsLink(p.releaseURL)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {readPostSettings(p.settings)?.content_posting_method ===
                  "UPLOAD"
                    ? "Abrir TikTok"
                    : "Ver destino"}{" "}
                  <ArrowUpRight size={13} />
                </a>
              )}
            </div>
          </article>
        ))}
    </div>
  );
}

function Composer({
  accounts,
  ready,
  onCreated,
}: {
  accounts: Integration[];
  ready: boolean;
  onCreated: () => void;
}) {
  const [account, setAccount] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [action, setAction] = useState("schedule");
  const [date, setDate] = useState("");
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [videoValid, setVideoValid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const requestId = useRef<string>("");
  const receipt = useRef("");
  useEffect(() => {
    const pending = sessionStorage.getItem("mavetio-pending");
    if (pending) {
      requestId.current = pending;
      setUncertain(true);
    }
  }, []);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function selectFile(selected?: File) {
    setError("");
    setVideoValid(false);
    receipt.current = "";
    if (!selected) {
      setFile(null);
      return;
    }
    if (
      selected.size > MAX_VIDEO_BYTES ||
      !["video/mp4", "video/quicktime"].includes(selected.type)
    ) {
      setError("Selecciona un vídeo MP4 o MOV de hasta 25 MB.");
      setFile(null);
      return;
    }
    setFile(selected);
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || uncertain || !file || !consent || !videoValid) return;
    setBusy(true);
    setError("");
    setSuccess("");
    let submitted = false;
    try {
      if (
        action === "schedule" &&
        (!date || new Date(date).getTime() < Date.now() + 60000)
      )
        throw new Error("Elige una fecha al menos un minuto en el futuro.");
      if (!receipt.current) {
        setPhase("Subiendo vídeo a Postiz…");
        const form = new FormData();
        form.set("file", file);
        receipt.current = (
          await api<{ receipt: string }>("upload", form)
        ).receipt;
      }
      setPhase("Confirmando la solicitud con Postiz…");
      if (!requestId.current) requestId.current = crypto.randomUUID();
      sessionStorage.setItem("mavetio-pending", requestId.current);
      submitted = true;
      const result = await api<{ postId: string }[]>("submit", {
        requestId: requestId.current,
        integrationId: account,
        title,
        description,
        action,
        ...(action === "schedule"
          ? { date: new Date(date).toISOString() }
          : {}),
        method: "UPLOAD",
        mediaReceipt: receipt.current,
        consent,
      });
      sessionStorage.removeItem("mavetio-pending");
      setSuccess(
        `${action === "draft" ? "Borrador guardado" : action === "schedule" ? "Envío programado" : "Solicitud de envío aceptada"} por Postiz. ID: ${result.map((p) => p.postId).join(", ")}. ${action === "draft" ? "Podrás revisarlo en Postiz." : "Finaliza la publicación en TikTok cuando llegue a tu bandeja."}`,
      );
      setUncertain(true);
      onCreated();
    } catch (e) {
      setError((e as Error).message);
      if (submitted) setUncertain(true);
    } finally {
      setBusy(false);
      setPhase("");
    }
  }
  const locked = busy || uncertain;
  const selected = accounts.find((a) => a.id === account);
  return (
    <form onSubmit={submit} className="composer-grid">
      <section className="panel composer-panel">
        <div className="panel-heading">
          <h2>
            <span className="step-number">1</span> Contenido y destino
          </h2>
          <FileVideo size={20} />
        </div>
        {!ready && (
          <div className="notice">
            <AlertCircle size={18} />
            <p>
              Pendiente: configura Postiz, la firma de archivos y D1 antes de
              enviar. Puedes explorar el formulario.
            </p>
          </div>
        )}
        <fieldset disabled={locked}>
          <label className="field">
            Cuenta de TikTok
            <select
              required
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option value="">Selecciona una cuenta</option>
              {accounts
                .filter((a) => a.identifier === "tiktok" && !a.disabled)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.profile ? ` (@${a.profile})` : ""}
                  </option>
                ))}
            </select>
          </label>
          {selected && (
            <p className="field-hint">
              Destino: <strong>{selected.name}</strong> · cuenta de Postiz
            </p>
          )}
          <label className={`file-drop ${file ? "has-file" : ""}`}>
            <input
              type="file"
              accept="video/mp4,video/quicktime,.mp4,.mov"
              onChange={(e) => selectFile(e.target.files?.[0])}
            />
            <Upload size={28} />
            <strong>{file ? file.name : "Selecciona tu vídeo"}</strong>
            <span>
              {file
                ? `${(file.size / 1024 / 1024).toFixed(1)} MB · Haz clic para cambiar`
                : "MP4 o MOV · Hasta 25 MB"}
            </span>
          </label>
          <p className="field-hint">
            El vídeo permanece en tu dispositivo hasta que confirmes el envío.
          </p>
          <label className="field">
            Título <span>{title.length}/90</span>
            <input
              required
              maxLength={90}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Dale un nombre a tu próxima historia"
            />
          </label>
          <label className="field">
            Descripción <span>{description.length}/1800</span>
            <textarea
              rows={5}
              maxLength={1800}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="¿Qué quieres contar? Añade contexto y tus hashtags."
            />
          </label>
          <p className="field-hint">
            TikTok recibe el título y la descripción juntos como texto del
            vídeo.
          </p>
          <div className="form-section-title">
            <span className="step-number">2</span>
            <h2>Cómo y cuándo compartir</h2>
          </div>
          <label className="field">
            Modo de publicación
            <select value="UPLOAD" onChange={() => {}}>
              <option value="UPLOAD">
                Enviar a TikTok para finalizar en la app
              </option>
              <option disabled>Direct Post · pendiente de integración</option>
            </select>
          </label>
          <div className="notice">
            <CircleHelp size={18} />
            <p>
              Este modo no publica automáticamente en tu perfil. Debes abrir
              TikTok y terminar la publicación dentro de 24 horas desde la
              recepción.
            </p>
          </div>
          <label className="field">
            Privacidad
            <select disabled value="in-app" onChange={() => {}}>
              <option value="in-app">Se elige al finalizar en TikTok</option>
            </select>
          </label>
          <p className="field-hint">
            TikTok no aplica privacidad, comentarios, duetos, etiquetas
            comerciales o de IA enviados mediante UPLOAD. Configúralos en la app
            antes de publicar.
          </p>
          <label className="field">
            ¿Cuándo quieres enviarlo?
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="schedule">Programar envío</option>
              <option value="now">Enviar ahora</option>
              <option value="draft">Guardar como borrador en Postiz</option>
            </select>
          </label>
          {action === "schedule" && (
            <label className="field">
              Fecha y hora
              <input
                required
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <small>
                Zona horaria: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                . Se enviará a Postiz en UTC.
              </small>
            </label>
          )}
          <label className="consent">
            <input
              type="checkbox"
              checked={consent}
              required
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              He revisado el vídeo y tengo los derechos necesarios. Autorizo su
              subida a Postiz y{" "}
              {action === "draft"
                ? "su almacenamiento como borrador."
                : "su envío a la bandeja de TikTok; completaré la publicación en la app."}
            </span>
          </label>
          <button
            className="button submit-button"
            type="submit"
            disabled={
              !ready || !account || !file || !videoValid || !consent || locked
            }
          >
            {busy ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <Send size={18} />
            )}{" "}
            {busy
              ? phase
              : action === "draft"
                ? "Guardar borrador"
                : action === "now"
                  ? "Confirmar y enviar a TikTok"
                  : "Confirmar y programar envío"}
          </button>
        </fieldset>
        {error && (
          <div className="notice error" role="alert">
            <AlertCircle size={19} />
            <p>{error}</p>
          </div>
        )}
        {success && (
          <div className="notice success" role="status">
            <CheckCircle2 size={19} />
            <p>{success}</p>
          </div>
        )}
        {uncertain && !success && (
          <div className="notice">
            <AlertCircle size={20} />
            <div>
              <strong>Comprueba el envío antes de repetirlo</strong>
              <p>
                Hay una solicitud previa. Consulta las publicaciones y revisa
                Postiz; puede haberse procesado aunque no llegara la respuesta.
              </p>
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  if (
                    window.confirm(
                      "¿Ya comprobaste en Postiz que puedes iniciar un envío nuevo sin duplicar una publicación?",
                    )
                  ) {
                    sessionStorage.removeItem("mavetio-pending");
                    requestId.current = "";
                    receipt.current = "";
                    setUncertain(false);
                    setError("");
                  }
                }}
              >
                Ya revisé Postiz; preparar otro envío
              </button>
            </div>
          </div>
        )}
        {success && (
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              requestId.current = "";
              receipt.current = "";
              setUncertain(false);
              setSuccess("");
              setTitle("");
              setDescription("");
              setFile(null);
              setConsent(false);
              setVideoValid(false);
            }}
          >
            Preparar otro vídeo
          </button>
        )}
      </section>
      <aside className="preview-column">
        <section className="panel preview-panel">
          <div className="panel-heading">
            <h2>Vista previa</h2>
            <span className="tag muted">LOCAL</span>
          </div>
          <div className="video-preview">
            {preview ? (
              <video
                src={preview}
                controls
                playsInline
                preload="metadata"
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  if (
                    Number.isFinite(v.duration) &&
                    v.duration > 0 &&
                    v.videoWidth > 0
                  ) {
                    setVideoValid(true);
                  } else {
                    setError("No se pudo leer la duración del vídeo.");
                  }
                }}
                onError={() => {
                  setVideoValid(false);
                  setError(
                    "El navegador no pudo reproducir el vídeo. Prueba con un MP4 H.264 compatible.",
                  );
                }}
              />
            ) : (
              <div>
                <FileVideo size={46} />
                <p>Aquí empieza tu historia</p>
                <span>Selecciona un vídeo para verlo</span>
              </div>
            )}
          </div>
          <div className="preview-copy">
            <strong>{selected?.name || "Tu cuenta de TikTok"}</strong>
            <p>{title || "El título de tu vídeo"}</p>
            <small>{description || "Tu descripción aparecerá aquí."}</small>
          </div>
        </section>
        <div className="preview-note">
          <ShieldCheck size={20} />
          <p>
            La vista previa es orientativa. TikTok determina el aspecto final y
            los controles de publicación.
          </p>
        </div>
      </aside>
    </form>
  );
}
