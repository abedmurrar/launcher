"use client";

import { useState } from "react";

type GroupFormProps = {
  initialName?: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel?: () => void;
};

export function GroupForm({ initialName = "", onSubmit, onCancel }: GroupFormProps) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(name.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-center">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1 px-3 py-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
        placeholder="Group name"
        required
      />
      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 rounded bg-zinc-800 dark:bg-zinc-200 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
      >
        {submitting ? "…" : "Save"}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          Cancel
        </button>
      )}
    </form>
  );
}
