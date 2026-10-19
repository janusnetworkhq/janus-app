"use client";

import { hideVideo, setUserStatus } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function VideoModerationButtons({ id, status }: { id: string; status: string }) {
  const hidden = status === "HIDDEN";
  return (
    <form
      action={async () => {
        await hideVideo(id, hidden ? "READY" : "HIDDEN");
      }}
    >
      <Button type="submit" size="sm" variant={hidden ? "secondary" : "danger"}>
        {hidden ? "Restore" : "Hide"}
      </Button>
    </form>
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
