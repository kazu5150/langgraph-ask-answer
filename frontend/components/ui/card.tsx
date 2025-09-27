import * as React from "react";
import { cn } from "@/components/ui/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-gray-200 bg-white p-4 shadow-soft",
        className
      )}
      {...props}
    />
  );
}
