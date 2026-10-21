import { Icons } from "@/components/icons";
import { Container } from "./section";

const credentials = [
  { icon: Icons.ShieldCheck, label: "Licensed armed security officer (Texas Level III)" },
  { icon: Icons.Building, label: "Former security director" },
  { icon: Icons.Medal, label: "U.S. Army veteran" },
  { icon: Icons.Users, label: "Security industry veteran" },
];

export function Founder() {
  return (
    <section id="founder" className="scroll-mt-20 bg-white py-16 sm:py-24">
      <Container>
        <div className="grid items-center gap-10 rounded-3xl bg-navy-950 p-8 text-white ring-1 ring-white/10 sm:p-12 lg:grid-cols-[auto_1fr]">
          {/* Founder photo placeholder: drop apps/web/public/brand/founder.jpg and swap this block for <Image>. */}
          <div
            aria-hidden="true"
            className="mx-auto flex size-40 items-center justify-center rounded-3xl bg-navy-800 text-5xl font-extrabold text-steel-400 ring-1 ring-white/10 sm:size-48"
          >
            AJ
          </div>
          <div>
            <p className="mb-3 text-xs font-bold tracking-[0.18em] text-blue-600 uppercase">
              Built by someone from the industry
            </p>
            <h2 className="text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
              Ashley Jackson, Founder
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-steel-400">
              &ldquo;I have worked the overnight post, and I have been the director scrambling to
              fill it. ShiftShield is the tool I wished I had both times: verified officers, honest
              pay, and proof they were on site.&rdquo;
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {credentials.map((c) => (
                <li key={c.label} className="flex items-center gap-3 text-sm font-medium">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600/15 text-blue-600">
                    <c.icon size={18} />
                  </span>
                  {c.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
