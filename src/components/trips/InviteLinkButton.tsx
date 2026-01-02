"use client";

import { useState, useTransition } from "react";
import { Copy, Share2 } from "lucide-react";
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

  async function handleShare(url: string) {
    try {
      const nav = navigator as unknown as { share?: (data: { url: string }) => Promise<void> };
      if (typeof nav.share === "function") {
        await nav.share({ url });
        return;
      }
    } catch {
      // fall back to copy
    }
    await copy(url);
  }

  return (
    <div className="mt-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={lastUrl ?? ""}
            placeholder="trip.link/xyz…"
            className="h-11 w-full rounded-full border border-white/10 bg-[#2A2A2A] px-4 text-sm text-[#E3E3E3] placeholder:text-[#C4C7C5] outline-none"
            aria-label="Invite link"
          />

          <MaterialButton
            variant="tonal"
            onClick={lastUrl ? () => copy(lastUrl) : handleClick}
            disabled={isPending}
            className="h-11 whitespace-nowrap"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            {isPending ? "Working…" : lastUrl ? "Copy Link" : "Get Link"}
          </MaterialButton>

          <MaterialButton
            variant="text"
            onClick={lastUrl ? () => handleShare(lastUrl) : handleClick}
            disabled={isPending}
            className="h-11 w-11 px-0"
            aria-label="Share invite link"
          >
            <Share2 className="h-5 w-5" aria-hidden="true" />
          </MaterialButton>
        </div>
      </div>
    </div>
  );
}
