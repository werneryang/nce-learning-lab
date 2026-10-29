import { test, expect } from "@playwright/test";

for (const collection of [
  { first: "NCE2-L001", second: "NCE2-L002", last: "NCE2-L096" },
  { first: "VOA-7921334", second: "VOA-8001173", last: "VOA-7972396" },
]) {
  test(`Player navigation preserves drafts and stops old audio: ${collection.first}`, async ({
    page,
  }) => {
    await page.goto(`#lesson/${collection.first}`);
    const player = page.getByRole("region", { name: "Audio and transcript" });
    const previous = player.getByRole("button", {
      name: "上一篇",
      exact: true,
    });
    const next = player.getByRole("button", { name: "下一篇", exact: true });
    await expect(previous).toBeDisabled();
    await expect(next).toBeEnabled();
    const play = player.getByRole("button", { name: "Play", exact: true });
    await expect(play).toBeEnabled({ timeout: 15000 });
    await play.click();
    await expect
      .poll(() =>
        page
          .locator("audio")
          .evaluate((el) => (el as HTMLAudioElement).currentTime),
      )
      .toBeGreaterThan(0.1);
    await page.locator("audio").evaluate((el) => {
      (window as unknown as { previousAudio: Element }).previousAudio = el;
    });
    await page.getByLabel("Practice mode").selectOption("guided_rewriting");
    await page
      .getByRole("button", { name: "Start practice", exact: true })
      .click();
    await page
      .getByLabel("Your draft")
      .fill("Keep this draft when changing articles.");
    await next.click();
    await expect(page).toHaveURL(new RegExp(`#lesson/${collection.second}$`));
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { previousAudio: HTMLAudioElement })
            .previousAudio.paused,
      ),
    ).toBe(true);
    await expect(previous).toBeEnabled();
    await previous.click();
    await expect(page.getByLabel("Your draft")).toHaveValue(
      "Keep this draft when changing articles.",
    );
    await expect(page.locator(".local-status")).toHaveText("Saved locally");
    await page.reload();
    await expect(page.getByLabel("Your draft")).toHaveValue(
      "Keep this draft when changing articles.",
    );
    await page.goto(`#lesson/${collection.last}`);
    await expect(next).toBeDisabled();
    await expect(previous).toBeEnabled();
  });
}

test("NCE navigation stays within each book", async ({ page }) => {
  for (const [first, last] of [
    ["NCE3-L001", "NCE3-L060"],
    ["NCE4-L001", "NCE4-L048"],
  ]) {
    await page.goto(`#lesson/${first}`);
    await expect(
      page.getByRole("button", { name: "上一篇", exact: true }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "下一篇", exact: true }).click();
    await expect(page).toHaveURL(
      new RegExp(`#lesson/${first.replace("001", "002")}$`),
    );
    await page.goto(`#lesson/${last}`);
    await expect(
      page.getByRole("button", { name: "下一篇", exact: true }),
    ).toBeDisabled();
  }
});
