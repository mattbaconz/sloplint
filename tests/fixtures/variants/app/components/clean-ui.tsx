// expect: none
import { Spinner } from './spinner';

export function Totals({ saving, total, count }: { saving: boolean; total: number; count: number }) {
  return (
    <section className="rounded-lg border border-zinc-200 p-4">
      <dl className="grid grid-cols-2 gap-4">
        <div><dt>Orders</dt><dd className="stat tabular-nums">{count.toLocaleString()}</dd></div>
        <div><dt>Revenue</dt><dd className="stat tabular-nums">{total.toFixed(2)}</dd></div>
      </dl>
      <button type="button" aria-busy={saving} className="relative rounded-md bg-zinc-900 px-4 py-2 text-white transition-colors">
        <span className={saving ? 'invisible' : undefined}>Save changes</span>
        {saving && <Spinner className="absolute inset-0 m-auto h-4 w-4" />}
      </button>
    </section>
  );
}
