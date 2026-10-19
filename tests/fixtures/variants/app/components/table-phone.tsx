// expect: UI-015
export function Releases({ rows }: { rows: { id: string; title: string; price: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[640px] tabular-nums">
        <thead>
          <tr><th>Release</th><th>Price</th><th><span className="sr-only">Order</span></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => <tr key={r.id}><td>{r.title}</td><td>{r.price}</td><td><button type="button">Order</button></td></tr>)}
        </tbody>
      </table>
    </div>
  );
}
