/** Shown inside the admin shell while a page's data streams in. */
export default function AdminLoading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-6">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-56 rounded-lg bg-line" />
      <div className="h-64 rounded-xl border border-line bg-card" />
    </div>
  );
}
