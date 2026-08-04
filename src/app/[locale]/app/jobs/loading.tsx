/**
 * Loading state (§29). A skeleton in the shape of the list, so the page does
 * not jump when the data lands.
 */
export default function JobsLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-28 animate-pulse rounded-full bg-slate-200" />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
    </div>
  );
}
