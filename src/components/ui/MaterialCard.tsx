import * as React from "react";

type Props = React.HTMLAttributes<HTMLDivElement>;

export default function MaterialCard({ className, ...props }: Props) {
  return (
    <div
      className={
        [
          "rounded-[24px] bg-[#1E1E1E]",
          "border border-white/5",
          "break-words",
          "p-4 md:p-6",
          className,
        ]
          .filter(Boolean)
          .join(" ")
      }
      {...props}
    />
  );
}
