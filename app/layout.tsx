import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  icons: { icon: '/favicon.svg' },
  metadataBase: new URL("https://social.mavetio.com"),
  title: { default: "Mavetio Social Publisher", template: "%s · Mavetio" },
  description:
    "Prepara tus vídeos, conecta TikTok mediante Postiz y organiza tus envíos desde un solo espacio.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <a className="skip-link" href="#contenido">
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
