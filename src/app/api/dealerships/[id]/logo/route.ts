import { readLogo } from "@/features/branding/server"
import { requireUser } from "@/server/auth"
import { assertId, handleRouteError, HttpError } from "@/server/http"

// A logo is visible to that dealership's own users and to the super admin, nobody else.
export async function GET(_request: Request, { params }: RouteContext<"/api/dealerships/[id]/logo">) {
  try {
    const id = assertId((await params).id)
    const user = await requireUser()
    if (user.role !== "super_admin" && user.dealership?.id !== id) throw new HttpError(404, "No logo")
    const { body, mime } = await readLogo(id)
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": mime,
        "X-Content-Type-Options": "nosniff",
        // The page adds ?v=<updatedAt>, so a new upload gets a new URL and this can be cached.
        "Cache-Control": "private, max-age=86400",
      },
    })
  } catch (error) {
    return handleRouteError(error)
  }
}
