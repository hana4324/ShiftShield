import { Icons } from "@/components/icons";
import { Eyebrow, Heading, Lede, Section } from "./section";

const problems = [
  {
    icon: Icons.PhoneOff,
    title: "Last-minute call-outs",
    body: "An officer calls in sick at 8 PM and the post still has to be covered at 10. Right now that means working the phone until someone says yes.",
  },
  {
    icon: Icons.Clock,
    title: "Hours lost finding replacements",
    body: "Supervisors and property managers burn evenings and weekends texting lists of names, with no idea who is actually available or close by.",
  },
  {
    icon: Icons.FileCheck,
    title: "No easy license verification",
    body: "Texas requires a current DPS guard card. Checking it by hand for every fill-in is slow, and skipping it is a liability you cannot afford.",
  },
];

export function Problem() {
  return (
    <Section id="problem" tone="light">
      <Eyebrow>The problem</Eyebrow>
      <Heading>Open posts cost you money, sleep, and sometimes the contract.</Heading>
      <Lede>
        Security directors and property managers told us the same three things. ShiftShield was
        built by one of them to fix all three.
      </Lede>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {problems.map((p) => (
          <div
            key={p.title}
            className="rounded-2xl bg-white p-6 shadow-card ring-1 ring-navy-950/5"
          >
            <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-status-red/10 text-status-red">
              <p.icon size={22} />
            </div>
            <h3 className="text-lg font-bold tracking-tight">{p.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-navy-950/70">{p.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
