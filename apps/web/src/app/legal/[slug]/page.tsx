import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BUSINESS } from "@shiftshield/shared";
import { LogoLink } from "@/components/brand/logo";
import { Footer } from "@/components/landing/footer";
import { Container } from "@/components/landing/section";
import { LEGAL_DOCS, getLegalDoc } from "@/lib/legal-docs";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) return {};
  return {
    title: doc.title,
    description: `${doc.title} for ShiftShield (version ${doc.version}).`,
    robots: { index: false, follow: true },
  };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getLegalDoc(slug);
  if (!doc) notFound();

  return (
    <>
      <header className="border-b border-white/10 bg-navy-950">
        <Container className="flex h-16 items-center">
          <LogoLink height={30} />
        </Container>
      </header>
      <main className="flex-1 bg-slate-50 py-14">
        <Container className="max-w-3xl">
          <p className="mb-2 text-xs font-bold tracking-[0.18em] text-blue-700 uppercase">
            Legal &middot; version {doc.version}
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight">{doc.title}</h1>

          <div className="mt-8 rounded-2xl border border-status-amber/40 bg-status-amber/10 p-5 text-sm leading-relaxed text-navy-950">
            <p className="font-bold">Placeholder</p>
            <p className="mt-1">
              This document has not been written yet. Final language will be provided by counsel and
              published here with a version number. Users accept each document by version, and the
              acceptance is recorded with a timestamp.
            </p>
          </div>

          <h2 className="mt-10 text-lg font-bold">This document will cover</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] text-navy-950/80">
            {doc.covers.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>

          <p className="mt-10 text-sm text-navy-950/60">
            Questions: {BUSINESS.legalName}, {BUSINESS.address.full}, {BUSINESS.phone}.
          </p>

          <nav
            aria-label="Other legal documents"
            className="mt-12 border-t border-navy-950/10 pt-6"
          >
            <p className="text-xs font-bold tracking-wider text-steel-400 uppercase">
              Other documents
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {LEGAL_DOCS.filter((d) => d.slug !== doc.slug).map((d) => (
                <li key={d.slug}>
                  <Link
                    href={`/legal/${d.slug}`}
                    className="font-medium text-blue-700 underline-offset-4 hover:underline"
                  >
                    {d.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </main>
      <Footer />
    </>
  );
}
