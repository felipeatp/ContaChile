/**
 * Post-build patch for Cloudflare Workers compatibility.
 *
 * Next.js 15.5+ calls require(this.middlewareManifestPath) directly in
 * getMiddlewareManifest(), bypassing OpenNext's loadManifest() intercept.
 * In CF Workers ESM there is no require(), so this throws at runtime for
 * every request.  Returning null is correct here: OpenNext already handles
 * middleware at the edge layer (worker.js → middlewareHandler), so the
 * server function does not need to load it again.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const handlerPath = path.join(
  __dirname,
  "../.open-next/server-functions/default/apps/web/handler.mjs"
);

const ORIGINAL =
  "getMiddlewareManifest(){return this.minimalMode?null:require(this.middlewareManifestPath)}";
const PATCHED =
  "getMiddlewareManifest(){return null}";

const content = readFileSync(handlerPath, "utf-8");

if (!content.includes(ORIGINAL)) {
  if (content.includes(PATCHED)) {
    console.log("patch-cf-handler: already applied, skipping.");
    process.exit(0);
  }
  console.error(
    "patch-cf-handler: target string not found — handler.mjs may have changed. Aborting."
  );
  process.exit(1);
}

const patched = content.replace(ORIGINAL, PATCHED);
writeFileSync(handlerPath, patched, "utf-8");
console.log("patch-cf-handler: applied getMiddlewareManifest() → null patch.");
