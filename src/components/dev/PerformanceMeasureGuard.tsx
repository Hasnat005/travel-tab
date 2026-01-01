"use client";

import { useEffect } from "react";

declare global {
  var __traveltabPerfMeasurePatched: boolean | undefined;
}

type MeasureFn = {
  (name: string): PerformanceMeasure;
  (name: string, startMark: string, endMark: string): PerformanceMeasure;
  (name: string, options: PerformanceMeasureOptions): PerformanceMeasure;
};

export default function PerformanceMeasureGuard() {
  useEffect(() => {
    if (globalThis.__traveltabPerfMeasurePatched) return;
    globalThis.__traveltabPerfMeasurePatched = true;

    if (typeof performance === "undefined" || typeof performance.measure !== "function") {
      return;
    }

    const originalMeasure = performance.measure.bind(performance) as unknown as MeasureFn;

    // Guard against a dev-only Next/Turbopack bug where a measure call can be
    // attempted with a negative timestamp (which throws and breaks rendering).
    const patchedMeasure: MeasureFn = ((
      name: string,
      arg2?: string | PerformanceMeasureOptions,
      arg3?: string
    ) => {
      try {
        if (arg2 && typeof arg2 === "object") {
          const options = arg2;
          const start = typeof options.start === "number" ? Math.max(0, options.start) : options.start;
          const end = typeof options.end === "number" ? Math.max(0, options.end) : options.end;
          const duration =
            typeof options.duration === "number" ? Math.max(0, options.duration) : options.duration;

          return originalMeasure(name, { ...options, start, end, duration });
        }

        if (typeof arg2 === "string" && typeof arg3 === "string") {
          return originalMeasure(name, arg2, arg3);
        }

        return originalMeasure(name);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          // Swallow in dev to avoid breaking the app.
          console.warn("Ignored invalid performance.measure call", name, err);
          return;
        }
        throw err;
      }
    }) as MeasureFn;

    (performance as unknown as { measure: MeasureFn }).measure = patchedMeasure;
  }, []);

  return null;
}
