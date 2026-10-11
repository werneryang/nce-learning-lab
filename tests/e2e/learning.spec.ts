import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const directory = join(process.cwd(), "test-results", "original-fixtures");
const text =
  "[ti:Project-original test]\n[00:00.00]Why did the guest wait?\n[00:01.00]I was about to leave when the visitor arrived.\n[00:04.00]The room got quiet after the music stopped.\n[00:07.00]<img src=x onerror=window.__unsafe=1>\n";
let audioPath: string;
test.beforeAll(() => {
  mkdirSync(directory, { recursive: true });
  audioPath = join(directory, "project-original.mp3");
  execFileSync(
    process.env.FFMPEG_PATH || "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=10",
      "-codec:a",
      "libmp3lame",
      "-q:a",
      "7",
      audioPath,
    ],
    { stdio: "ignore" },
  );
  writeFileSync(join(directory, "original.lrc"), text);
});
test.beforeEach(async ({ page }) => {
  await page.route("**/media/**", (route) => route.abort());
});
async function openLesson(page: Page) {
  await page.goto("#lesson/NCE2-L001");
  await expect(
    page.getByRole("heading", { name: "A Private Conversation", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved locally" }),
  ).toBeVisible();
}
async function importText(page: Page) {
  await page.getByLabel("Import LRC", { exact: true }).setInputFiles({
    name: "01－Original.lrc",
    mimeType: "text/plain",
    buffer: Buffer.from(text),
  });
  await expect(page.getByText("Open source & body review")).toHaveCount(0);
  const role = page.getByLabel("Role line 3");
  await role.selectOption("lesson_body");
  await role
    .locator("..")
    .getByRole("button", { name: "Confirm", exact: true })
    .click();
  await page
    .getByRole("button", { name: /Close source & body review/ })
    .click();
}
async function startRecall(page: Page) {
  await importText(page);
  await page.getByLabel("Practice mode").selectOption("memory_recall");
  await page
    .getByRole("button", { name: "Start practice", exact: true })
    .click();
  await expect(page.getByLabel("Your draft")).toBeVisible();
}
test("T01/T03/T07: empty state, body confirmation, empty review", async ({
  page,
}) => {
  await openLesson(page);
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeDisabled();
  await startRecall(page);
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(
    page.getByText("Write a little first. Your session is still here."),
  ).toBeVisible();
  await expect(
    page.getByText("Subtitles hidden. Keep your attention"),
  ).toBeVisible();
});
test("T02: actual MP3 decode, play, sync, seek, speed and loop", async ({
  page,
}) => {
  await openLesson(page);
  await page.getByLabel("Import MP3", { exact: true }).setInputFiles(audioPath);
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  await importText(page);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".transcript-row.active")).toContainText(
    "I was about to leave",
    { timeout: 7000 },
  );
  await page.getByLabel("Playback speed").selectOption("1.25");
  expect(
    await page
      .locator("audio")
      .first()
      .evaluate((el) => (el as HTMLAudioElement).playbackRate),
  ).toBe(1.25);
  await page.getByRole("button", { name: "Loop line", exact: true }).click();
  await page.waitForTimeout(3600);
  const pos = await page
    .locator("audio")
    .first()
    .evaluate((el) => (el as HTMLAudioElement).currentTime);
  expect(pos).toBeGreaterThanOrEqual(1);
  expect(pos).toBeLessThan(4.2);
  await page.getByRole("button", { name: "Stop loop", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page
    .locator(".transcript-row")
    .filter({ hasText: "The room got quiet" })
    .getByRole("button")
    .click();
  expect(
    await page
      .locator("audio")
      .first()
      .evaluate((el) => (el as HTMLAudioElement).currentTime),
  ).toBeGreaterThanOrEqual(3.9);
});
test("Loop lesson restarts from 0:00, plays, wraps past the end and resets on lesson change", async ({
  page,
}) => {
  await openLesson(page);
  await page.getByLabel("Import MP3", { exact: true }).setInputFiles(audioPath);
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  await importText(page);
  const media = () =>
    page
      .locator("audio")
      .first()
      .evaluate((el) => {
        const a = el as HTMLAudioElement;
        return { time: a.currentTime, paused: a.paused, loop: a.loop };
      });
  const seekTo = (t: number) =>
    page
      .locator("audio")
      .first()
      .evaluate((el, at) => {
        (el as HTMLAudioElement).currentTime = at;
      }, t);
  // Paused mid-lesson: turning the loop on starts playback from the beginning.
  await seekTo(6);
  expect((await media()).paused).toBe(true);
  await page.getByRole("button", { name: "Loop lesson", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  const started = await media();
  expect(started).toMatchObject({ paused: false, loop: true });
  expect(started.time).toBeLessThan(2);
  // Playback wraps past the end of the audio and keeps going.
  await seekTo(9.2);
  await expect
    .poll(async () => (await media()).time, { timeout: 5000 })
    .toBeLessThan(2);
  expect((await media()).paused).toBe(false);
  // Line loop and lesson loop are mutually exclusive.
  await page.getByRole("button", { name: "Loop line", exact: true }).click();
  expect((await media()).loop).toBe(false);
  await expect(
    page.getByRole("button", { name: "Loop lesson", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop loop", exact: true }).click();
  // Turning it off keeps playing but no longer repeats.
  await page.getByRole("button", { name: "Loop lesson", exact: true }).click();
  await page
    .getByRole("button", { name: "Stop lesson loop", exact: true })
    .click();
  const stopped = await media();
  expect(stopped).toMatchObject({ paused: false, loop: false });
  await seekTo(9.2);
  await expect(page.locator("audio").first()).toHaveAttribute(
    "data-media-state",
    "ended",
    { timeout: 5000 },
  );
  // Switching lessons clears the lesson loop.
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Loop lesson", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stop lesson loop", exact: true }),
  ).toBeVisible();
  await page.goto("#lesson/NCE2-L002");
  await expect(
    page.getByRole("button", { name: "Loop lesson", exact: true }),
  ).toBeVisible();
  expect((await media()).loop).toBe(false);
});
test("T04/T05/T06/T11/T14: quiet writing → hints → review → revision → mastery → backup", async ({
  page,
}) => {
  let calls = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/tutor")) calls++;
  });
  await openLesson(page);
  await page
    .getByRole("button", { name: "Accept", exact: true })
    .first()
    .click();
  await page.getByLabel("get + adjective", { exact: true }).check();
  await startRecall(page);
  const draft = page.getByLabel("Your draft");
  const long =
    "I was about to leaving when the visitor arrived. " +
    "These are my own quiet words. ".repeat(8);
  await draft.fill(long);
  await draft.press("End");
  await draft.press("Space");
  await page.waitForTimeout(900);
  expect(calls).toBe(0);
  await expect(
    page.getByRole("region", { name: "Tutor feedback" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(draft).toHaveValue(long + " ");
  await expect(page.getByTestId("subtitles-hidden")).toBeVisible();
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(page.getByText("Hint L1 ·")).toBeVisible();
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(page.getByText("Hint L2 ·")).toBeVisible();
  await page.getByRole("button", { name: "Hint", exact: true }).click();
  await expect(page.getByText("Hint L3 ·")).toBeVisible();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(
    page.getByText("Original fidelity", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add to Mistake Bank", exact: true })
    .click();
  await page.getByRole("button", { name: "Revise", exact: true }).click();
  await draft.fill("I was about to leave when the visitor arrived.");
  await page.getByRole("button", { name: "Recheck", exact: true }).click();
  await expect(
    page.getByText("0 token edits / 9 reference tokens"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Finish & save", exact: true })
    .click();
  await expect(page.getByText("Completed and saved.")).toBeVisible();
  expect(calls).toBe(0);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export learning JSON" }).click();
  const download = await downloadPromise;
  const path = join(directory, `${test.info().project.name}-backup.json`);
  await download.saveAs(path);
  await page
    .getByRole("button", { name: "Delete all local data", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm delete all", exact: true })
    .click();
  await expect(
    page.getByText("All private browser records and media deleted."),
  ).toBeVisible();
  await page
    .getByLabel("Replace with backup", { exact: true })
    .setInputFiles(path);
  await page
    .getByRole("button", { name: "Replace records with verified backup" })
    .click();
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(
    page.getByRole("cell", { name: /good.*1 successful reviews/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Unrated", exact: true }),
  ).toHaveCount(2);
  await page.getByRole("link", { name: "Mistakes", exact: true }).click();
  await expect(page.getByLabel("Explanation")).toHaveValue(
    "After “about to”, use the base form of the verb.",
  );
  await page.goto("#lesson/NCE2-L001");
  await expect(draft).toHaveValue(
    "I was about to leave when the visitor arrived.",
  );
});
test("T08/T09/T15/T16: differences are not English errors; rewriting has no fidelity score; hostile text is inert", async ({
  page,
}) => {
  await openLesson(page);
  await startRecall(page);
  await page
    .getByLabel("Your draft")
    .fill("The visitor appeared just as I planned to go.");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Tutor feedback" })
      .getByText("Different wording may be valid.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("error · grammar")).toHaveCount(0);
  await page.getByLabel("Practice mode").selectOption("guided_rewriting");
  await page
    .getByRole("button", { name: "Start new practice", exact: true })
    .click();
  await page
    .getByLabel("Your draft")
    .fill("I told the guest that I needed to leave.");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Tutor feedback" })
      .getByText("Rewriting is not scored by word matching.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Original fidelity", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("AI Tutor not configured · manual ChatGPT"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Show subtitles", exact: true })
    .click();
  await expect(page.locator(".transcript")).toContainText("<img src=x");
  expect(
    await page.evaluate(() =>
      Object.prototype.hasOwnProperty.call(window, "__unsafe"),
    ),
  ).toBe(false);
});
test("T10: editing during a pending review keeps text and labels the older feedback", async ({
  page,
}) => {
  await openLesson(page);
  await startRecall(page);
  await page.getByLabel("Your draft").fill("First version.");
  await page.evaluate(() => {
    const original = crypto.subtle.digest.bind(crypto.subtle);
    crypto.subtle.digest = async (...args: Parameters<typeof original>) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return original(...args);
    };
  });
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByLabel("Your draft").fill("My new version stays here.");
  await expect(page.getByText("For an older draft")).toBeVisible();
  await expect(page.getByLabel("Your draft")).toHaveValue(
    "My new version stays here.",
  );
});
test("T18: narrow layout and keyboard navigation stay usable", async ({
  page,
}) => {
  await openLesson(page);
  await startRecall(page);
  await page.getByLabel("Your draft").fill("A long paragraph. ".repeat(80));
  await page.getByRole("button", { name: "Save draft", exact: true }).focus();
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeFocused();
  const dimensions = await page.evaluate(() => ({
    body: document.documentElement.scrollWidth,
    view: innerWidth,
  }));
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.view + 2);
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(
    page.getByText("Original fidelity", { exact: true }),
  ).toBeVisible();
});

test("Phase 2/T12/T13: five lessons, cross-lesson chunk reuse and independent speaking rating", async ({
  page,
}) => {
  await openLesson(page);
  await page
    .getByRole("button", { name: "Accept", exact: true })
    .first()
    .click();
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await page
    .getByLabel("Manual skill response")
    .fill("I can explain the change of state.");
  await page.getByRole("button", { name: "good", exact: true }).click();
  await page.getByRole("link", { name: "Lessons", exact: true }).click();
  await expect(page.locator(".lesson-card")).toHaveCount(96);
  for (let n = 2; n <= 5; n++) {
    await page.goto(`#lesson/NCE2-L${String(n).padStart(3, "0")}`);
    await expect(page.getByLabel("Choose lesson")).toHaveValue(
      `NCE2-L${String(n).padStart(3, "0")}`,
    );
    await startRecall(page);
    await page
      .getByLabel("Your draft")
      .fill("I was about to leave when the visitor arrived.");
    await page.getByRole("button", { name: "Review", exact: true }).click();
    await expect(
      page.getByText("0 token edits / 9 reference tokens"),
    ).toBeVisible();
    if (n === 4)
      await page
        .getByRole("button", { name: "Link this lesson", exact: true })
        .click();
  }
  await page.getByRole("link", { name: "Chunks", exact: true }).click();
  await expect(
    page
      .locator(".chunk-card:not(.candidate)")
      .filter({ hasText: "get + adjective" }),
  ).toHaveCount(1);
  await expect(
    page
      .locator(".chunk-card:not(.candidate)")
      .filter({ hasText: "get + adjective" }),
  ).toContainText("Lesson 1");
  await expect(
    page
      .locator(".chunk-card:not(.candidate)")
      .filter({ hasText: "get + adjective" }),
  ).toContainText("Lesson 4");
  await page.getByRole("link", { name: "Speaking", exact: true }).click();
  await page.getByLabel("Speaking lesson").selectOption("NCE2-L004");
  await page.getByLabel("get + adjective", { exact: true }).check();
  await page
    .getByLabel("Speaking transcript")
    .fill("The room got quiet when I began my story.");
  await page
    .getByRole("button", { name: "Save speaking attempt", exact: true })
    .click();
  await expect(page.getByText("Speaking attempt saved.")).toBeVisible();
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "get + adjective" });
  await expect(row.getByRole("cell").nth(0)).toContainText("good");
  await expect(row.getByRole("cell").nth(1)).toContainText("Unrated");
  await expect(row.getByRole("cell").nth(2)).toContainText("hard");
});

test("T05: composition, paste, blur and selection changes preserve exact text with no tutor operation", async ({
  page,
}) => {
  let calls = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/tutor")) calls++;
  });
  await openLesson(page);
  await startRecall(page);
  const draft = page.getByLabel("Your draft");
  await draft.dispatchEvent("compositionstart", { data: "" });
  const value =
    "中文输入法练习 — My unchanged paragraph. " +
    "I am practicing my own words. ".repeat(12);
  await draft.fill(value);
  await draft.dispatchEvent("compositionend", { data: "练习" });
  await draft.evaluate((el) => {
    const t = el as HTMLTextAreaElement;
    t.setSelectionRange(0, 2);
  });
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.waitForTimeout(800);
  await expect(draft).toHaveValue(value);
  expect(calls).toBe(0);
  await expect(
    page.getByRole("region", { name: "Tutor feedback" }),
  ).toHaveCount(0);
});

test("Invalid audio is rejected and memory recall keeps native playback locked", async ({
  page,
}) => {
  await openLesson(page);
  await page.getByLabel("Import MP3", { exact: true }).setInputFiles({
    name: "broken.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.from("not an audio file"),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "cannot decode" }),
  ).toContainText("cannot decode");
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Import MP3", { exact: true }).setInputFiles(audioPath);
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  await startRecall(page);
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeDisabled();
  expect(
    await page
      .locator("audio")
      .first()
      .evaluate((e) => (e as HTMLAudioElement).controls),
  ).toBe(false);
  await page.getByLabel("Allow replay during memory recall").check();
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
});

test("Private writing sessions can be deleted individually after an explicit confirmation", async ({
  page,
}) => {
  await openLesson(page);
  await startRecall(page);
  await page.getByLabel("Your draft").fill("A private draft to delete.");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page.getByText("Saved sessions · 1", { exact: true }).click();
  await page
    .getByRole("button", { name: "Delete session", exact: true })
    .click();
  await expect(page.getByLabel("Your draft")).toHaveValue(
    "A private draft to delete.",
  );
  await page
    .getByRole("button", { name: "Confirm delete session", exact: true })
    .click();
  await expect(page.getByLabel("Your draft")).toHaveCount(0);
  await expect(
    page.getByText("Private writing session deleted."),
  ).toBeVisible();
});
