import { Types } from "mongoose"

import { hashPassword } from "@/lib/auth/password"
import { handleApiError, ok } from "@/lib/api-response"
import { connectToDatabase } from "@/lib/mongodb"
import { signupSchema } from "@/lib/validations/auth"
import { Business, toBusinessDTO } from "@/models/business"
import { User, toUserDTO } from "@/models/user"

export const runtime = "nodejs"

/**
 * Creates a workspace and its owner. This is the only way an account is made
 * without an invite — every other member joins through /join/[token].
 */
export async function POST(request: Request) {
  try {
    // Validate before touching the database so bad payloads cost nothing.
    const values = signupSchema.parse(await request.json())

    const connection = await connectToDatabase()
    const session = await connection.startSession()

    // Both documents reference each other, so the ids are minted up front.
    const businessId = new Types.ObjectId()
    const ownerId = new Types.ObjectId()
    const passwordHash = await hashPassword(values.password)

    try {
      await session.withTransaction(async () => {
        await User.create(
          [
            {
              _id: ownerId,
              name: values.name,
              email: values.email.toLowerCase(),
              phone: values.phone,
              passwordHash,
              role: "owner",
              business: businessId,
            },
          ],
          { session }
        )

        await Business.create(
          [
            {
              _id: businessId,
              name: values.business,
              crewSize: values.crewSize,
              owner: ownerId,
            },
          ],
          { session }
        )
      })
    } finally {
      await session.endSession()
    }

    const [owner, business] = await Promise.all([
      User.findById(ownerId).orFail(),
      Business.findById(businessId).orFail(),
    ])

    return ok({ user: toUserDTO(owner), business: toBusinessDTO(business) }, 201)
  } catch (error) {
    return handleApiError(error)
  }
}
