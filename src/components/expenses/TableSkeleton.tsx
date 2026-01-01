import Skeleton from "@/components/ui/Skeleton";

type Props = {
  rows?: number;
};

export default function TableSkeleton({ rows = 5 }: Props) {
  return (
    <div aria-hidden="true" className="w-full">
      {/* Header */}
      <div className="grid grid-cols-12 items-center gap-4 border-b border-white/10 pb-3">
        <Skeleton variant="text" className="col-span-2 h-3 w-14" />
        <Skeleton variant="text" className="col-span-6 h-3 w-24" />
        <Skeleton variant="text" className="col-span-2 h-3 w-20" />
        <div className="col-span-2 flex justify-end">
          <Skeleton variant="text" className="h-3 w-12" />
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/5">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="grid h-14 grid-cols-12 items-center gap-4 py-2">
            <Skeleton variant="text" className="col-span-2 h-4 w-20" />
            <Skeleton variant="text" className="col-span-6 h-4 w-[85%]" />
            <Skeleton variant="text" className="col-span-2 h-4 w-[70%]" />
            <div className="col-span-2 flex justify-end">
              <Skeleton variant="text" className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
