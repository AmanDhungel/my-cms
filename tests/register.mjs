// Lets `node --test` import the app's own TypeScript (src/**) through the
// "@/..." alias, with Node's built-in type stripping — no test framework or
// transpiler dependency. See `npm test`.
import { register } from "node:module"

register("../docs/mobile/tools/ts-alias-loader.mjs", import.meta.url)
