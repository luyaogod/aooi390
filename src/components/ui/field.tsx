import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "./label"

interface FieldProps extends React.ComponentProps<"div"> {
  label: string
  htmlFor?: string
}

function Field({ label, htmlFor, className, children, ...props }: FieldProps) {
  return (
    <div
      data-slot="field"
      className={cn(
        "flex flex-col gap-1.5",
        className
      )}
      {...props}
    >
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

export { Field }
