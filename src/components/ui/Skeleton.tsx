import type { CSSProperties } from "react";

type SkeletonVariant = "text" | "rectangular" | "circular";

type Props = {
  width?: string | number;
  height?: string | number;
  variant?: SkeletonVariant;
  className?: string;
};

function toSize(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

export default function Skeleton({ width, height, variant = "rectangular", className }: Props) {
  const style: CSSProperties = {
    width: toSize(width),
    height: toSize(height),
  };

  const radius =
    variant === "circular" ? "rounded-full" : variant === "text" ? "rounded-md" : "rounded-md";

  // Defaults preserve layout without forcing inline sizing.
  const baseSize =
    variant === "text" ? "h-4 w-full" : variant === "circular" ? "h-10 w-10" : "h-10 w-full";

  return (
    <div
      aria-hidden="true"
      className={("tt-skeleton " + radius + " " + baseSize + (className ? " " + className : "")).trim()}
      style={width !== undefined || height !== undefined ? style : undefined}
    />
  );
}
