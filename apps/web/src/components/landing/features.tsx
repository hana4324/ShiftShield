import { Icons, type IconName } from "@/components/icons";
import { Eyebrow, Heading, Lede, Section } from "./section";

const features: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: "FileCheck",
    title: "License verification",
    body: "Every officer uploads a Texas DPS guard card. Admins review it against the state lookup before approval, and expired licenses are blocked automatically.",
  },
  {
    icon: "Zap",
    title: "Real-time shift matching",
    body: "Available, qualified officers within their travel radius get a push notification the moment you publish. Pro and Enterprise shifts are notified first.",
  },
  {
    icon: "MapPin",
    title: "GPS check-in / check-out",
    body: "Clock-in only works inside your site's geofence. You see on-shift officers on a live map and get a GPS-stamped timesheet afterward.",
  },
  {
    icon: "Dollar",
    title: "Fast payments",
    body: "Officers see the full posted rate with no deductions and are paid through Stripe after approval. Employers pay only for approved hours.",
  },
  {
    icon: "Star",
    title: "Ratings and reviews",
    body: "Two-way ratings after every shift. Officers build a reliability score; sites build a reputation officers want to work at.",
  },
  {
    icon: "Message",
    title: "In-app messaging",
    body: "One thread per shift between your team and the booked officers, with phone numbers shared only during the booking window.",
  },
  {
    icon: "AlertTriangle",
    title: "Incident reporting",
    body: "Officers file incident reports with photos, time and location from the shift screen. You are notified immediately, with a record kept for the file.",
  },
];

export function Features() {
  return (
    <Section id="features" tone="navy">
      <Eyebrow tone="navy">Features</Eyebrow>
      <Heading tone="navy">
        Everything a security director would build if they had the time.
      </Heading>
      <Lede tone="navy">
        No generic gig-app guesswork. The workflow follows how security staffing actually runs in
        Texas.
      </Lede>
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => {
          const Icon = Icons[f.icon];
          return (
            <li key={f.title} className="rounded-2xl bg-navy-900 p-6 ring-1 ring-white/10">
              <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-blue-600/15 text-blue-600">
                <Icon size={22} />
              </div>
              <h3 className="text-lg font-bold tracking-tight text-white">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-steel-400">{f.body}</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
