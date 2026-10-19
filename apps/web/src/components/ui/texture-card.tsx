import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * TextureCard — adapted from Cult UI's TextureCard pattern
 * (https://www.cult-ui.com/docs/components/texture-card): a composable,
 * layered-border card (outer shell + inner surface + header/content/footer
 * slots) rebuilt on this app's shadcn tokens so it stays dependency-free.
 */
export function TextureCard({ children, className, hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={cn("texture-card rounded-2xl p-1.5", hover && "texture-card-hover", className)}>
      <div className="rounded-[calc(1rem-0.375rem)] bg-background/40 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">{children}</div>
    </div>
  );
}
export function TextureCardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>{children}</div>;
}
export function TextureCardContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-3", className)}>{children}</div>;
}
export function TextureCardFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3", className)}>{children}</div>;
}
export function TextureCardSeparator() {
  return <div className="my-3 h-px bg-border/70" aria-hidden />;
}
