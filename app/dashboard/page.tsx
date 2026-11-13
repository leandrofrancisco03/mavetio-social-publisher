import { headers } from "next/headers";
import { authenticate } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { Brand } from "@/components/brand";
import { Footer } from "@/components/footer";
import { Dashboard } from "@/components/dashboard";
import { ShieldCheck, ArrowLeft } from "lucide-react";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Mi espacio",
  robots: { index: false, follow: false },
};
export default async function DashboardPage() {
  let user;
  try {
    user = await authenticate(new Headers(await headers()));
  } catch (error) {
    return (
      <div className="access-page">
        <header className="public-header">
          <Brand />
          <a href="/" className="text-link">
            <ArrowLeft size={16} /> Volver al inicio
          </a>
        </header>
        <main id="contenido" className="access-card">
          <div className="access-icon">
            <ShieldCheck size={36} />
          </div>
          <span className="eyebrow">UN ESPACIO PRIVADO</span>
          <h1>
            Tu contenido está
            <br />
            en buenas manos.
          </h1>
          <p>
            {error instanceof AppError
              ? error.message
              : "No se pudo comprobar tu sesión."}
          </p>
          <a className="button" href="/dashboard">
            Volver a comprobar el acceso
          </a>
          <p className="caption">
            Solo las personas autorizadas de la organización pueden acceder a
            las cuentas y publicaciones. Solicita acceso en{" "}
            <a href="mailto:contacto@mavetio.com">contacto@mavetio.com</a>.
          </p>
        </main>
        <Footer />
      </div>
    );
  }
  return <Dashboard email={user.email} footer={<Footer />} />;
}
