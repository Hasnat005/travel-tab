import Link from "next/link";

import MaterialCard from "@/components/ui/MaterialCard";

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export type TripCardProps = {
  id: string;
  name: string;
  destination: string;
  start_date: Date;
  end_date: Date;
  memberCount: number;
};

export function TripCard(props: TripCardProps) {
  const { id, name, destination, start_date, end_date, memberCount } = props;

  return (
    <Link
      href={`/trips/${id}`}
      className="block"
    >
      <MaterialCard className="group overflow-hidden p-0 transition-all hover:shadow-md">
        <div className="h-37.5 rounded-t-3xl bg-[#2A2A2A] p-4 md:p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-[#C4C7C5]">
            Destination
          </p>
          <p className="mt-1 line-clamp-2 text-lg font-semibold tracking-tight text-[#E3E3E3]">
            {destination}
          </p>
        </div>

        <div className="p-4 md:p-6">
          <p className="text-lg font-semibold tracking-tight text-[#E3E3E3]">{name}</p>
          <p className="mt-2 text-sm text-[#C4C7C5]">
            {formatDate(start_date)} → {formatDate(end_date)}
          </p>
          <p className="mt-3 text-sm text-[#C4C7C5]">
            {memberCount} member{memberCount === 1 ? "" : "s"}
          </p>
        </div>
      </MaterialCard>
    </Link>
  );
}

export default TripCard;
