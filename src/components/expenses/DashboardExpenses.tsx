import MaterialCard from "@/components/ui/MaterialCard";
import TableSkeleton from "@/components/expenses/TableSkeleton";

export type DashboardExpenseRow = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: string;
};

type Props = {
  isLoading: boolean;
  rows?: DashboardExpenseRow[];
};

export default function DashboardExpenses({ isLoading, rows = [] }: Props) {
  return (
    <MaterialCard>
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">Expenses</h2>
        <p className="text-sm text-[#C4C7C5]">Latest expenses logged for this trip.</p>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <TableSkeleton rows={5} />
        ) : (
          <div className="w-full">
            <div className="grid grid-cols-12 items-center gap-4 border-b border-white/10 pb-3 text-xs text-[#C4C7C5]">
              <div className="col-span-2">Date</div>
              <div className="col-span-6">Description</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>

            <div className="divide-y divide-white/5">
              {rows.map((r) => (
                <div key={r.id} className="grid h-14 grid-cols-12 items-center gap-4 py-2">
                  <div className="col-span-2 text-sm text-[#C4C7C5]">{r.date}</div>
                  <div className="col-span-6 truncate text-sm text-[#E3E3E3]">{r.description}</div>
                  <div className="col-span-2 text-sm text-[#C4C7C5]">{r.category}</div>
                  <div className="col-span-2 text-right text-sm font-medium tabular-nums text-[#E3E3E3]">
                    {r.amount}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </MaterialCard>
  );
}
