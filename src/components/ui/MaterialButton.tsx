import * as React from "react";

type Variant = "filled" | "tonal" | "text";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** Optional floating-action styling (pill/circle). */
  fab?: boolean;
};

export default function MaterialButton({
  variant = "filled",
  fab = false,
  className,
  type,
  ...props
}: Props) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium transition-all disabled:opacity-60 disabled:pointer-events-none";

  const byVariant: Record<Variant, string> = {
    filled:
      "bg-[#A8C7FA] text-[#062E6F] rounded-full px-6 py-3 hover:shadow-md",
    tonal: "bg-[#333537] text-[#A8C7FA] rounded-full px-6 py-3",
    text: "bg-transparent text-[#A8C7FA] rounded-full px-4 py-2 hover:bg-white/5",
  };

  const fabClass = fab
    ? "h-14 rounded-full px-6 py-0 bg-[#A8C7FA] text-[#062E6F] hover:shadow-md"
    : "";

  return (
    <button
      type={type ?? "button"}
      className={[base, fab ? fabClass : byVariant[variant], className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
