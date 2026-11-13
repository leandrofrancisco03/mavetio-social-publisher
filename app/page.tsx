import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  ShieldCheck,
  Upload,
  CalendarClock,
  Check,
  Play,
  Workflow,
  LockKeyhole,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Footer } from "@/components/footer";
export default function Home() {
  return (
    <div className="public-site">
      <header className="public-header">
        <Brand />
        <nav>
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#plataformas">Plataformas</a>
          <Link href="/dashboard" className="button small">
            Abrir mi espacio <ArrowUpRight size={16} />
          </Link>
        </nav>
      </header>
      <main id="contenido">
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="dot" /> TU CONTENIDO. TU CONTROL.
            </span>
            <h1>
              De la idea
              <br />
              al siguiente
              <br />
              <span>vídeo.</span>
            </h1>
            <p>
              Un espacio para preparar tus vídeos, conectar tus cuentas y
              organizar cuándo compartirlos. Tú decides el contenido; Postiz
              gestiona el envío.
            </p>
            <div className="hero-actions">
              <Link href="/dashboard" className="button">
                Entrar a Social Publisher <ArrowUpRight size={18} />
              </Link>
              <a href="#como-funciona" className="text-link">
                Conoce el proceso <ArrowRight size={16} />
              </a>
            </div>
            <div className="hero-note">
              <ShieldCheck size={16} /> Acceso protegido · Autorización con
              Postiz
            </div>
          </div>
          <div
            className="hero-visual"
            aria-label="Diagrama del proceso, no representa publicaciones reales"
          >
            <div className="visual-top">
              <span className="dot" /> UN FLUJO, PASO A PASO<span>01 — 03</span>
            </div>
            <div className="orb orb-one" />
            <div className="orb orb-two" />
            <div className="flow-card flow-first">
              <span className="step-icon">
                <Upload size={21} />
              </span>
              <div>
                <small>01 / PREPARA</small>
                <strong>Tu próxima historia</strong>
                <span>Vídeo + título + descripción</span>
              </div>
              <Check size={18} />
            </div>
            <div className="flow-line" />
            <div className="flow-card flow-second">
              <span className="step-icon">
                <CalendarClock size={21} />
              </span>
              <div>
                <small>02 / ORGANIZA</small>
                <strong>Elige el momento</strong>
                <span>Postiz guarda y programa tu envío</span>
              </div>
            </div>
            <div className="flow-line" />
            <div className="flow-card flow-third">
              <span className="tiktok-mark">♪</span>
              <div>
                <small>03 / COMPARTE</small>
                <strong>Finaliza en TikTok</strong>
                <span>Revisa la privacidad y publica en la app</span>
              </div>
              <ArrowUpRight size={22} />
            </div>
            <div className="visual-bottom">
              <span>Diseñado para mantenerte al mando</span>
              <LockKeyhole size={15} />
            </div>
          </div>
        </section>
        <section className="platform-strip" id="plataformas">
          <span>UN ESPACIO QUE CRECE CONTIGO</span>
          <div>
            <strong>♪ TikTok</strong>
            <span className="tag">Envío vía Postiz</span>
          </div>
          <div>
            <strong>f Facebook</strong>
            <span className="tag muted">Próximamente</span>
          </div>
          <div>
            <strong>◎ Instagram</strong>
            <span className="tag muted">Próximamente</span>
          </div>
        </section>
        <section className="how section" id="como-funciona">
          <div className="section-heading">
            <div>
              <span className="eyebrow">MENOS PASOS REPETITIVOS</span>
              <h2>Tu proceso, en orden.</h2>
            </div>
            <p>
              Una interfaz clara sobre Postiz.
              <br />
              Sin volver a construir lo que ya funciona.
            </p>
          </div>
          <div className="three-columns">
            {[
              {
                n: "01",
                icon: ShieldCheck,
                title: "Conecta con confianza",
                text: "Autoriza tu cuenta desde el OAuth de Postiz. Las contraseñas de tus redes nunca pasan por Mavetio.",
              },
              {
                n: "02",
                icon: Upload,
                title: "Prepara con intención",
                text: "Selecciona un vídeo, comprueba la vista previa y escribe el título y la descripción antes de confirmar.",
              },
              {
                n: "03",
                icon: CalendarClock,
                title: "Programa y da seguimiento",
                text: "Consulta la respuesta real de Postiz. En TikTok, completa la publicación en la app después de recibir el vídeo.",
              },
            ].map((x) => (
              <article className="feature" key={x.n}>
                <div>
                  <x.icon size={25} />
                  <span>{x.n}</span>
                </div>
                <h3>{x.title}</h3>
                <p>{x.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="honest-section">
          <div>
            <span className="eyebrow">CLARO DESDE EL PRINCIPIO</span>
            <h2>
              Sabes qué ocurre
              <br />
              con cada envío.
            </h2>
            <p>
              Un envío aceptado no equivale a un vídeo visible en tu perfil. El
              panel distingue la cola, los borradores, los errores y los vídeos
              enviados a la bandeja de TikTok.
            </p>
          </div>
          <div className="honest-list">
            <p>
              <Play size={20} />
              <span>
                <strong>Tú tienes la última palabra</strong>En el modo actual,
                eliges privacidad e interacciones y terminas de publicar desde
                TikTok.
              </span>
            </p>
            <p>
              <Workflow size={20} />
              <span>
                <strong>Automatización con Postiz y n8n</strong>Postiz se
                encarga de la programación. La conexión de flujos n8n se
                configura por separado.
              </span>
            </p>
            <p>
              <LockKeyhole size={20} />
              <span>
                <strong>Integración en preparación</strong>Direct Post y la
                validación Sandbox están pendientes de configurar y verificar
                con una cuenta real.
              </span>
            </p>
          </div>
        </section>
        <section className="bottom-cta">
          <div>
            <span className="eyebrow">MAVETIO SOCIAL PUBLISHER</span>
            <h2>Dale espacio a tu contenido.</h2>
          </div>
          <Link className="button" href="/dashboard">
            Abrir mi espacio <ArrowUpRight size={18} />
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
