import { test, expect } from "@playwright/test";

// Study words must be open by default and sit above the transcript, for NCE
// lessons and hosted VOA articles alike, so they are not buried below the
// subtitles.
for (const [id, summary, word] of [
  ["NCE2-L050", /Words in this lesson \(6\)/, "conductor"],
  ["NCE4-L048", /Words in this lesson \(6\)/, "portfolio"],
  ["VOA-7983372", /Words in this story \(15\)/, "gardener"],
] as const) {
  test(`study words are open and above the transcript: ${id}`, async ({
    page,
  }) => {
    await page.goto(`#lesson/${id}`);
    const details = page.locator("details.vocabulary");
    await expect(details.locator("summary")).toHaveText(summary);
    await expect(details).toHaveJSProperty("open", true);
    await expect(details.getByText(word).first()).toBeVisible();
    const transcript = page.locator(".transcript");
    await expect(transcript).toBeVisible();
    const words = await details.boundingBox();
    const lines = await transcript.boundingBox();
    expect(words!.y).toBeLessThan(lines!.y);
  });
}
