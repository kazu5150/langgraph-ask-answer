import * as React from "react";
import { cn } from "@/components/ui/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none",
        "focus:border-black focus:ring-0",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
