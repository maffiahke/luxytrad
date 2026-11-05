import { build } from "esbuild";

/**
 * Bundle the Express API into ONE self-contained CommonJS file for Vercel
 * (api/index.js). This is what makes the serverless function work under
 * `"type": "module"`: instead of shipping a runtime import chain that Node's
 * ESM loader can't resolve (the old ERR_MODULE_NOT_FOUND on `../server/index`),
 * esbuild inlines every relative module at build time. Only @prisma/client
 * stays external so the real (native query-engine) client resolves from
 * node_modules at runtime.
 *
 * The footer collapses the module so `module.exports` is directly the Express
 * request handler — the most universally supported shape for @vercel/node.
 */
await build({
  entryPoints: ["server/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: "api/index.js",
  external: ["@prisma/client"],
  legalComments: "none",
  footer: {
    js: "module.exports = (typeof module.exports === 'function' ? module.exports : (module.exports.default || module.exports));",
  },
});

console.log("build:api → bundled server/index.ts → api/index.js (CJS, self-contained)");
