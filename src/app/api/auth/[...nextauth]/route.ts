import type { NextRequest } from "next/server"

import { handlers } from "@/auth";
import { fail } from "@/lib/api-response";
import { isTenantRequest } from "@/lib/tenancy";

// Mongoose and bcrypt need the Node.js runtime.
export const runtime = "nodejs";

/*
 * The proxy is kept off the auth routes (see proxy.ts), so it can't stop a
 * tenant site's host from reaching them. A public site has no sign-in; on
 * such a host these answer 404, and on the platform's own host they are
 * exactly Auth.js's handlers.
 */
export function GET(request: NextRequest) {
  if (isTenantRequest(request)) return fail("Not found", 404);
  return handlers.GET(request);
}

export function POST(request: NextRequest) {
  if (isTenantRequest(request)) return fail("Not found", 404);
  return handlers.POST(request);
}
