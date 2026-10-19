import { SkeletonCards } from "@/components/ui/feedback";
export default function Loading() {
  return <div aria-label="Loading"><SkeletonCards count={3} /></div>;
}
