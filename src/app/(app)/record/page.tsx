import { Mic } from "lucide-react";

import { Card } from "@/components/ui/Card";

export const metadata = { title: "Record — EverMoments" };

export default function RecordPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl text-stone-800">Record a story</h1>
        <p className="mt-1 text-stone-600">
          Capture a memory in the storyteller&apos;s own voice.
        </p>
      </div>

      <Card>
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-warm-500 text-white shadow-sm">
            <Mic size={34} aria-hidden="true" />
          </span>
          <h2 className="mt-5 font-heading text-xl text-stone-700">
            Recording is coming soon
          </h2>
          <p className="mt-1 max-w-md text-sm text-stone-500">
            In an upcoming phase you&apos;ll be able to record audio, add details, and
            save stories directly to your archive.
          </p>
        </div>
      </Card>
    </div>
  );
}
