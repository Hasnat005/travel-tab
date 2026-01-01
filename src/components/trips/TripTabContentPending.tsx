"use client";

import type { ReactNode } from "react";

import { useTripTabTransition } from "@/components/trips/TripTabTransitionContext";

export default function TripTabContentPending({ children }: { children: ReactNode }) {
  const { isPending } = useTripTabTransition();

  return (
    <div className="relative min-h-[60vh]" aria-busy={isPending}>
      <div className={isPending ? "blur-sm" : ""}>{children}</div>

      <div
        className={
          "absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-black/40 backdrop-blur-sm transition-opacity duration-200 " +
          (isPending ? "opacity-100" : "pointer-events-none opacity-0")
        }
      >
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/80"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
