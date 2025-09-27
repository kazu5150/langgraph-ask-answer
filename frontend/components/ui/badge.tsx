import * as React from "react";
import { cn } from "@/components/ui/utils";

export function Badge({
  className,
  variant = "secondary",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "secondary" | "destructive" }) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
  const map = {
    default: "bg-black text-white",
    secondary: "bg-gray-100 text-gray-900",
    destructive: "bg-red-100 text-red-700",
  } as const;
  return <div className={cn(base, map[variant], className)} {...props} />;
}
