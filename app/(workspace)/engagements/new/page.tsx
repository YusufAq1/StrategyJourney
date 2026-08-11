import Link from "next/link";
import { NewClientForm } from "./new-client-form";
import { HomeSidebar } from "@/app/_components/home-sidebar";

// Stands up a new client (engagement). Lives outside the [id] layout, so it has
// its own lightweight header rather than the workspace nav.
export default function NewClientPage() {
  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900">
      <HomeSidebar />

      <div className="min-w-0 flex-1">
        <header className="border-b border-neutral-200 bg-white/80 backdrop-blur">
          <div className="px-8 py-6">
            <Link href="/" className="text-xs font-medium text-neutral-400 hover:text-brand-500">
              ← All clients
            </Link>
            <h1 className="mt-2 text-xl font-bold text-neutral-900">New client</h1>
            <p className="text-sm text-neutral-500">Capture who they are and what the strategy must answer.</p>
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-8 py-8">
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-card">
            <NewClientForm />
          </div>
        </main>
      </div>
    </div>
  );
}
