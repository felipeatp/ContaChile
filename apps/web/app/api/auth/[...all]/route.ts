import { toNextJsHandler } from "better-auth/next-js"
import { auth } from "@/lib/auth-edge"

export const { GET, POST } = toNextJsHandler(auth)
