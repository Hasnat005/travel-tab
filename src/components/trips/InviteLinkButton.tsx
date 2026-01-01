"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import MaterialButton from "@/components/ui/MaterialButton";
import { createTripInvite } from "@/app/_actions/trips";

export default function InviteLinkButton({ tripId }: { tripId: string }) {
  const [isPending, startTransition] = useTransition();
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } catch {
      toast.success(url);
    }
  }

  function handleClick() {
    startTransition(async () => {
      try {
        const res = await createTripInvite(tripId);
        if (!res.success) {
          toast.error(res.message);
          return;
        }
        setLastUrl(res.url);
        await copy(res.url);
      } catch {
        toast.error("Failed to create invite link");
      }
    });
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <MaterialButton variant="tonal" onClick={handleClick} disabled={isPending} className="h-11">
          {isPending ? "Generating…" : "Invite Link"}
        </MaterialButton>
        {lastUrl ? (
          <MaterialButton
            variant="text"
            onClick={() => copy(lastUrl)}
            disabled={isPending}
            className="h-11"
          >
            Copy Link
          </MaterialButton>
        ) : null}
      </div>
    </div>
  );
}
