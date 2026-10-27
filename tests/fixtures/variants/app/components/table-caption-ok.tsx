// expect: none
// The visually hidden caption sits at the table's top-left corner, so it cannot widen the page even though the wrapper is not positioned.
export function Stats({ rows }: { rows: { id: string; label: string; value: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[34rem] tabular-nums">
        <caption className="sr-only">Weekly totals</caption>
        <thead>
          <tr><th>Metric</th><th>Value</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => <tr key={r.id}><td>{r.label}</td><td>{r.value}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}
