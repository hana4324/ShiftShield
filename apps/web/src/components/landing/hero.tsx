import { BUSINESS } from "@shiftshield/shared";
import { Icons } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "./section";

/** A static preview of the officer's "Nearby Open Shifts" card from the mobile mockup. */
function ShiftCardPreview() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto w-full max-w-sm rounded-3xl bg-navy-900 p-4 shadow-glow ring-1 ring-white/10 select-none"
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <p className="text-xs text-steel-400">Hi, Marcus</p>
          <p className="text-sm font-semibold text-white">Dallas, TX</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-status-green/15 px-2.5 py-1 text-xs font-semibold text-status-green">
          <span className="size-1.5 rounded-full bg-status-green" />
          Available
        </span>
      </div>

      <p className="mb-2 px-1 text-xs font-bold tracking-wider text-steel-400 uppercase">
        Nearby Open Shifts
      </p>

      <div className="space-y-2.5">
        {[
          {
            title: "Night Security",
            site: "Senior Living Community",
            time: "10:00 PM - 6:00 AM",
            dist: "3.2 mi",
            rate: "$26",
            ago: "12m",
          },
          {
            title: "Front Desk Officer",
            site: "Hospital",
            time: "6:00 PM - 2:00 AM",
            dist: "5.8 mi",
            rate: "$28",
            ago: "41m",
          },
          {
            title: "Event Security",
            site: "Event",
            time: "5:00 PM - 1:00 AM",
            dist: "14 mi",
            rate: "$24",
            ago: "2h",
          },
        ].map((s) => (
          <div key={s.title} className="rounded-2xl bg-white p-3.5 text-navy-950 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] leading-tight font-bold">{s.title}</p>
                <p className="mt-0.5 text-xs font-medium text-navy-950/60">{s.site}</p>
              </div>
              <span className="shrink-0 rounded-full bg-status-green-700 px-2.5 py-1 text-sm font-extrabold text-white">
                {s.rate}
                <span className="text-[10px] font-semibold">/hr</span>
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-3 text-xs text-navy-950/70">
              <span className="inline-flex items-center gap-1">
                <Icons.Clock size={14} /> {s.time}
              </span>
              <span className="inline-flex items-center gap-1">
                <Icons.MapPin size={14} /> {s.dist}
              </span>
              <span className="ml-auto text-navy-950/60">Posted {s.ago} ago</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 px-1">
        {[
          ["Shifts", "4"],
          ["Hours", "32"],
          ["Earned", "$864"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white/5 p-2.5 text-center ring-1 ring-white/10">
            <p className="text-lg font-extrabold text-white">{v}</p>
            <p className="text-[10px] font-semibold tracking-wider text-steel-400 uppercase">{k}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <div className="relative overflow-hidden bg-navy-950 bg-grid-navy text-white">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-blue-600/25 blur-3xl" />
      <Container className="relative grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-steel-400 ring-1 ring-white/15 ring-inset">
            <Icons.ShieldCheck size={14} className="text-blue-600" />
            Now enrolling the {BUSINESS.launchMarket.split(",")[0]} 30-day pilot
          </p>
          <h1 className="text-5xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            Coverage when you need it.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-steel-400 sm:text-xl">
            ShiftShield connects licensed Texas security officers with open shifts at your
            properties, often within the hour. Post the shift, we match verified officers, you track
            them on site and pay only for approved hours.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="#pilot" size="lg">
              Join the 30-Day Pilot
              <Icons.ArrowRight size={18} />
            </ButtonLink>
            <ButtonLink href="#officers" variant="secondary" size="lg">
              I&apos;m a security officer
            </ButtonLink>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-steel-400">
            {[
              "Texas DPS license verified",
              "GPS clock-in at your site",
              "Employer sets the rate",
            ].map((t) => (
              <li key={t} className="inline-flex items-center gap-2">
                <Icons.Check size={16} className="text-status-green" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <ShiftCardPreview />
      </Container>
    </div>
  );
}
