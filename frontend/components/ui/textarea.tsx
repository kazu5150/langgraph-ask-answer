import * as React from "react";
import { cn } from "@/components/ui/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
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
Textarea.displayName = "Textarea";
