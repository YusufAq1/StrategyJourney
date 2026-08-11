import Link from "next/link";

// The one place the product name is set. Every shell (home, engagement
// workspace) renders this at the top of its left sidebar.
export function BrandMark() {
  return (
    <Link href="/" className="block">
      <span className="text-[17px] font-extrabold leading-none tracking-tight text-neutral-900">
        Strategy <span className="text-brand-500">Journey</span>
      </span>
    </Link>
  );
}
