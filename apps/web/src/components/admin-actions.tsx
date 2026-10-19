"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { hideVideo, moderateVideo, setUserStatus } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function VideoModerationButtons({
  id,
  status,
  deleted,
}: {
  id: string;
  status: string;
  deleted?: boolean;
}) {
  const hidden = status === "HIDDEN";
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (deleted) return <span className="text-xs text-muted-foreground">Deleted by author</span>;
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        variant={hidden ? "secondary" : "danger"}
        onClick={() =>
          start(async () => {
            const res = await hideVideo(id, hidden ? "READY" : "HIDDEN");
            setError(res.error ?? null);
            if (!res.error) router.refresh();
          })
        }
      >
        {hidden ? "Restore" : "Hide"}
      </Button>
      {error ? <span role="alert" className="max-w-48 text-xs text-red-400">{error}</span> : null}
    </div>
  );
}

export function ModerationDecisionButtons({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const decide = (decision: "APPROVE" | "REJECT") =>
    start(async () => {
      const res = await moderateVideo(id, decision);
      setError(res.error ?? null);
      if (!res.error) router.refresh();
    });
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={() => decide("APPROVE")}>
          Approve
        </Button>
        <Button type="button" size="sm" variant="danger" disabled={pending} onClick={() => decide("REJECT")}>
          Reject
        </Button>
      </div>
      {error ? <span role="alert" className="text-xs text-red-400">{error}</span> : null}
    </div>
  );
}

export function UserModerationButtons({ id, status }: { id: string; status: string }) {
  const suspended = status === "SUSPENDED";
  return (
    <form
      action={async () => {
        await setUserStatus(id, suspended ? "ACTIVE" : "SUSPENDED");
      }}
    >
      <Button type="submit" size="sm" variant={suspended ? "secondary" : "danger"}>
        {suspended ? "Restore" : "Suspend"}
      </Button>
    </form>
  );
}
