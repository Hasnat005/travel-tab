import MaterialCard from "@/components/ui/MaterialCard";

export default function LoadingTripDetailsPage() {
  return (
    <div className="-mx-4 -my-4 flex flex-col gap-6 p-4 md:-mx-6 md:-my-6 md:grid md:grid-cols-12 md:gap-8 md:p-8 lg:-mx-8 lg:-my-8">
      <div className="md:col-span-12">
        <MaterialCard>
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="h-9 w-56 animate-pulse rounded bg-white/10 md:h-10 md:w-72" />
              <div className="h-4 w-80 animate-pulse rounded bg-white/5" />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[18px] bg-[#2A2A2A] p-5 md:p-8">
                <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
                <div className="mt-3 h-8 w-40 animate-pulse rounded bg-white/10" />
              </div>
              <div className="rounded-[18px] bg-[#2A2A2A] p-5 md:p-8">
                <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
                <div className="mt-3 h-8 w-40 animate-pulse rounded bg-white/10" />
              </div>
            </div>

            <div className="scrollbar-hide -mx-4 overflow-x-auto px-4">
              <div className="flex w-max items-center gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-10 w-28 animate-pulse rounded-full bg-white/10" />
                ))}
              </div>
            </div>
          </div>
        </MaterialCard>
      </div>

      <div className="flex flex-col gap-6 md:col-span-8">
        <MaterialCard>
          <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-[18px] bg-[#2A2A2A] p-5 md:p-8">
                <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
                <div className="mt-4 h-6 w-32 animate-pulse rounded bg-white/10" />
              </div>
            ))}
          </div>
        </MaterialCard>
      </div>

      <div className="hidden md:block md:col-span-4">
        <div className="flex justify-end">
          <div className="h-14 w-14 animate-pulse rounded-full bg-white/10" />
        </div>
      </div>
    </div>
  );
}
