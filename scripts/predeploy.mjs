import { readFileSync } from "node:fs";
const config = JSON.parse(
  readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
);
const database = config.d1_databases?.find(
  (binding) => binding.binding === "DB",
);
if (
  !database?.database_id ||
  database.database_id === "00000000-0000-0000-0000-000000000000"
) {
  console.error(
    "Despliegue detenido: crea la base D1 y sustituye database_id en wrangler.jsonc. Consulta docs/DEPLOYMENT.md.",
  );
  process.exit(1);
}
console.log(
  "Configuración D1 de despliegue presente. Verifica Access, secretos y páginas legales antes de habilitar usuarios.",
);
