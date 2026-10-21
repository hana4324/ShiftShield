import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { Footer } from "@/components/landing/footer";
import { Founder } from "@/components/landing/founder";
import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { OfficerForm } from "@/components/landing/officer-form";
import { PilotForm } from "@/components/landing/pilot-form";
import { Plans } from "@/components/landing/plans";
import { Problem } from "@/components/landing/problem";
import { Eyebrow, Heading, Lede, Section } from "@/components/landing/section";

export default function HomePage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus-ring focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-navy-950"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1">
        <Hero />
        <Problem />
        <HowItWorks />
        <Features />
        <Plans />
        <Founder />
        <Faq />

        <Section id="pilot" tone="light">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
            <div>
              <Eyebrow>30-day pilot</Eyebrow>
              <Heading>Be one of the first Dallas-Fort Worth employers on ShiftShield.</Heading>
              <Lede>
                We are onboarding a small group of security companies, senior living communities,
                hospitals, apartments, hotels and venues for the launch pilot. You get 30 days
                before billing starts and direct access to the founder.
              </Lede>
              <ul className="mt-6 space-y-3 text-[15px] text-navy-950/80">
                {[
                  "Hands-on setup of your sites and post orders",
                  "Priority matching for your first shifts",
                  "Your feedback shapes the product before public launch",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <span className="mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-status-green/15 text-status-green">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m5 12 4.5 4.5L19 7" />
                      </svg>
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <PilotForm />
          </div>
        </Section>

        <Section id="officers" tone="navy">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
            <div>
              <Eyebrow tone="navy">For security officers</Eyebrow>
              <Heading tone="navy">
                Pick up shifts near you. Keep every dollar of the posted rate.
              </Heading>
              <Lede tone="navy">
                Upload your Texas guard card once, set how far you will travel, and accept shifts
                from your phone. Clock in with GPS, clock out, get paid through Stripe.
              </Lede>
            </div>
            <OfficerForm />
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
