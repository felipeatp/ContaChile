/**
 * Post-build patches for Cloudflare Workers compatibility.
 *
 * Patch 1: handler.mjs
 * Next.js 15.5+ calls require(this.middlewareManifestPath) directly in
 * getMiddlewareManifest(), bypassing OpenNext's loadManifest() intercept.
 * In CF Workers ESM there is no require(), so this throws at runtime for
 * every request.  Returning null is correct: OpenNext handles middleware at
 * the edge layer (worker.js → middlewareHandler) so the server function
 * does not need to load the manifest again.
 *
 * Patch 2: worker.js  (__name polyfill injection)
 * esbuild injects __name() helper references into server-side bundles.
 * OpenNext renders these into inline <script> tags sent to the browser, but
 * the browser has no __name defined, causing a ReferenceError on every page.
 * This patch intercepts HTML responses at the Worker level and injects a
 * minimal polyfill right after <head> so it runs before any inline script.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Patch 1: handler.mjs ──────────────────────────────────────────────────────

const handlerPath = path.join(
  __dirname,
  "../.open-next/server-functions/default/apps/web/handler.mjs"
);

const HANDLER_ORIGINAL =
  "getMiddlewareManifest(){return this.minimalMode?null:require(this.middlewareManifestPath)}";
const HANDLER_PATCHED =
  "getMiddlewareManifest(){return null}";

const handlerContent = readFileSync(handlerPath, "utf-8");

if (!handlerContent.includes(HANDLER_ORIGINAL)) {
  if (handlerContent.includes(HANDLER_PATCHED)) {
    console.log("patch-cf-handler [1]: already applied, skipping.");
  } else {
    console.error(
      "patch-cf-handler [1]: target string not found — handler.mjs may have changed. Aborting."
    );
    process.exit(1);
  }
} else {
  const patchedHandler = handlerContent.replace(HANDLER_ORIGINAL, HANDLER_PATCHED);
  writeFileSync(handlerPath, patchedHandler, "utf-8");
  console.log("patch-cf-handler [1]: applied getMiddlewareManifest() → null patch.");
}

// ── Patch 2: worker.js (__name polyfill injection) ────────────────────────────

const workerPath = path.join(__dirname, "../.open-next/worker.js");

const WORKER_ORIGINAL = "return handler(reqOrResp, env, ctx, request.signal);";

// Intercepts the response from the Next.js server function. If the response is
// HTML, injects a __name polyfill immediately after <head> so that esbuild's
// helper references in inline scripts don't throw in the browser.
const WORKER_PATCHED = `const _r = await handler(reqOrResp, env, ctx, request.signal);
            const _ct = _r.headers.get("content-type") ?? "";
            if (_ct.startsWith("text/html")) {
                const _b = await _r.text();
                const _p = '<script>if(typeof __name==="undefined")var __name=function(t,v){try{Object.defineProperty(t,"name",{value:v,configurable:true})}catch(e){}return t};</script>';
                const _h = new Headers(_r.headers);
                _h.delete("content-length");
                return new Response(_b.replace(/<head>/i, "<head>" + _p), { status: _r.status, statusText: _r.statusText, headers: _h });
            }
            return _r;`;

const workerContent = readFileSync(workerPath, "utf-8");

if (!workerContent.includes(WORKER_ORIGINAL)) {
  if (workerContent.includes("await handler(reqOrResp, env, ctx, request.signal)")) {
    console.log("patch-cf-handler [2]: already applied, skipping.");
  } else {
    console.error(
      "patch-cf-handler [2]: target string not found in worker.js — may have changed. Aborting."
    );
    process.exit(1);
  }
} else {
  const patchedWorker = workerContent.replace(WORKER_ORIGINAL, WORKER_PATCHED);
  writeFileSync(workerPath, patchedWorker, "utf-8");
  console.log("patch-cf-handler [2]: injected __name polyfill into HTML responses.");
}
