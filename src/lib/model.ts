import mongoose, { type Model, type Schema } from "mongoose"

/**
 * Registers a model once per process, the way `models.X ?? model(...)` does —
 * but never keeps an out-of-date one.
 *
 * Reusing whatever is already registered is what stops hot reload throwing
 * OverwriteModelError. It also keeps the schema the process *first* compiled:
 * a `next dev` left running across a change that adds a field goes on using
 * the old schema, and Mongoose's strict mode then drops the new field from
 * every write without a word. That is how "Sections saved" could be shown
 * for a save that stored nothing.
 *
 * So the registered model is reused only while its schema still has every
 * path the current one declares; otherwise it is replaced. In production a
 * process compiles each model exactly once, so this changes nothing there.
 */
export function defineModel<T>(
  name: string,
  // Typed only as far as this reads it. Generic Model<T> work here, or a
  // comparison of a fully inferred Schema type against `Schema`, is deep
  // enough to exhaust the type checker.
  schema: { paths: Record<string, unknown> }
): Model<T> {
  const existing: Model<unknown> | undefined = mongoose.models[name]
  if (existing && Object.keys(schema.paths).every((path) => existing.schema.path(path))) {
    return existing as unknown as Model<T>
  }
  if (existing) mongoose.deleteModel(name)
  return mongoose.model(name, schema as unknown as Schema) as unknown as Model<T>
}
