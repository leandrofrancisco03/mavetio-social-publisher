import Link from "next/link";
import { Layers2 } from "lucide-react";
export function Brand() {
  return (
    <Link
      href="/"
      className="brand"
      aria-label="Mavetio Social Publisher, inicio"
    >
      <span className="brand-icon">
        <Layers2 size={22} />
      </span>
      <span>
        MAVETIO<span className="brand-sub">SOCIAL PUBLISHER</span>
      </span>
    </Link>
  );
}
