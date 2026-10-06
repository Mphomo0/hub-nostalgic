import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted">This link may have expired or been typed incorrectly.</p>
      <Link href="/" className="mt-6 font-semibold text-brand-strong underline">Go to the home page</Link>
    </main>
  );
}
