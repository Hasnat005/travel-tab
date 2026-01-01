"use client";

import type { ReactNode } from "react";

import { useTripTabTransition } from "@/components/trips/TripTabTransitionContext";

type Props = {
  tabKey: string;
  children: ReactNode;
  className?: string;
};

export default function TripGoToTabButton({ tabKey, children, className }: Props) {
  const { goToTab, isPending } = useTripTabTransition();

  return (
    <button
      type="button"
      onClick={() => goToTab(tabKey)}
      disabled={isPending}
      className={(
        (className ?? "") + (isPending ? " pointer-events-none opacity-70" : "")
      ).trim()}
    >
      {children}
    </button>
  );
}
