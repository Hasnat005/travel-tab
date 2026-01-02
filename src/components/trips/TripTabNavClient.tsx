"use client";

import { useTripTabTransition } from "@/components/trips/TripTabTransitionContext";

export default function TripTabNavClient() {
  const { currentTab, isPending, pendingTab, tabItems, goToTab, prefetchTab } = useTripTabTransition();

  return (
    <div className="scrollbar-hide -mx-4 mt-5 overflow-x-auto px-4">
      <div className="flex w-max items-center gap-2 whitespace-nowrap">
        {tabItems.map((t) => {
          const active = currentTab === t.key;
          const isThisPending = isPending && pendingTab === t.key;

          return (
            <button
              key={t.key}
              type="button"
              onClick={() => goToTab(t.key)}
              onMouseEnter={() => prefetchTab(t.key)}
              onFocus={() => prefetchTab(t.key)}
              disabled={isPending}
              className={
                "inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors " +
                (active
                  ? "bg-[#333537] text-[#E3E3E3]"
                  : "bg-transparent text-[#C4C7C5] hover:bg-white/5 hover:text-[#E3E3E3]") +
                (isThisPending ? " animate-pulse" : "")
              }
              aria-current={active ? "page" : undefined}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
