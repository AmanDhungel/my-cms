/**
 * Form schemas, fetched when a form opens instead of with the page.
 *
 * Zod is the largest library in the dashboard's JavaScript, and a page that
 * only lists things never validates anything. A dialog starts the import as
 * it opens, so by the time anyone presses Save it has long arrived; the
 * import is cached, so every later call resolves at once.
 */
export const loadWorkSchemas = () => import("@/lib/validations/work")
export const loadInventorySchemas = () => import("@/lib/validations/inventory")
export const loadExpenseSchemas = () => import("@/lib/validations/expenses")
