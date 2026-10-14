import { Badge } from "@/components/ui/badge"

/** A vehicle is sold once a cash sale or hire purchase agreement uses it. */
export function StockBadge({ sold }: { sold: boolean }) {
  return sold ? (
    <Badge variant="outline" className="gap-1.5 text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground" />
      Sold
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1.5 border-success/30 bg-success/12 text-success">
      <span className="size-1.5 rounded-full bg-success" />
      Available
    </Badge>
  )
}
