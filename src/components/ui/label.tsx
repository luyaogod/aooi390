import * as React from "react"

import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-sm text-muted-foreground leading-none font-medium select-none",
        "group-data-disabled:opacity-50 group-data-disabled:pointer-events-none",
        className
      )}
      {...props}
    />
  )
}

export { Label }
