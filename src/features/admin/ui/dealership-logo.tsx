"use client"

import { BrandMark } from "@/components/shell/brand-logo"
import { cn } from "@/lib/utils"

type LogoSource = { id: string; name: string; hasLogo: boolean; updatedAt: string }

/** A dealership's logo as a small square tile, falling back to the AutoVault wheel. */
export function DealershipLogo({ dealership, className }: { dealership: LogoSource; className?: string }) {
  return dealership.hasLogo ? (
    // Same-origin authenticated API image; see DealershipBrand for why this isn't next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/dealerships/${dealership.id}/logo?v=${new Date(dealership.updatedAt).getTime()}`}
      alt=""
      className={cn("shrink-0 rounded-lg bg-(--navy) object-contain p-1", className)}
    />
  ) : (
    <BrandMark className={cn("shrink-0", className)} />
  )
}
