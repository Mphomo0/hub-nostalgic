import type { ReactNode } from "react";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">Last updated: {updated}</p>
      <div className="mt-10 space-y-4 leading-relaxed [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5 [&_blockquote]:rounded-lg [&_blockquote]:border [&_blockquote]:border-line [&_blockquote]:bg-card [&_blockquote]:p-4">
        {children}
      </div>
    </article>
  );
}
