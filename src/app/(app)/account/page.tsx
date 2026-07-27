import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/Avatar";
import { Card, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account — EverMoments" };

export default async function AccountPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fullName =
    (user?.user_metadata?.full_name as string | undefined) ?? null;
  const email = user?.email ?? "—";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl text-stone-800">Account</h1>
        <p className="mt-1 text-stone-600">
          Your profile and account settings.
        </p>
      </div>

      <Card>
        <div className="flex items-center gap-4">
          <Avatar name={fullName} size="lg" />
          <div>
            <p className="font-heading text-xl text-stone-800">
              {fullName ?? "Your name"}
            </p>
            <p className="text-sm text-stone-500">{email}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Profile settings</CardTitle>
        <CardDescription>
          Editing your name and avatar will be available in a later phase.
        </CardDescription>
        <div className="mt-4">
          <Badge variant="neutral">Coming soon</Badge>
        </div>
      </Card>
    </div>
  );
}
