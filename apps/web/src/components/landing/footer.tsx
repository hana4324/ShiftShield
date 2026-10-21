import Link from "next/link";
import { BUSINESS } from "@shiftshield/shared";
import { BrandLogo } from "@/components/brand/logo";
import { Icons } from "@/components/icons";
import { LEGAL_DOCS } from "@/lib/legal-docs";
import { Container } from "./section";

// Static so the footer prerenders; bump once a year.
const COPYRIGHT_YEAR = 2026;

export function Footer() {
  return (
    <footer className="bg-navy-950 pt-14 pb-10 text-steel-400">
      <Container>
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <BrandLogo height={30} />
            <p className="mt-4 max-w-sm text-sm leading-relaxed">
              {BUSINESS.positioning}. Connecting licensed Texas security officers with the
              properties that need them, starting in {BUSINESS.launchMarket.split(",")[0]}.
            </p>
            <p className="mt-5 text-sm font-semibold tracking-[0.18em] text-white uppercase">
              {BUSINESS.secondaryLine}
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold tracking-wider text-white uppercase">Contact</h2>
            <address className="mt-4 space-y-2 text-sm not-italic">
              <p className="flex items-start gap-2">
                <Icons.MapPin size={16} className="mt-0.5 shrink-0" />
                <span>
                  {BUSINESS.legalName}
                  <br />
                  {BUSINESS.address.line1}
                  <br />
                  {BUSINESS.address.city}, {BUSINESS.address.state} {BUSINESS.address.zip}
                </span>
              </p>
              <p className="flex items-center gap-2">
                <Icons.Phone size={16} className="shrink-0" />
                <a
                  href={`tel:${BUSINESS.phoneE164}`}
                  className="rounded focus-ring hover:text-white"
                >
                  {BUSINESS.phone}
                </a>
              </p>
            </address>
          </div>

          <div>
            <h2 className="text-sm font-bold tracking-wider text-white uppercase">Legal</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {LEGAL_DOCS.map((d) => (
                <li key={d.slug}>
                  <Link href={`/legal/${d.slug}`} className="rounded focus-ring hover:text-white">
                    {d.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {COPYRIGHT_YEAR} {BUSINESS.legalName}. All rights reserved.
          </p>
          <p>
            Officers are independent contractors licensed by the Texas DPS Private Security Program.
          </p>
        </div>
      </Container>
    </footer>
  );
}
