import { test, expect } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const directory = join(process.cwd(), "test-results", "merge-backups");
async function device(browser: Browser, name: string) {
  const context = await browser.newContext();
  await context.route("**/media/**", (route) => route.abort());
  const page = await context.newPage();
  await page.goto("#settings");
  const field = page.getByLabel("Device name");
  await field.fill(name);
  await field.blur();
  return page;
}
async function accept(page: Page, nth: number) {
  await page.goto("#lesson/NCE2-L001");
  await page
    .getByRole("button", { name: "Accept", exact: true })
    .nth(nth)
    .click();
}
async function exportBackup(page: Page) {
  await page.goto("#settings");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export learning JSON" }).click();
  const file = await download;
  mkdirSync(directory, { recursive: true });
  const path = join(
    directory,
    `${test.info().project.name}-${file.suggestedFilename()}`,
  );
  await file.saveAs(path);
  return { path, name: file.suggestedFilename() };
}
const savedChunks = async (page: Page) => {
  await page.goto("#library");
  return page.locator("article.chunk-card:not(.candidate)");
};
test("Backups from two devices merge without overwriting each other", async ({
  browser,
}) => {
  const mac = await device(browser, "My Mac");
  const iphone = await device(browser, "iPhone");
  // Each device studies something different.
  await accept(mac, 0);
  await accept(iphone, 1);
  const fromMac = await exportBackup(mac);
  const fromIphone = await exportBackup(iphone);
  expect(fromMac.name).toMatch(
    /^nce-learning-backup-my-mac-\d{4}-\d{2}-\d{2}-\d{4}\.json$/,
  );
  expect(fromIphone.name).toMatch(/^nce-learning-backup-iphone-/);
  // The iPhone merges the Mac's file: it keeps its own chunk and gains the Mac's.
  await iphone.getByLabel("Merge backups").setInputFiles(fromMac.path);
  await expect(iphone.getByText("Merging adds 1 new chunk")).toBeVisible();
  await iphone.getByRole("button", { name: "Merge into this device" }).click();
  await expect(iphone.getByText(/Merged 1 backup: 1 new chunk/)).toBeVisible();
  await expect(await savedChunks(iphone)).toHaveCount(2);
  // The Mac can select several files at once, including its own older export.
  await mac.goto("#settings");
  await mac
    .getByLabel("Merge backups")
    .setInputFiles([fromIphone.path, fromMac.path]);
  await expect(mac.getByText("Checked 2 backups:")).toBeVisible();
  await mac.getByRole("button", { name: "Merge into this device" }).click();
  await expect(mac.getByText(/Merged 2 backups: 1 new chunk/)).toBeVisible();
  await expect(await savedChunks(mac)).toHaveCount(2);
  // Merging again changes nothing, and the merge survives a reload.
  await mac.goto("#settings");
  await mac.getByLabel("Merge backups").setInputFiles(fromIphone.path);
  await expect(
    mac.getByText("nothing new — this device already has these records"),
  ).toBeVisible();
  await mac.getByRole("button", { name: "Cancel merge" }).click();
  await mac.reload();
  await expect(await savedChunks(mac)).toHaveCount(2);
  await mac.goto("#settings");
  await expect(mac.getByLabel("Device name")).toHaveValue("my-mac");
});
test("A damaged backup is rejected before anything is merged", async ({
  page,
}) => {
  await page.route("**/media/**", (route) => route.abort());
  await page.goto("#settings");
  await page.getByLabel("Merge backups").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      '{"schemaVersion":1,"mediaIncluded":false,"data":{},"checksum":"x"}',
    ),
  });
  await expect(page.getByText(/broken\.json: Checksum mismatch/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Merge into this device" }),
  ).toHaveCount(0);
});
