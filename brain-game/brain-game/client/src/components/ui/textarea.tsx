"use client";

import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[96px] w-full rounded-2xl border border-input/85 bg-white/82 px-4 py-3 text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_1px_2px_rgba(15,23,42,0.06)] ring-offset-background transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-primary/55 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
