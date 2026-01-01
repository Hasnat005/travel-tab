export default function LoadingTripsPage() {
  return (
    <div className="space-y-8">
      <header className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div className="space-y-3">
          <div className="h-10 w-52 animate-pulse rounded bg-white/10 md:h-12 md:w-64" />
          <div className="h-4 w-72 animate-pulse rounded bg-white/5" />
        </div>
        <div className="h-11 w-40 animate-pulse rounded-full bg-white/10" />
      </header>

      <section>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-3xl border border-white/10 bg-black"
            >
              <div className="h-36 animate-pulse bg-white/5" />
              <div className="space-y-3 p-6">
                <div className="h-5 w-3/4 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-white/5" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
