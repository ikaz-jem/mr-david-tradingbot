export function WorkspacePageLoading() {
  return <div role="status" aria-label="Opening page" className="space-y-6 motion-safe:animate-pulse">
    <div className="space-y-3">
      <div className="h-2.5 w-28 rounded-full bg-accent/20"/>
      <div className="h-9 w-64 max-w-full rounded-xl bg-white/10"/>
      <div className="h-3 w-96 max-w-full rounded-full bg-white/[.07]"/>
    </div>
    <div className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => <div key={index} className="surface h-28 rounded-[18px]"/>)}
    </div>
    <div className="surface h-72 rounded-[20px]"/>
    <span className="sr-only">Opening page…</span>
  </div>;
}
