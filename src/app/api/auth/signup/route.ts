import { Types } from "mongoose"
import type { NextRequest } from "next/server"

import { fail, handleApiError, ok } from "@/lib/api-response"
import { hashPassword } from "@/lib/auth/password"
import { createSession } from "@/lib/auth/session"
import { connectToDatabase } from "@/lib/mongodb"
import { signupSchema } from "@/lib/validations/auth"
import { Business, toBusinessDTO } from "@/models/business"
import { User, toUserDTO } from "@/models/user"

// Mongoose needs the Node.js runtime (no TCP sockets on the edge runtime).
export const runtime = "nodejs"

/**
 * Creates the workspace and its owner, then signs the owner in.
 *
 * The two documents reference each other, so the ids are minted up front and
 * a failed user insert rolls the business back by hand — a real transaction
 * would need MongoDB to be running as a replica set.
 */
export async function POST(request: NextRequest) {
  try {
    // Validate before touching the database — bad input never opens a pool.
    const input = signupSchema.parse(await request.json())
    const email = input.email.toLowerCase()

    await connectToDatabase()

    const taken = await User.exists({ email })
    if (taken) {
      return fail("That email already has an account", 409, {
        email: ["That email already has an account"],
      })
    }

    const businessId = new Types.ObjectId()
    const userId = new Types.ObjectId()

    const business = await Business.create({
      _id: businessId,
      name: input.business,
      crewSize: input.crewSize,
      owner: userId,
    })

    let user
    try {
      user = await User.create({
        _id: userId,
        name: input.name,
        email,
        phone: input.phone,
        passwordHash: await hashPassword(input.password),
        role: "owner",
        business: businessId,
      })
    } catch (error) {
      await Business.deleteOne({ _id: businessId })
      throw error
    }

    await createSession({
      userId: String(user._id),
      businessId: String(business._id),
      role: "owner",
    })

    return ok(
      { user: toUserDTO(user), business: toBusinessDTO(business) },
      201
    )
  } catch (error) {
    return handleApiError(error)
  }
}
