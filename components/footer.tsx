import { config } from "@/lib/env";
export function Footer() {
  const c = config();
  return (
    <footer className="footer">
      <span>© {new Date().getFullYear()} Mavetio Systems</span>
      <nav aria-label="Información legal">
        <a href={c.PRIVACY_URL || "https://mavetio.com/privacidad"}>
          Privacidad
        </a>
        <a href={c.TERMS_URL || "https://mavetio.com/terminos"}>Términos</a>
        <a href={c.DELETION_URL || "https://mavetio.com/eliminacion-de-datos"}>
          Eliminación de datos
        </a>
        <a href="mailto:contacto@mavetio.com">Contacto ↗</a>
      </nav>
    </footer>
  );
}
