import { Archive as ArchiveIcon, Users } from "lucide-react";

import { Card, CardTitle, CardDescription } from "@/components/ui/Card";

export const metadata = { title: "Archive — EverMoments" };

export default function ArchivePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl text-stone-800">Archive</h1>
        <p className="mt-1 text-stone-600">
          Manage your family archive and the people you share it with.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-warm-100">
              <ArchiveIcon size={24} className="text-warm-600" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>Archive details</CardTitle>
              <CardDescription>
                Name your archive and add a description. Archive management arrives in a
                later phase.
              </CardDescription>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest-100">
              <Users size={24} className="text-forest-600" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>Members</CardTitle>
              <CardDescription>
                Invite family members as contributors or viewers. Invitations arrive in a
                later phase.
              </CardDescription>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
