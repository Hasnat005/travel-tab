export default function TripNotFound() {
  return (
    <div className="rounded-lg border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-black">
      <h1 className="text-xl font-semibold tracking-tight">Trip not found</h1>
      <p className="mt-2 text-sm text-black/60 dark:text-zinc-400">
        The trip you’re looking for doesn’t exist or you don’t have access.
      </p>
    </div>
  );
}
