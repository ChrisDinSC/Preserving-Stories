export default function InvitationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-warm-100 to-warm-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="font-heading text-4xl text-warm-700">EverMoments</span>
          <p className="mt-2 text-base text-stone-600">
            You&apos;ve been invited to a family archive.
          </p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
