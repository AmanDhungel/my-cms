import { handlers } from "@/auth";

// Mongoose and bcrypt need the Node.js runtime.
export const runtime = "nodejs";

export const { GET, POST } = handlers;
