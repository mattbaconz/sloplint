import { Spinner } from './spinner';

export function SaveButton({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return (
    <button type="button" onClick={onSave} aria-busy={saving} disabled={saving} className="relative rounded-md bg-zinc-900 px-4 py-2 text-white">
      <span className={saving ? 'invisible' : undefined}>Save changes</span>
      {saving && <Spinner className="absolute inset-0 m-auto h-4 w-4 animate-spin" />}
    </button>
  );
}
