import Link from "next/link";
import { LogoLink } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "./section";

const nav = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#plans", label: "Plans" },
  { href: "#faq", label: "FAQ" },
  { href: "#officers", label: "For officers" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy-950/90 backdrop-blur supports-[backdrop-filter]:bg-navy-950/75">
      <Container className="flex h-16 items-center justify-between gap-4">
        <LogoLink height={32} priority />
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-steel-400 focus-ring hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <ButtonLink href="#pilot" variant="primary" size="md" className="shrink-0">
          Join the Pilot
        </ButtonLink>
      </Container>
    </header>
  );
}
