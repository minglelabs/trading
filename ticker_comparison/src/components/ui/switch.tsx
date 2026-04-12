"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type SwitchProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> & {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  size?: "sm" | "default"
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked = false,
      className,
      disabled = false,
      onCheckedChange,
      onClick,
      size = "default",
      type,
      ...props
    },
    ref
  ) => {
    return (
      <button
        {...props}
        ref={ref}
        type={type ?? "button"}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        data-slot="switch"
        data-size={size}
        data-checked={checked ? "" : undefined}
        data-unchecked={checked ? undefined : ""}
        data-disabled={disabled ? "" : undefined}
        className={cn(
          "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=default]:h-[18.4px] data-[size=default]:w-[32px] data-[size=sm]:h-[14px] data-[size=sm]:w-[24px] dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
          className
        )}
        onClick={(event) => {
          onClick?.(event)
          if (event.defaultPrevented || disabled) {
            return
          }
          onCheckedChange?.(!checked)
        }}
      >
        <span
          aria-hidden="true"
          data-slot="switch-thumb"
          className="pointer-events-none block rounded-full bg-background ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-[calc(100%-2px)] group-data-[size=sm]/switch:data-checked:translate-x-[calc(100%-2px)] dark:data-checked:bg-primary-foreground group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 dark:data-unchecked:bg-foreground"
        />
      </button>
    )
  }
)

Switch.displayName = "Switch"

export { Switch }
