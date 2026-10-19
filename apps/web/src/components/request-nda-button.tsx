"use client";

import { useState, useTransition } from "react";
import { requestNdaAndGo } from "@/lib/actions";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";

export function RequestNdaButton({ studentId, videoId }: { studentId: string; videoId?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-2">
      <Button
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await requestNdaAndGo(studentId, videoId);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {pending ? "Requesting…" : "Request NDA"}
      </Button>
      {error ? <Alert>{error}</Alert> : null}
    </div>
  );
}
