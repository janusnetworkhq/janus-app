import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">404</p>
      <h1 className="text-2xl font-semibold">That page is not in the portal</h1>
      <Link href="/feed" className={cn(buttonVariants())}>
        Back to feed
      </Link>
    </div>
  );
}
