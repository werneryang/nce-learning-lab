import { test, expect } from "@playwright/test";
test("Fresh full-lesson practice confirms loaded body here and completes the writing loop", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/tutor**", (r) => {
    calls++;
    return r.abort();
  });
  await page.goto("#lesson/NCE2-L001");
  const practice = page.getByRole("region", { name: "Writing practice" });
  await expect(page.getByTestId("transcript-row")).toHaveCount(18);
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  await expect(practice.getByText(/0 confirmed body lines/)).toBeVisible();
  await practice
    .getByLabel("Range", { exact: true })
    .selectOption("full_lesson");
  await practice
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await expect(
    practice.getByRole("group", { name: "Confirm lesson body" }),
  ).toBeVisible();
  await expect(
    practice.getByLabel("Practice body line 1", { exact: true }),
  ).not.toBeChecked();
  await expect(practice.getByLabel("Your draft")).toHaveCount(0);
  await practice.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(practice.getByText(/0 confirmed body lines/)).toBeVisible();
  await practice
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await practice
    .getByRole("button", { name: "Confirm & start practice", exact: true })
    .click();
  await expect(practice.getByText(/17 confirmed body lines/)).toBeVisible();
  await expect(
    practice.getByRole("group", { name: "Confirm lesson body" }),
  ).toHaveCount(0);
  await expect(page.getByTestId("subtitles-hidden")).toBeVisible();
  const draft = practice.getByLabel("Your draft");
  await draft.fill(
    "Last week I went to a theatre. I remember the conversation.",
  );
  await page.waitForTimeout(900);
  await expect(
    practice.getByRole("region", { name: "Tutor feedback" }),
  ).toHaveCount(0);
  expect(calls).toBe(0);
  await practice
    .getByRole("button", { name: "Save draft", exact: true })
    .click();
  await page.reload();
  await expect(draft).toHaveValue(
    "Last week I went to a theatre. I remember the conversation.",
  );
  await expect(practice.getByText(/17 confirmed body lines/)).toBeVisible();
  await practice.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(practice.getByText("Hint L1 ·")).toBeVisible();
  await practice.getByRole("button", { name: "Review", exact: true }).click();
  await expect(
    practice.getByText("Original fidelity", { exact: true }),
  ).toBeVisible();
  await practice
    .getByRole("button", { name: "Show answer / explain", exact: true })
    .click();
  const reference = await practice.locator(".reference-text pre").innerText();
  expect(reference.split("\n")).toHaveLength(17);
  expect(reference).toMatch(/^Last week I went to the theatre\./);
  expect(reference).toContain("'This is a private conversation!'");
  expect(reference).not.toContain("Why did the writer complain");
  await practice.getByRole("button", { name: "Revise", exact: true }).click();
  await draft.fill(reference);
  await practice.getByRole("button", { name: "Recheck", exact: true }).click();
  await expect(
    practice.getByText(/0 token edits \/ \d+ reference tokens/),
  ).toBeVisible();
  await practice
    .getByRole("button", { name: "Finish & save", exact: true })
    .click();
  await expect(practice.getByText("Completed and saved.")).toBeVisible();
  expect(calls).toBe(0);
});

test("Lesson 2 checklist can include a body question and define paragraph / sentence ranges", async ({
  page,
}) => {
  await page.goto("#lesson/NCE2-L002");
  await expect(page.getByTestId("transcript-row")).toHaveCount(19);
  const practice = page.getByRole("region", { name: "Writing practice" });
  await practice.getByLabel("Practice mode").selectOption("memory_recall");
  await practice.getByLabel("Range", { exact: true }).selectOption("paragraph");
  await practice
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  const checks = practice
    .getByRole("group", { name: "Confirm lesson body" })
    .getByRole("checkbox");
  for (let i = 0; i < (await checks.count()); i++)
    await checks.nth(i).uncheck();
  await expect(
    practice.getByRole("button", {
      name: "Confirm & start practice",
      exact: true,
    }),
  ).toBeDisabled();
  await practice.getByLabel("Practice body line 2", { exact: true }).check();
  await practice.getByLabel("Practice body line 3", { exact: true }).check();
  await practice.getByLabel("Practice body line 18", { exact: true }).check();
  await practice
    .getByRole("button", { name: "Confirm & start practice", exact: true })
    .click();
  await expect(
    practice.getByText(/3 confirmed body lines · 3 selected/),
  ).toBeVisible();
  await practice
    .getByRole("button", { name: "Show answer / explain", exact: true })
    .click();
  await expect(practice.locator(".reference-text pre")).toHaveText(
    "It was Sunday.\nI never get up early on Sundays.\n'Do you always get up so late?",
  );
  await practice.getByLabel("Range", { exact: true }).selectOption("sentence");
  await practice
    .getByRole("button", { name: "Start new practice", exact: true })
    .click();
  await practice
    .getByRole("button", { name: "Show answer / explain", exact: true })
    .click();
  await expect(practice.locator(".reference-text pre")).toHaveText(
    "It was Sunday.",
  );
});

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
