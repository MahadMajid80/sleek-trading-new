import Image from "next/image"

export function BrandMark({ className }: { className?: string }) {
  return <Image src="/brand/mark.png" alt="AutoVault" width={64} height={64} className={className} />
}
