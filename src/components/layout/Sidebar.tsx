"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Mic,
  Archive,
  User,
  LogOut,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", Icon: LayoutDashboard },
  { label: "Library", href: "/library", Icon: BookOpen },
  { label: "Record", href: "/record", Icon: Mic },
  { label: "Archive", href: "/archive", Icon: Archive },
  { label: "Account", href: "/account", Icon: User },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-stone-200 lg:bg-warm-50">
      <div className="flex h-16 items-center gap-2 px-6">
        <span className="font-heading text-2xl text-warm-700">EverMoments</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ label, href, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium transition-colors",
                active
                  ? "bg-warm-100 text-warm-800"
                  : "text-stone-600 hover:bg-warm-100/60 hover:text-stone-900",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={22} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-stone-200 p-3">
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-base font-medium text-stone-600 transition-colors hover:bg-warm-100/60 hover:text-stone-900"
        >
          <LogOut size={22} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
