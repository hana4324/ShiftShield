import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("renders hero, plans, forms and footer contact", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Coverage when you need it.");
    await expect(page.getByRole("link", { name: /Join the 30-Day Pilot/ }).first()).toBeVisible();

    // Plans come from packages/shared and must show the 3-tier pricing.
    await expect(page.getByText("$199")).toBeVisible();
    await expect(page.getByText("$499")).toBeVisible();
    await expect(page.getByText("$1,299")).toBeVisible();

    // Footer business contact.
    await expect(page.getByText("3500 Oaklawn Ave. #460 PMB 5181")).toBeVisible();
    await expect(page.getByRole("link", { name: "(254) 276-4393" }).first()).toBeVisible();

    // Both forms exist.
    await expect(page.getByRole("form", { name: "Employer pilot application" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Officers: get notified at launch" })).toBeVisible();
  });

  test("pilot form shows validation errors on empty submit", async ({ page }) => {
    await page.goto("/#pilot");
    const form = page.getByRole("form", { name: "Employer pilot application" });
    // Submissions faster than 3s after mount are treated as bots and silently accepted.
    await page.waitForTimeout(3200);
    await form.getByRole("button", { name: /Join the 30-Day Pilot/ }).click();
    await expect(form.getByRole("alert").first()).toBeVisible();
    await expect(form.getByText("Please fix the highlighted fields.")).toBeVisible();
  });

  test("pilot form keeps typed values after a validation error and then submits", async ({
    page,
  }) => {
    await page.goto("/#pilot");
    const form = page.getByRole("form", { name: "Employer pilot application" });
    await form.waitFor();
    // The anti-spam timestamp is populated after hydration.
    await page.waitForFunction(
      () => (document.querySelector('input[name="started_at"]') as HTMLInputElement)?.value !== "",
    );

    const fill = async (phone: string) => {
      await form.locator("#company_name").fill("Acme Security");
      await form.locator("#company_type").selectOption("security_company");
      await form.locator("#contact_name").fill("Jane Doe");
      await form.locator("#email").fill("jane@acme.com");
      await form.locator("#phone").fill(phone);
      await form.locator("#city").fill("Dallas");
      await form.locator("#shifts_per_month").fill("20");
      await form.locator("#coverage_timeline").selectOption("immediately");
      await form.locator("#shift_types-overnight").check();
    };
    const submit = () => form.getByRole("button", { name: /Join the 30-Day Pilot/ }).click();

    await page.waitForTimeout(3200);
    await fill("555-01"); // invalid phone
    await submit();
    await expect(form.getByText("Please fix the highlighted fields.")).toBeVisible();
    await expect(form.locator("#phone")).toHaveAttribute("aria-invalid", "true");
    // React 19 resets forms after an action; the server echoes values back so nothing is lost.
    await expect(form.locator("#company_name")).toHaveValue("Acme Security");
    await expect(form.locator("#company_type")).toHaveValue("security_company");
    await expect(form.locator("#shift_types-overnight")).toBeChecked();
    await expect(form.locator('input[name="started_at"]')).not.toHaveValue("");

    await page.waitForTimeout(3200);
    await form.locator("#phone").fill("(214) 555-0100");
    await submit();
    // Validation passes. Without Supabase configured, production mode answers with the generic
    // "something went wrong" alert instead of the success panel; either proves the fields were accepted.
    await expect(
      page.getByRole("status").or(form.getByText(/Something went wrong on our end/)),
    ).toBeVisible();
    await expect(form.getByText("Please fix the highlighted fields.")).toHaveCount(0);
  });

  test("has SEO metadata and OG image", async ({ page, request }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ShiftShield/);
    const og = page.locator('meta[property="og:image"]');
    await expect(og).toHaveCount(1);
    const ogUrl = await og.getAttribute("content");
    expect(ogUrl).toBeTruthy();
    // og:image is absolute (NEXT_PUBLIC_SITE_URL); fetch the same path from the test server.
    const { pathname, search } = new URL(ogUrl!);
    const res = await request.get(pathname + search);
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"]).toContain("image/png");
  });

  test("legal placeholders and admin gate", async ({ page }) => {
    await page.goto("/legal/privacy");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy Policy");
    await page.goto("/admin/leads");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
