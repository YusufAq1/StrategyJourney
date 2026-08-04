// Placeholder landing page. The Consultant Workspace routes
// (/engagements/[id]/...) are built from Step 3 onward — see CLAUDE.md §12.
export default function Home() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-xl font-semibold">Strategy Journey Platform</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Consultant Workspace — prototype v0.1. Step 1 in place: schema,
        intake enforcement, the AI write boundary, and node provenance.
      </p>
    </main>
  );
}
