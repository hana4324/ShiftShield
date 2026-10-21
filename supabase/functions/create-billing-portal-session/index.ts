import { z } from "zod";
import type { CreateBillingPortalSessionResponse } from "@shared/api.ts";
import { conflict, notFound } from "../_shared/errors.ts";
import { json, readJson, serve } from "../_shared/http.ts";
import { stripeClient } from "../_shared/stripe.ts";
import { requireCompany, requireRole, requireUser, serviceClient } from "../_shared/supabase.ts";
import { RedirectUrl } from "../_shared/validation.ts";

const Body = z.object({ return_url: RedirectUrl });

serve(async (req) => {
  const body = await readJson(req, Body);
  const ctx = await requireUser(req);
  requireRole(ctx, "employer_owner");
  const companyId = requireCompany(ctx);

  const { data: company, error } = await serviceClient()
    .from("companies")
    .select("stripe_customer_id")
    .eq("id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (!company) throw notFound("company_not_found", "Company not found.");
  if (!company.stripe_customer_id) {
    throw conflict("no_billing_account", "Choose a plan first to set up billing.");
  }

  const session = await stripeClient().billingPortal.sessions.create({
    customer: company.stripe_customer_id,
    return_url: body.return_url,
  });
  const response: CreateBillingPortalSessionResponse = { portal_url: session.url };
  return json(response);
});
