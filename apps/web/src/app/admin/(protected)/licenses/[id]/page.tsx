import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { TX_DPS_LICENSE_LOOKUP_URL } from "@shiftshield/shared";
import { Card, ErrorPanel, Facts, NotConfigured, PageHeader, Skeleton, StatusPill } from "@/components/admin/ui";
import { buttonClasses } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin-auth";
import { fmtDate, fmtDateTime } from "@/lib/admin/format";
import { attempt, fetchLicenseDetail, isUuid, signedUrls } from "@/lib/admin/queries";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "License review" };

type Params = Promise<{ id: string }>;

function LicenseImage({ label, url, path }: { label: string; url: string | undefined; path: string }) {
  const isPdf = /\.pdf$/i.test(path);
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-xs font-semibold tracking-wider text-steel-400 uppercase">{label}</figcaption>
      {!url ? (
        <div className="flex aspect-[1.6] items-center justify-center rounded-xl bg-slate-50 p-4 text-center text-sm text-navy-950/60 ring-1 ring-navy-950/10">
          Could not sign a URL for <code className="mx-1 font-mono text-xs">{path}</code>
        </div>
      ) : isPdf ? (
        <a href={url} target="_blank" rel="noreferrer" className={buttonClasses("white", "md")}>
          Open PDF (new tab)
        </a>
      ) : (
        <a href={url} target="_blank" rel="noreferrer" className="block focus-ring rounded-xl">
          {/* Signed URL (10 min) from a private bucket; next/image cannot optimize it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={`${label} of the license`}
            className="w-full rounded-xl bg-slate-50 object-contain ring-1 ring-navy-950/10"
          />
        </a>
      )}
    </figure>
  );
}

async function Detail({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const admin = await requireAdmin();
  if (admin.kind !== "supabase") return <NotConfigured what="this license" />;
  const res = await attempt(() => fetchLicenseDetail(admin.db, id));
  if (!res.ok) return <ErrorPanel message={`Could not load license: ${res.error}`} />;
  if (!res.data) notFound();
  const { license, type, profile, officer, reviewer, otherLicenses } = res.data;
  const urls = await signedUrls(admin.db, "licenses", [license.front_path, license.back_path], 600);
  const today = new Date().toISOString().slice(0, 10);
  const expired = license.expires_on < today;

  return (
    <>
      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <Card
            title={
              <span className="flex items-center gap-2">
                Uploaded images <StatusPill status={license.status} />
              </span>
            }
            actions={<span className="text-xs text-steel-400">Signed URLs expire in 10 minutes</span>}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <LicenseImage label="Front" url={urls.get(license.front_path)} path={license.front_path} />
              <LicenseImage label="Back" url={urls.get(license.back_path)} path={license.back_path} />
            </div>
          </Card>

          <Card title="Entered data">
            <Facts
              columns={3}
              items={[
                { label: "License type", value: type ? `${type.name} (${type.code})` : license.license_type_id },
                { label: "Armed", value: type ? (type.armed ? "Yes" : "No") : "-" },
                { label: "License number", value: <span className="font-mono">{license.license_number}</span> },
                {
                  label: "Expires",
                  value: (
                    <span className={expired ? "text-status-red" : ""}>
                      {fmtDate(license.expires_on)}
                      {expired ? " (expired)" : ""}
                    </span>
                  ),
                },
                { label: "Submitted", value: fmtDateTime(license.created_at) },
                { label: "Updated", value: fmtDateTime(license.updated_at) },
              ]}
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <a href={TX_DPS_LICENSE_LOOKUP_URL} target="_blank" rel="noreferrer" className={buttonClasses("white", "md")}>
                Verify on Texas DPS lookup (new tab)
              </a>
              <span className="text-xs text-navy-950/60">
                Search by name or license number, then compare the level and expiry against the card.
              </span>
            </div>
          </Card>

          <Card title="Decision">
            {license.status === "pending" ? (
              <ReviewForm licenseId={license.id} />
            ) : (
              <div className="space-y-3 text-sm">
                <p>
                  <StatusPill status={license.status} />{" "}
                  <span className="text-navy-950/70">
                    {license.reviewed_at ? `on ${fmtDateTime(license.reviewed_at)}` : ""}
                    {reviewer ? ` by ${reviewer.full_name || reviewer.email}` : ""}
                  </span>
                </p>
                {license.rejection_reason ? (
                  <p className="rounded-xl bg-slate-50 p-3">
                    <span className="font-semibold">Reason:</span> {license.rejection_reason}
                  </p>
                ) : null}
                <details>
                  <summary className="cursor-pointer text-sm font-semibold text-blue-700">Change decision</summary>
                  <div className="mt-3">
                    <ReviewForm licenseId={license.id} />
                  </div>
                </details>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Officer">
            <p className="text-lg font-extrabold tracking-tight">
              {profile ? (
                <Link href={`/admin/officers/${license.officer_id}`} className="text-blue-700 hover:underline">
                  {profile.full_name || "Unnamed officer"}
                </Link>
              ) : (
                "Unknown"
              )}
            </p>
            <p className="mt-1 text-sm text-navy-950/70">
              {profile?.email ? (
                <a href={`mailto:${profile.email}`} className="hover:underline">
                  {profile.email}
                </a>
              ) : null}
              {profile?.email && profile?.phone ? " / " : ""}
              {profile?.phone ? (
                <a href={`tel:${profile.phone}`} className="hover:underline">
                  {profile.phone}
                </a>
              ) : null}
            </p>
            <div className="mt-4">
              <Facts
                columns={1}
                items={[
                  { label: "Account", value: officer ? <StatusPill status={officer.account_status} /> : "-" },
                  {
                    label: "Signup fee",
                    value: officer?.signup_fee_paid_at ? `Paid ${fmtDateTime(officer.signup_fee_paid_at)}` : "Not paid",
                  },
                  {
                    label: "Background check",
                    value: officer ? (
                      <>
                        <StatusPill status={officer.background_status} />
                        {officer.background_updated_at ? (
                          <span className="ml-2 text-xs font-normal text-navy-950/60">{fmtDateTime(officer.background_updated_at)}</span>
                        ) : null}
                      </>
                    ) : (
                      "-"
                    ),
                  },
                  { label: "Home", value: officer ? [officer.home_city, officer.home_zip].filter(Boolean).join(" ") || "-" : "-" },
                  { label: "21+", value: officer ? (officer.is_21_plus ? "Yes" : "No") : "-" },
                  { label: "Completed shifts", value: officer?.completed_shifts ?? "-" },
                ]}
              />
            </div>
          </Card>
          <Card title="Other licenses on file">
            {otherLicenses.length === 0 ? (
              <p className="text-sm text-navy-950/60">None</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {otherLicenses.map(({ license: l, type: t }) => (
                  <li key={l.id} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/licenses/${l.id}`} className="text-blue-700 hover:underline">
                      {t?.code ?? "License"} / {l.license_number}
                    </Link>
                    <StatusPill status={l.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

export default function LicenseDetailPage({ params }: { params: Params }) {
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <PageHeader title="Review license" back={{ href: "/admin/licenses", label: "License queue" }} />
      <Suspense fallback={<Skeleton rows={4} />}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}
