import { DIRECT_POST_BLOCK } from "@/lib/tiktok-capabilities";

export function DirectPostAvailability() {
  return (
    <details className="notice">
      <summary>Direct Post bloqueado: requisitos pendientes</summary>
      <div>
        <p>{DIRECT_POST_BLOCK.message}</p>
        <ul>
          {DIRECT_POST_BLOCK.requirements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>
          Que Direct Post funcione en el panel de Postiz no habilita esta
          modalidad en Mavetio. No se han consultado permisos actuales del
          creador ni se ofrecen opciones de privacidad supuestas.
        </p>
      </div>
    </details>
  );
}
