import { Icons } from "@/components/icons";
import { Eyebrow, Heading, Section } from "./section";

const faqs: Array<{ q: string; a: string }> = [
  {
    q: "Who are the officers?",
    a: "Independent security officers licensed through the Texas DPS Private Security Program. We support Level II (non-commissioned, unarmed), Level III (commissioned, armed) and Level IV (personal protection). Every license is reviewed before an officer can accept a shift, and expired licenses are blocked automatically.",
  },
  {
    q: "How fast can a shift be filled?",
    a: "Officers near your site who are marked Available get a push notification the moment you publish. Auto-accept shifts are filled by the first qualified officer who taps Accept. Enterprise can post with no lead time; Pro needs 4 hours and Essential 24 hours.",
  },
  {
    q: "Who sets the pay rate?",
    a: "You do. ShiftShield never changes it and the officer never sees a deduction. Our platform fee is added on top of the posted rate and shown to you before you publish.",
  },
  {
    q: "When am I charged?",
    a: "When an officer is confirmed for a shift, the shift total (officer pay plus platform fee) is held on your card through Stripe. After clock-out you approve the timesheet, and the officer is paid for approved hours only. Any difference is refunded.",
  },
  {
    q: "What happens if an officer does not show up?",
    a: "If an officer has not clocked in 30 minutes after start, they are marked as a no-show, you are refunded for that officer, and the spot is reopened as urgent. Repeated no-shows deactivate an officer's account.",
  },
  {
    q: "Is officer location tracked all the time?",
    a: "No. Location is tracked only while an officer is clocked in to a shift at your site, from clock-in to clock-out. It is never tracked in the background otherwise.",
  },
  {
    q: "What does the pilot include?",
    a: "Pilot participants get full access for 30 days before billing starts, hands-on onboarding from the founder, and a direct line for feedback. You choose a plan at the end of the pilot.",
  },
  {
    q: "Do you store my card or bank details?",
    a: "Never. All payments run through Stripe. Officers connect their bank through Stripe's hosted onboarding, and employers save a payment method with Stripe.",
  },
];

export function Faq() {
  return (
    <Section id="faq" tone="white">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <Eyebrow>FAQ</Eyebrow>
          <Heading>Questions we get from security directors</Heading>
          <p className="mt-4 text-navy-950/70">
            Anything else? Call{" "}
            <a
              className="font-semibold text-blue-700 underline-offset-4 hover:underline"
              href="tel:+12542764393"
            >
              (254) 276-4393
            </a>
            .
          </p>
        </div>
        <div className="divide-y divide-navy-950/10 rounded-2xl bg-slate-50 ring-1 ring-navy-950/5">
          {faqs.map((f) => (
            <details key={f.q} className="group px-5">
              <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-4 text-left text-[15px] font-semibold focus-ring sm:text-base">
                {f.q}
                <Icons.ChevronDown
                  size={20}
                  className="shrink-0 text-steel-400 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="pb-5 text-[15px] leading-relaxed text-navy-950/70">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
