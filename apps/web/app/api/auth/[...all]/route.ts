import { toNextJsHandler } from "better-auth/next-js"
import { auth } from "@contachile/auth"

export const { GET, POST } = toNextJsHandler(auth)
