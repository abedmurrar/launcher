"use client";

import { useState } from "react";
import type { CommandFormData, CommandFormProps } from "./types";
import { envToEntries, entriesToEnv } from "./env-utils";
import { EnvFields } from "./EnvFields";

const inputClass =
  "w-full px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100";
const labelClass = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";

export type { CommandFormData } from "./types";

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
        <label className={labelClass}>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
          placeholder="My command"
          required
        />
      </div>
      <div>
        <label className={labelClass}>Command</label>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          className={`${inputClass} font-mono`}
          placeholder="npm run dev"
          required
        />
      </div>
      <div>
        <label className={labelClass}>Working directory</label>
        <input
          type="text"
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
          className={`${inputClass} font-mono`}
          placeholder="/path/to/project (optional)"
        />
      </div>
      <EnvFields
        entries={envEntries}
        onAdd={addEnv}
        onUpdate={updateEnv}
        onRemove={removeEnv}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
