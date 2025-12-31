"use client";

import { useCallback, useEffect, useId, useState } from "react";

import { createTrip } from "@/app/_actions/trips";
import MaterialButton from "@/components/ui/MaterialButton";
import MaterialCard from "@/components/ui/MaterialCard";
import MaterialInput from "@/components/ui/MaterialInput";

export function CreateTripModal({
  triggerLabel = "Create a Trip",
}: {
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const dialogTitleId = useId();

  const close = useCallback(() => setOpen(false), []);
  const openModal = useCallback(() => setOpen(true), []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }

    if (open) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }

    return;
  }, [close, open]);

  return (
    <>
      <MaterialButton variant="filled" onClick={openModal}>
        {triggerLabel}
      </MaterialButton>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4"
        >
          <button
            type="button"
            onClick={close}
            className="absolute inset-0 bg-black/40"
            aria-label="Close"
          />

          <MaterialCard className="relative h-full w-full max-w-lg overflow-auto p-4 md:h-auto md:rounded-3xl md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 id={dialogTitleId} className="text-lg font-semibold tracking-tight">
                  Create trip
                </h2>
                <p className="text-sm text-[#C4C7C5]">
                  Add a trip and invite members.
                </p>
              </div>

              <button
                type="button"
                onClick={close}
                className="rounded-full px-3 py-1 text-sm text-[#C4C7C5] hover:text-[#E3E3E3]"
              >
                Close
              </button>
            </div>

            <form action={createTrip} className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-sm font-medium text-[#E3E3E3]">
                  Trip name
                </span>
                <MaterialInput
                  name="name"
                  required
                  placeholder="e.g., Japan 2026"
                />
              </label>

              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-sm font-medium text-[#E3E3E3]">
                  Destination
                </span>
                <MaterialInput
                  name="destination"
                  required
                  placeholder="e.g., Tokyo"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[#E3E3E3]">
                  Start date
                </span>
                <MaterialInput
                  name="start_date"
                  type="date"
                  required
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[#E3E3E3]">
                  End date
                </span>
                <MaterialInput
                  name="end_date"
                  type="date"
                  required
                />
              </label>

              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-sm font-medium text-[#E3E3E3]">
                  Notes (optional)
                </span>
                <textarea
                  name="notes"
                  rows={3}
                  className="w-full rounded-t-lg rounded-b-none border-0 border-b border-white/10 bg-[#2A2A2A] px-4 py-3 text-[#E3E3E3] outline-none transition-colors placeholder:text-[#C4C7C5] focus:border-b-2 focus:border-[#A8C7FA]"
                  placeholder="Anything the group should know (meeting points, budget rules, etc.)"
                />
              </label>

              <div className="md:col-span-2">
                <MaterialButton type="submit" variant="filled" className="mt-1 w-full">
                  Create
                </MaterialButton>
              </div>
            </form>
          </MaterialCard>
        </div>
      ) : null}
    </>
  );
}

export default CreateTripModal;
