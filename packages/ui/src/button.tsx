"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "./cn";

export const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,color,border-color,transform,opacity] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-fg/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand text-on-brand shadow-[0_8px_24px_-10px_rgb(61_220_151/0.7)] hover:bg-brand/90",
        tonal: "border border-brand/25 bg-brand/10 text-brand hover:border-brand/40 hover:bg-brand/15",
        secondary: "border border-line bg-surface-2 text-fg hover:border-line-strong hover:bg-surface-3",
        ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg",
        outline: "border border-line-strong text-fg hover:bg-surface-2",
        positive: "bg-positive text-canvas hover:bg-positive/90",
        danger: "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/15",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-[15px]",
        xl: "h-14 px-7 text-base",
        icon: "size-9",
        "icon-sm": "size-7 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
