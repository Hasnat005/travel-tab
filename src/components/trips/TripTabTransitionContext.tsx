"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type TabItem = { key: string; label: string };

type TripTabTransitionContextValue = {
  tripId: string;
  currentTab: string;
  isPending: boolean;
  pendingTab: string | null;
  tabItems: TabItem[];
  goToTab: (tabKey: string) => void;
};

const TripTabTransitionContext = createContext<TripTabTransitionContextValue | null>(null);

export function TripTabTransitionProvider({
  tripId,
  currentTab,
  tabItems,
  children,
}: {
  tripId: string;
  currentTab: string;
  tabItems: TabItem[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  // When the server-rendered tab becomes the requested tab, treat it as completed.
  const effectivePendingTab = pendingTab && pendingTab === currentTab ? null : pendingTab;

  const goToTab = useCallback(
    (tabKey: string) => {
      if (!tabKey || tabKey === currentTab) return;
      setPendingTab(tabKey);
      // Perf: startTransition keeps UI responsive while Next fetches the new RSC payload.
      startTransition(() => {
        router.replace(`/trips/${tripId}?tab=${encodeURIComponent(tabKey)}`, { scroll: false });
      });
    },
    [currentTab, router, tripId]
  );

  // `useTransition` can be false briefly even though we already initiated navigation.
  // Treat `pendingTab` as the source of truth for immediate UI feedback.
  const navigating = isPending || effectivePendingTab !== null;

  const value = useMemo(
    () => ({ tripId, currentTab, isPending: navigating, pendingTab: effectivePendingTab, tabItems, goToTab }),
    [tripId, currentTab, navigating, effectivePendingTab, tabItems, goToTab]
  );

  return (
    <TripTabTransitionContext.Provider value={value}>
      {children}
    </TripTabTransitionContext.Provider>
  );
}

export function useTripTabTransition() {
  const ctx = useContext(TripTabTransitionContext);
  if (!ctx) {
    throw new Error("useTripTabTransition must be used within TripTabTransitionProvider");
  }
  return ctx;
}
