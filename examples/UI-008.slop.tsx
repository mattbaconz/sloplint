import { Spinner } from './spinner';

export function SaveButton({ saving, onSave }: { saving: boolean; onSave: () => void }) {
  return (
    <button type="button" onClick={onSave} className="rounded-md bg-zinc-900 px-4 py-2 text-white">
      {saving ? <Spinner className="h-4 w-4 animate-spin" /> : 'Save changes'}
    </button>
  );
}
