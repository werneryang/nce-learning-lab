import { test, expect } from "@playwright/test";
test("A failed repository audio request can be retried without file import", async ({
  page,
}) => {
  await page.route("**/media/**", (r) =>
    r.request().url().endsWith(".mp3") ? r.abort() : r.continue(),
  );
  await page.goto("#lesson/NCE2-L002");
  await expect(
    page.getByRole("alert").filter({ hasText: "Audio could not load" }),
  ).toBeVisible();
  await expect(page.getByTestId("transcript-row")).toHaveCount(19);
  await page.unroute("**/media/**");
  await page.getByRole("button", { name: "Retry audio", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((el) => (el as HTMLAudioElement).currentTime),
    )
    .toBeGreaterThan(0.2);
});
test("Repository lessons play and synchronize without selecting any files", async ({
  page,
}) => {
  let tutorCalls = 0;
  await page.route("**/api/tutor**", (r) => {
    tutorCalls++;
    return r.abort();
  });
  await page.goto("#lesson/NCE2-L001");
  await expect(page.getByTestId("transcript-row")).toHaveCount(18);
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  expect(await page.locator("audio").getAttribute("src")).toContain(
    "/media/book2/audio-us/",
  );
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((el) => (el as HTMLAudioElement).currentTime),
    )
    .toBeGreaterThan(0.2);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const line = page.getByTestId("transcript-row").nth(2);
  await line.getByRole("button").click();
  await expect(line).toHaveClass(/active/);
  await line.getByRole("checkbox").check();
  await page.getByRole("button", { name: /Open source & body review/ }).click();
  await page
    .getByRole("button", {
      name: "Confirm selected lines as body",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await page
    .getByLabel("Your draft")
    .fill("I am writing this sentence without any automatic suggestions.");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  expect(tutorCalls).toBe(0);
  await page.reload();
  await expect(page.getByLabel("Your draft")).toHaveValue(
    "I am writing this sentence without any automatic suggestions.",
  );
  await expect(page.getByTestId("subtitles-hidden")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  expect(await page.locator("audio").getAttribute("src")).toContain(
    "/media/book2/audio-us/",
  );
});
test("All three books are selectable and a failed subtitle request can be retried", async ({
  page,
  request,
}) => {
  await page.goto("#lessons");
  await expect(page.locator(".lesson-card")).toHaveCount(96);
  await page.getByLabel("Book", { exact: true }).selectOption("3");
  await expect(page.locator(".lesson-card")).toHaveCount(60);
  await page.getByLabel("Book", { exact: true }).selectOption("4");
  await expect(page.locator(".lesson-card")).toHaveCount(48);
  await page.route("**/media/**", (r) =>
    r.request().url().endsWith(".lrc")
      ? r.fulfill({ status: 503, body: "unavailable" })
      : r.continue(),
  );
  await page.goto("#lesson/NCE3-L001");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Repository subtitles could not load" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  await page.unroute("**/media/**");
  await page
    .getByRole("button", { name: "Retry subtitles", exact: true })
    .click();
  await expect(page.getByTestId("transcript-row").first()).toBeVisible();
  await page.getByLabel("Choose lesson").selectOption("NCE4-L048");
  await expect(
    page.getByRole("heading", {
      name: "Planning a Share Portfolio",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("transcript-row").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  const src = await page.locator("audio").getAttribute("src");
  const response = await request.get(src!, {
    headers: { Range: "bytes=0-1023" },
  });
  expect(response.status()).toBe(206);
  expect((await response.body()).length).toBe(1024);
});
