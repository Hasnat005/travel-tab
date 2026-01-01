import { getUserTrips } from "@/app/_actions/trips";
import CreateTripModal from "@/components/trips/CreateTripModal";
import TripCard from "@/components/trips/TripCard";

export default async function TripsPage({
  searchParams,
}: {
  searchParams?: Promise<{ message?: string }>;
}) {
  const params = (await searchParams) ?? {};

  const trips = await getUserTrips();

  return (
    <div className="space-y-8">
      <header className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">Your Trips</h1>
          <p className="text-sm text-[#C4C7C5]">
            Create a trip and start tracking shared expenses.
          </p>
        </div>

        <div className="shrink-0">
          <CreateTripModal triggerLabel="Create a Trip" />
        </div>
      </header>

      {params.message ? (
        <p className="rounded-lg border border-black/8 bg-white px-3 py-2 text-sm text-black/70 dark:border-white/[.145] dark:bg-black dark:text-zinc-300">
          {params.message}
        </p>
      ) : null}

      <section>
        {trips.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 text-center">
            <svg
              width="220"
              height="160"
              viewBox="0 0 220 160"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="opacity-90"
            >
              <rect x="16" y="24" width="188" height="112" rx="28" fill="#1E1E1E" />
              <rect x="36" y="46" width="148" height="12" rx="6" fill="#2A2A2A" />
              <rect x="36" y="70" width="112" height="12" rx="6" fill="#2A2A2A" />
              <circle cx="62" cy="110" r="14" fill="#2A2A2A" />
              <circle cx="110" cy="110" r="14" fill="#2A2A2A" />
              <circle cx="158" cy="110" r="14" fill="#2A2A2A" />
              <path
                d="M36 110 C60 92, 84 128, 110 110 C136 92, 160 128, 184 110"
                stroke="#A8C7FA"
                strokeWidth="3"
                strokeLinecap="round"
                opacity="0.7"
              />
            </svg>

            <div className="space-y-2">
              <p className="text-lg font-semibold">No trips yet</p>
              <p className="max-w-md text-sm text-[#C4C7C5]">
                Create your first trip to start splitting expenses with friends.
              </p>
            </div>

            <CreateTripModal triggerLabel="Create a Trip" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                id={trip.id}
                name={trip.name}
                destination={trip.destination}
                start_date={trip.start_date}
                end_date={trip.end_date}
                memberCount={trip._count.members}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
