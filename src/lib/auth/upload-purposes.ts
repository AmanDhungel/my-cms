import type { UserRole } from "@/models/user"

/**
 * Which upload folders each role may write to. The upload route enforces it
 * (src/app/api/uploads/route.ts); /api/me reports it so the app offers a
 * picture button only where the server would take the picture.
 */
export const UPLOAD_PURPOSES_BY_ROLE: Record<UserRole, readonly string[]> = {
  owner: ["site", "maintenance", "ticket", "products", "logo"],
  supervisor: ["maintenance", "ticket", "products"],
  employee: ["ticket"],
}
