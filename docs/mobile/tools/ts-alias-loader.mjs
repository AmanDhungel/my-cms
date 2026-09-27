// Resolve hook for `node --experimental-strip-types`: lets a plain Node
// script import the app's own TypeScript modules (src/**) unchanged.
//
//   "@/lib/x"          -> <repo>/src/lib/x.ts  (or .tsx, or /index.ts)
//   "./y" (from a .ts) -> ./y.ts               (extensionless relative import)
//
// Registered by generate-openapi.mjs; nothing in src/ is modified.
import { existsSync, statSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
import path from "node:path"

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const src = path.join(repo, "src")

function withTs(base) {
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }
  return null
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const file = withTs(path.join(src, specifier.slice(2)))
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true, format: "module-typescript" }
  }
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.endsWith(".ts") &&
    !path.extname(specifier)
  ) {
    const parent = path.dirname(fileURLToPath(context.parentURL))
    const file = withTs(path.resolve(parent, specifier))
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true, format: "module-typescript" }
  }
  return next(specifier, context)
}
