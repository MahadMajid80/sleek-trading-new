import "server-only"

import { requireDealerAdmin } from "./auth"

/**
 * The dealership the signed-in dealership admin works in. Every dealership API and page is scoped to it, and a user can
 * never switch to another one. Super admins have no dealership and read across all of them through /api/admin instead.
 */
export const currentDealership = async () => (await requireDealerAdmin()).dealership

export const currentDealershipId = async () => (await currentDealership()).id
