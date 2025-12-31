import * as React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

const MaterialInput = React.forwardRef<HTMLInputElement, Props>(function MaterialInput(
  { className, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={
        [
          "h-11 w-full",
          "bg-[#2A2A2A] text-[#E3E3E3] placeholder:text-[#C4C7C5]",
          "rounded-t-lg rounded-b-none",
          "px-4",
          "border-0 border-b border-white/10",
          "outline-none",
          "focus:border-b-2 focus:border-[#A8C7FA]",
          "transition-colors",
          className,
        ]
          .filter(Boolean)
          .join(" ")
      }
      {...props}
    />
  );
});

export default MaterialInput;
