"use client";

import { useState } from "react";

export type CommandFormData = {
  name: string;
  command: string;
  cwd: string;
  env: Record<string, string>;
};

const emptyForm: CommandFormData = {
  name: "",
  command: "",
  cwd: "",
  env: {},
};

type CommandFormProps = {
  initial?: Partial<CommandFormData>;
  onSubmit: (data: CommandFormData) => Promise<void>;
  onCancel?: () => void;
};

function envToEntries(env: Record<string, string>): [string, string][] {
  return Object.entries(env).sort((a, b) => a[0].localeCompare(b[0]));
}

function entriesToEnv(entries: [string, string][]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (k.trim() !== "") out[k.trim()] = v;
  }
  return out;
}

export function CommandForm({ initial, onSubmit, onCancel }: CommandFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [command, setCommand] = useState(initial?.command ?? "");
  const [cwd, setCwd] = useState(initial?.cwd ?? "");
  const [envEntries, setEnvEntries] = useState<[string, string][]>(envToEntries(initial?.env ?? {}));
  const [submitting, setSubmitting] = useState(false);

  const addEnv = () => setEnvEntries((e) => [...e, ["", ""]]);
  const updateEnv = (i: number, key: boolean, value: string) => {
    setEnvEntries((e) => {
      const next = [...e];
      if (key) next[i] = [value, next[i][1]];
      else next[i] = [next[i][0], value];
      return next;
    });
  };
  const removeEnv = (i: number) => setEnvEntries((e) => e.filter((_, j) => j !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        command: command.trim(),
        cwd: cwd.trim(),
        env: entriesToEnv(envEntries),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
          placeholder="My command"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Command
        </label>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono"
          placeholder="npm run dev"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
          Working directory
        </label>
        <input
          type="text"
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
          className="w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono"
          placeholder="/path/to/project (optional)"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Environment variables
          </label>
          <button type="button" onClick={addEnv} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {envEntries.map(([k, v], i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={k}
                onChange={(e) => updateEnv(i, true, e.target.value)}
                placeholder="KEY"
                className="flex-1 px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 font-mono text-sm"
              />
              <input
                type="text"
                value={v}
                onChange={(e) => updateEnv(i, false, e.target.value)}
                placeholder="value"
                className="flex-1 px-2 py-1.5 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 font-mono text-sm"
              />
              <button type="button" onClick={() => removeEnv(i)} className="px-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded">
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
