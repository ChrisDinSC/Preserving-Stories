"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Mic,
  Archive,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", Icon: LayoutDashboard },
  { label: "Library", href: "/library", Icon: BookOpen },
  { label: "Record", href: "/record", Icon: Mic },
  { label: "Archive", href: "/archive", Icon: Archive },
  { label: "Account", href: "/account", Icon: User },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-warm-50 lg:hidden">
      <ul className="flex items-stretch justify-around">
        {navItems.map(({ label, href, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors",
                  active ? "text-warm-700" : "text-stone-500 hover:text-stone-700",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={22} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
