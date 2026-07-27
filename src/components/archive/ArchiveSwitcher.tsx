"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";

import { setActiveArchiveAction } from "@/lib/actions/archive-actions";

interface ArchiveSwitcherOption {
  id: string;
  name: string;
}

interface ArchiveSwitcherProps {
  archives: ArchiveSwitcherOption[];
  activeArchiveId: string;
}

export function ArchiveSwitcher({
  archives,
  activeArchiveId,
}: ArchiveSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onChange(nextId: string) {
    if (nextId === activeArchiveId) return;
    setError(null);
    const result = await setActiveArchiveAction({ archiveId: nextId });
    if (!result.ok) {
      setError(result.error ?? "Could not switch archive.");
      return;
    }
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor="active-archive"
        className="text-xs font-medium uppercase tracking-wide text-stone-500"
      >
        Active archive
      </label>
      <div className="relative">
        <select
          id="active-archive"
          value={activeArchiveId}
          disabled={isPending}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-stone-300 bg-white py-2.5 pl-4 pr-10 text-base font-medium text-stone-900 outline-none focus:border-warm-400 focus:ring-2 focus:ring-warm-200 disabled:opacity-60 sm:w-64"
        >
          {archives.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <ChevronsUpDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
          aria-hidden
        />
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
