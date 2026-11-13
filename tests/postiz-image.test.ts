import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { imageRecipe, ecosystem } from "../extensions/postiz/prepare-image.mjs";
import { PIN, assertCommit, assertHash, criticalHashes } from "../extensions/postiz/verify-checkout.mjs";
const dockerfile = readFileSync("tests/fixtures/postiz-build/Dockerfile.dev", "utf8");
const ignore = readFileSync("tests/fixtures/postiz-build/.dockerignore", "utf8");
describe("Receta Docker fijada sin migraciones automáticas", () => {
  it("rechaza commit o archivos alterados", () => {
    expect(() => assertCommit(PIN)).not.toThrow();
    expect(() => assertCommit("wrong-commit")).toThrow();
    expect(() => imageRecipe(dockerfile + "\n", ignore)).toThrow();
    expect(() => assertHash("Dockerfile.dev", dockerfile, criticalHashes["Dockerfile.dev"])).not.toThrow();
  });
  it("no inventa target dist; sustituye el arranque que ejecutaba db push", () => {
    const recipe = imageRecipe(dockerfile, ignore);
    expect(recipe.dockerfile).not.toMatch(/AS dist/i);
    expect(recipe.dockerfile).not.toContain("nginx && pnpm run pm2");
    expect(recipe.dockerfile).toContain("pm2-runtime /app/mavetio/ecosystem.config.cjs");
    expect(recipe.dockerfile).toContain("--frozen-lockfile");
    expect(recipe.dockerfile).toContain("ENV MAVETIO_DIRECT_POST=false");
    expect(recipe.dockerfile).toContain("EXPOSE 5000");
    expect(recipe.dockerignore).toContain("**/.env");
    expect(ecosystem).toContain("/app/apps/backend");
    expect(ecosystem).toContain("/app/apps/orchestrator");
    expect(ecosystem).toContain("/app/apps/frontend");
    expect(ecosystem).not.toContain("prisma");
  });
});
