import { NextRequest } from "next/server"

import { handlers } from "@/auth";
import { logActivity } from "@/lib/activity";
import { fail } from "@/lib/api-response";
import { connectToDatabase } from "@/lib/mongodb";
import { clientIp } from "@/lib/security/client-ip";
import { limitBy, tooManyMessage } from "@/lib/security/rate-limit";
import { isTenantRequest } from "@/lib/tenancy";
import { User } from "@/models/user";

// Mongoose and bcrypt need the Node.js runtime.
export const runtime = "nodejs";

/*
 * The proxy is kept off the auth routes (see proxy.ts), so it can't stop a
 * tenant site's host from reaching them. A public site has no sign-in; on
 * such a host these answer 404, and on the platform's own host they are
 * Auth.js's handlers — with the credentials sign-in wrapped in:
 *
 * - input typing: email and password must be strings (an object such as
 *   {"$ne": null} is a 422 before Auth.js or any query sees it);
 * - rate limits: 5 attempts per email and 20 per IP, per 15 minutes (429 +
 *   Retry-After, with a `url` the Auth.js client can read);
 * - an audit trail of successes, failures and rate-limited attempts for
 *   known accounts. Passwords are never logged.
 */
export function GET(request: NextRequest) {
  if (isTenantRequest(request)) return fail("Not found", 404);
  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  if (isTenantRequest(request)) return fail("Not found", 404);
  if (!request.nextUrl.pathname.endsWith("/callback/credentials")) {
    return handlers.POST(request);
  }

  // The body is read once, here, and Auth.js gets a fresh request carrying
  // the same text: reading a clone and then the original proved unreliable
  // ("Body is unusable" on some sign-ins).
  const text = await request.text().catch(() => "");
  const body = parseCredentials(text, request.headers.get("content-type") ?? "");
  const origin = request.nextUrl.origin;
  // The Auth.js client parses `url` from the body, so every refusal carries one.
  const refuse = (status: number, error: string, code: string, headers?: Record<string, string>) =>
    Response.json(
      { error: code === "RateLimited" ? error : "Validation failed", url: `${origin}/login?error=${code}&code=${encodeURIComponent(error)}` },
      { status, headers }
    );

  if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
    return refuse(422, "Validation failed", "CredentialsSignin");
  }

  const email = body.email.trim().toLowerCase();
  const [byEmail, byIp] = await Promise.all([
    limitBy("loginEmail", email),
    limitBy("loginIp", clientIp(request.headers)),
  ]);
  const account = await findAccount(email);

  if (!byEmail.ok || !byIp.ok) {
    const retryAfter = Math.max(byEmail.ok ? 0 : byEmail.retryAfter, byIp.ok ? 0 : byIp.retryAfter);
    if (account) void audit(account, "login_rate_limited");
    return refuse(429, tooManyMessage(retryAfter), "RateLimited", { "Retry-After": String(retryAfter) });
  }

  const response = await handlers.POST(
    new NextRequest(request.url, { method: "POST", headers: request.headers, body: text })
  );
  if (account) {
    // A session cookie in the answer is the only sign of a successful sign-in.
    const signedIn = response.headers
      .getSetCookie()
      .some((cookie) => /authjs\.session-token=[^;]+/.test(cookie));
    void audit(account, signedIn ? "login_succeeded" : "login_failed");
  }
  return response;
}

function parseCredentials(text: string, type: string): Record<string, unknown> | null {
  try {
    if (text.length > 16_384) return null;
    if (type.includes("application/json")) {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" ? parsed : null;
    }
    return Object.fromEntries(new URLSearchParams(text));
  } catch {
    return null;
  }
}

async function findAccount(email: string) {
  try {
    await connectToDatabase();
    return await User.findOne({ email }).select("_id name business").lean();
  } catch {
    return null;
  }
}

function audit(
  account: { _id: unknown; name?: string; business?: unknown },
  action: "login_succeeded" | "login_failed" | "login_rate_limited"
) {
  return logActivity({
    businessId: account.business as never,
    action,
    actorId: account._id as never,
    actorName: account.name ?? "",
    subject: account.name ?? "",
    targetKind: "account",
    targetId: account._id as never,
    href: "/dashboard/people",
  });
}
