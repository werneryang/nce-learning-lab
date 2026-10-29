import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
let files: { name: string; mimeType: string; buffer: Buffer }[];
test.beforeAll(() => {
  const directory = join(process.cwd(), "test-results", "voa-fixture");
  mkdirSync(directory, { recursive: true });
  const path = join(directory, "VOA-123.mp3");
  execFileSync(
    process.env.FFMPEG_PATH || "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2",
      "-codec:a",
      "libmp3lame",
      path,
    ],
    { stdio: "ignore" },
  );
  const audio = readFileSync(path);
  const pkg = {
    format: "nce-voa-package",
    version: 1,
    entries: [
      {
        lesson: {
          id: "VOA-123",
          series: "VOA",
          title: "Original VOA import fixture",
          summary: "Private test course",
          originalUrl: "https://learningenglish.voanews.com/a/123.html",
          publishedAt: "2025-03-10",
          attribution: "Project original fixture",
          vocabulary: ["test — a check"],
          pairingStatus: "page_linked_unreviewed",
        },
        paragraphs: [
          "This is an original test paragraph.",
          "Another paragraph for practice.",
        ],
        audio: {
          file: "VOA-123.mp3",
          sha256: createHash("sha256").update(audio).digest("hex"),
          bytes: audio.length,
          url: "https://voa-audio.voanews.eu/test.mp3",
        },
      },
    ],
  };
  files = [
    {
      name: "library.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(pkg)),
    },
    { name: "VOA-123.mp3", mimeType: "audio/mpeg", buffer: audio },
  ];
});
test("VOA import plays, practices, survives reload and preserves the NCE collection", async ({
  page,
}) => {
  await page.goto("#lessons");
  await expect(page.locator(".lesson-card")).toHaveCount(96);
  await page.getByText("Optional local VOA files", { exact: true }).click();
  await page
    .getByLabel("Select VOA files", { exact: true })
    .setInputFiles(files);
  await expect(page.getByText(/VOA import saved locally/)).toBeVisible();
  await expect(page.locator(".lesson-card")).toHaveCount(96);
  await page.getByLabel("Book", { exact: true }).selectOption("VOA");
  await expect(page.locator(".lesson-card")).toHaveCount(11);
  await page
    .locator(".lesson-card")
    .filter({ hasText: "Original VOA import fixture" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Original VOA import fixture",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("transcript-row")).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Loop line", exact: true }),
  ).toBeDisabled();
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
    .toBeGreaterThan(0.1);
  await page.getByLabel("Practice mode").selectOption("memory_recall");
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm & start practice", exact: true })
    .click();
  await page.getByLabel("Your draft").fill("My saved VOA practice.");
  await expect(
    page.getByRole("status").filter({ hasText: /^Saved locally$/ }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Your draft")).toHaveValue(
    "My saved VOA practice.",
  );
  await page.goto("#lessons");
  await page.getByText("Optional local VOA files", { exact: true }).click();
  await page
    .getByLabel("Select VOA files", { exact: true })
    .setInputFiles(files);
  await expect(page.getByText(/VOA import saved locally/)).toBeVisible();
  await page.getByLabel("Book", { exact: true }).selectOption("VOA");
  await expect(page.locator(".lesson-card")).toHaveCount(11);
  await page
    .locator(".lesson-card")
    .filter({ hasText: "Original VOA import fixture" })
    .click();
  await expect(page.getByLabel("Your draft")).toHaveValue(
    "My saved VOA practice.",
  );
  await page.goto("#lessons");
  for (const [book, count] of [
    ["2", 96],
    ["3", 60],
    ["4", 48],
  ] as const) {
    await page.getByLabel("Book", { exact: true }).selectOption(book);
    await expect(page.locator(".lesson-card")).toHaveCount(count);
  }
});

test("Hosted VOA opens and plays without local files, and reload keeps reviewed text", async ({
  page,
}) => {
  await page.route("**/voa/**/lesson.json", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await page.goto("#lessons");
  await page.getByLabel("Book", { exact: true }).selectOption("VOA");
  await expect(page.locator(".lesson-card")).toHaveCount(10);
  await page.locator(".lesson-card").first().click();
  await expect(page.getByTestId("transcript-row")).toHaveCount(27);
  await expect(page.locator("audio")).toHaveAttribute(
    "src",
    /\/media\/voa\/VOA-7921334\/VOA-7921334\.mp3$/,
  );
  const play = page.getByRole("button", { name: "Play", exact: true });
  await expect(play).toBeEnabled({ timeout: 15000 });
  await play.click();
  await expect
    .poll(() =>
      page
        .locator("audio")
        .evaluate((el) => (el as HTMLAudioElement).currentTime),
    )
    .toBeGreaterThan(0.2);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Loop line", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /Open source & body review/ }).click();
  await page
    .getByLabel("Role line 1", { exact: true })
    .selectOption("lesson_body");
  await page
    .getByLabel("Role line 1", { exact: true })
    .locator("..")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await expect(page.locator(".local-status")).toHaveText("Saved locally");
  await page.reload();
  await expect(page.getByTestId("transcript-row").first()).toContainText(
    "body",
  );
  await expect(play).toBeEnabled({ timeout: 15000 });
  // Resetting hosted text must not duplicate the audio source or corrupt storage.
  await page
    .getByText("Optional local files & sources", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Reload repository subtitles", exact: true })
    .click();
  await expect(page.getByTestId("transcript-row")).toHaveCount(27);
  await expect(page.locator(".local-status")).toHaveText("Saved locally");
});
