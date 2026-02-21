"use client";

type EnvFieldsProps = {
  entries: [string, string][];
  onAdd: () => void;
  onUpdate: (index: number, isKey: boolean, value: string) => void;
  onRemove: (index: number) => void;
};

export function EnvFields({ entries, onAdd, onUpdate, onRemove }: EnvFieldsProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Environment variables
        </label>
        <button type="button" onClick={onAdd} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          + Add
        </button>
      </div>
      <div className="space-y-2">
        {entries.map(([k, v], i) => (
          <div key={i} className="flex gap-2">
            <input
              type="text"
              value={k}
              onChange={(e) => onUpdate(i, true, e.target.value)}
              placeholder="KEY"
              className="flex-1 px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 font-mono text-sm"
            />
            <input
              type="text"
              value={v}
              onChange={(e) => onUpdate(i, false, e.target.value)}
              placeholder="value"
              className="flex-1 px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="px-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
