import Link from "next/link";
import { NewClientForm } from "./new-client-form";

// Stands up a new client (engagement). Lives outside the [id] layout, so it has
// its own lightweight header rather than the workspace nav.
export default function NewClientPage() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-2xl px-6 py-5">
          <Link href="/" className="text-xs font-medium text-[#1B4F91] hover:underline">
            ← All clients
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-[#13294B]">New client</h1>
          <p className="text-sm text-neutral-500">Capture who they are and what the strategy must answer.</p>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-8">
        <div className="rounded-lg border border-neutral-200 bg-white p-6">
          <NewClientForm />
        </div>
      </main>
    </div>
  );
}
