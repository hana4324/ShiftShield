import { Icons, type IconName } from "@/components/icons";
import { Eyebrow, Heading, Lede, Section } from "./section";

interface Step {
  icon: IconName;
  title: string;
  body: string;
}

const employerSteps: Step[] = [
  {
    icon: "Building",
    title: "Post",
    body: "Pick the site, set the hours and your hourly rate, choose the license level. See the full cost before you publish.",
  },
  {
    icon: "Zap",
    title: "Match",
    body: "Verified officers nearby are notified instantly. Review applicants or let the first qualified officer auto-accept.",
  },
  {
    icon: "MapPin",
    title: "Track",
    body: "GPS clock-in inside your site's geofence, live location while on shift, incident reports straight to your phone.",
  },
  {
    icon: "Star",
    title: "Rate",
    body: "Approve the timesheet, pay only for approved hours, and rate the officer so the best ones rise to the top.",
  },
];

const officerSteps: Step[] = [
  {
    icon: "FileCheck",
    title: "Verify",
    body: "Upload your Texas DPS guard card once. We check it, run the background check, and you're approved to work.",
  },
  {
    icon: "Search",
    title: "Find",
    body: "Browse open shifts on a map with the rate right on the pin. Filter by distance, hours, and license level.",
  },
  {
    icon: "Clock",
    title: "Clock in",
    body: "Tap to clock in when you arrive. Location is only tracked during the shift, never in the background otherwise.",
  },
  {
    icon: "Dollar",
    title: "Get paid",
    body: "The posted rate is what you earn, no deductions. Payouts go straight to your bank through Stripe.",
  },
];

function Steps({ steps, label }: { steps: Step[]; label: string }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-2" aria-label={label}>
      {steps.map((s, i) => {
        const Icon = Icons[s.icon];
        return (
          <li
            key={s.title}
            className="flex gap-4 rounded-2xl bg-white p-5 shadow-card ring-1 ring-navy-950/5"
          >
            <div className="flex shrink-0 flex-col items-center gap-2">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                <Icon size={20} />
              </span>
              <span className="text-xs font-bold text-steel-400">0{i + 1}</span>
            </div>
            <div>
              <h4 className="text-base font-bold tracking-tight">{s.title}</h4>
              <p className="mt-1 text-[15px] leading-relaxed text-navy-950/70">{s.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function HowItWorks() {
  return (
    <Section id="how-it-works" tone="white">
      <Eyebrow>How it works</Eyebrow>
      <Heading>Post a shift tonight. Have it covered by a verified officer.</Heading>
      <Lede>
        Two sides, one app. Employers post and track; officers verify, accept and get paid.
      </Lede>
      <div className="mt-12 grid gap-12 lg:grid-cols-2 lg:gap-10">
        <div>
          <h3 className="mb-5 flex items-center gap-2 text-lg font-bold">
            <Icons.Building size={20} className="text-blue-700" /> For employers
          </h3>
          <Steps steps={employerSteps} label="Steps for employers" />
        </div>
        <div>
          <h3 className="mb-5 flex items-center gap-2 text-lg font-bold">
            <Icons.ShieldCheck size={20} className="text-blue-700" /> For officers
          </h3>
          <Steps steps={officerSteps} label="Steps for officers" />
        </div>
      </div>
    </Section>
  );
}
