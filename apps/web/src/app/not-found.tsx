import { BrandLogo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-navy-950 px-4 py-24 text-center text-white">
      <BrandLogo height={36} />
      <h1 className="mt-10 text-4xl font-extrabold tracking-tight">Post not found.</h1>
      <p className="mt-3 max-w-md text-steel-400">
        That page does not exist. Head back to the main site to join the pilot or sign up as an
        officer.
      </p>
      <div className="mt-8">
        <ButtonLink href="/">Back to ShiftShield</ButtonLink>
      </div>
    </main>
  );
}
