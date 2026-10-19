import { Skeleton, SkeletonCards } from "@/components/ui/feedback";
export default function Loading() {
  return (
    <div aria-label="Loading requests">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <div className="mt-6"><SkeletonCards count={6} /></div>
    </div>
  );
}
