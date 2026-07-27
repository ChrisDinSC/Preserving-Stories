import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { TopBar } from "@/components/layout/TopBar";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ?? null;
  const avatarUrl =
    (user.user_metadata?.avatar_url as string | undefined) ?? null;

  return (
    <div className="flex min-h-screen bg-warm-50">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <TopBar name={fullName} avatarUrl={avatarUrl} />
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-10 lg:py-10 lg:pb-10">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
