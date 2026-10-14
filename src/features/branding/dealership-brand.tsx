"use client"


import { BrandMark } from "@/components/shell/brand-logo"
import { cn } from "@/lib/utils"

type BrandProps = { title: string; logoUrl: string | null; logoWide: boolean }

/**
 * The dealership's identity at the top of its sidebar, in three shapes:
 *  - wide logo (wordmark): fills the sidebar width, no extra text, since the logo already carries the name;
 *  - square logo: logo beside the title;
 *  - no logo: the AutoVault wheel beside the title.
 * When the sidebar is collapsed to icons, only a small square mark is shown.
 */
export function DealershipBrand({ title, logoUrl, logoWide, className }: BrandProps & { className?: string }) {
  const collapsedMark = logoUrl && !logoWide ? <LogoImage src={logoUrl} alt="" className="size-8 rounded-md" /> : logoUrl ? <Initial title={title} /> : <BrandMark className="size-8" />

  if (logoUrl && logoWide) {
    return (
      <span className={cn("flex w-full items-center justify-center", className)}>
        <LogoImage src={logoUrl} alt={title} className="block h-auto max-h-16 w-full max-w-56 object-contain group-data-[collapsible=icon]:hidden" />
        <span className="hidden group-data-[collapsible=icon]:block">{collapsedMark}</span>
      </span>
    )
  }
  return (
    <span className={cn("flex w-full items-center gap-3", className)}>
      {logoUrl ? (
        <LogoImage src={logoUrl} alt="" className="size-11 shrink-0 rounded-lg object-contain group-data-[collapsible=icon]:size-8" />
      ) : (
        <BrandMark className="size-11 shrink-0 group-data-[collapsible=icon]:size-8" />
      )}
      <span className="line-clamp-2 min-w-0 flex-1 text-left font-heading whitespace-normal break-words text-lg leading-tight font-bold tracking-tight group-data-[collapsible=icon]:hidden">{title}</span>
    </span>
  )
}

function Initial({ title }: { title: string }) {
  return (
    <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
      {title.trim().charAt(0).toUpperCase()}
    </span>
  )
}

// Logos come from our own authenticated API, which next/image's optimizer can't call with the user's cookie, so a plain
// <img> is the right tool here.
function LogoImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} />
}

