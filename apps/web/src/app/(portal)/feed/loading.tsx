import { Skeleton } from "@/components/ui/feedback";
export default function Loading() {
  return (
    <div aria-label="Loading feed" className="mx-auto max-w-md">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="mt-6 aspect-[9/16] w-full" />
      <Skeleton className="mt-3 h-4 w-2/3" />
    </div>
  );
}
