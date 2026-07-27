import { Avatar } from "@/components/ui/Avatar";

interface TopBarProps {
  name?: string | null;
  avatarUrl?: string | null;
}

/**
 * Mobile top bar shown above the content on small screens. Displays the
 * wordmark and the signed-in user's avatar. Hidden on desktop (lg+).
 */
export function TopBar({ name, avatarUrl }: TopBarProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-stone-200 bg-warm-50 px-4 lg:hidden">
      <span className="font-heading text-xl text-warm-700">EverMoments</span>
      <Avatar name={name} src={avatarUrl} size="sm" />
    </header>
  );
}
