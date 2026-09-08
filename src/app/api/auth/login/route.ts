import type { NextRequest } from "next/server";

import { fail, handleApiError, ok } from "@/lib/api-response";
import { DUMMY_HASH, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { connectToDatabase } from "@/lib/mongodb";
import { loginSchema } from "@/lib/validations/auth";
import { User, toUserDTO } from "@/models/user";

// Mongoose needs the Node.js runtime (no TCP sockets on the edge runtime).
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // Validate before touching the database — bad input never opens a pool.
    const input = loginSchema.parse(await request.json());
    const email = input.email.toLowerCase();

    await connectToDatabase();

    const user = await User.findOne({ email }).select("+passwordHash");

    // Always run a comparison, even with no account, so the response time
    // doesn't reveal which emails are registered.
    const valid = await verifyPassword(
      input.password,
      user?.passwordHash ?? DUMMY_HASH,
    );

    if (!user || !valid) {
      // One message for both cases, for the same reason.
      return fail("Email or password is incorrect", 401);
    }

    await createSession(
      {
        userId: String(user._id),
        businessId: String(user.business),
        role: user.role,
      },
      { remember: input.remember },
    );

    return ok({ user: toUserDTO(user) });
  } catch (error) {
    return handleApiError(error);
  }
}
