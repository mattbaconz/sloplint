// expect: none
// The wrapper is positioned, so the hidden label stays inside it; the wide table hides columns on phones.
export function Releases({ rows }: { rows: { id: string; title: string; format: string; run: string; price: string }[] }) {
  return (
    <>
      <div className="relative overflow-x-auto">
        <table className="min-w-[640px] tabular-nums">
          <thead>
            <tr><th>Release</th><th>Price</th><th><span className="sr-only">Order</span></th></tr>
          </thead>
        </table>
      </div>
      <table className="tabular-nums">
        <thead>
          <tr><th>No.</th><th>Release</th><th className="hidden md:table-cell">Format</th><th className="hidden md:table-cell">Run</th><th>Price</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => <tr key={r.id}><td>{r.id}</td><td>{r.title}</td><td className="hidden md:table-cell">{r.format}</td><td className="hidden md:table-cell">{r.run}</td><td>{r.price}</td></tr>)}
        </tbody>
      </table>
    </>
  );
}
