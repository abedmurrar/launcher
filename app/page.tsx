"use client";

import { useState } from "react";
import { CommandList } from "@/components/CommandList";
import { GroupList } from "@/components/GroupList";

type Tab = "commands" | "groups";

export default function Home() {
  const [tab, setTab] = useState<Tab>("commands");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">
            Launcher
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-0.5">
            Run and manage commands locally. Use only on localhost.
          </p>
        </div>
        <nav className="max-w-4xl mx-auto px-4 flex gap-1 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setTab("commands")}
            className={`px-4 py-2 text-sm font-medium rounded-t -mb-px ${
              tab === "commands"
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-b-0 border-zinc-200 dark:border-zinc-700"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
            }`}
          >
            Commands
          </button>
          <button
            type="button"
            onClick={() => setTab("groups")}
            className={`px-4 py-2 text-sm font-medium rounded-t -mb-px ${
              tab === "groups"
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-b-0 border-zinc-200 dark:border-zinc-700"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
            }`}
          >
            Groups
          </button>
        </nav>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">
        {tab === "commands" && <CommandList />}
        {tab === "groups" && <GroupList />}
      </main>
    </div>
  );
}
