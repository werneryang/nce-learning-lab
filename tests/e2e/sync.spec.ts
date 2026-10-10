import { test, expect } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
// An in-memory stand-in for the Supabase auth + learning_state endpoints,
// shared by two browser contexts that play the part of two devices.
type Row = { revision: number; state: unknown; updated_at: string };
const userId = "00000000-0000-4000-8000-000000000001";
function fakeJwt() {
  const part = (o: object) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${part({ alg: "HS256", typ: "JWT" })}.${part({ sub: userId, exp, role: "authenticated" })}.sig`;
}
function cloud() {
  const store: { row?: Row } = {};
  async function attach(context: BrowserContext) {
    await context.route("**/media/**", (route) => route.abort());
    await context.route("https://sync.test/**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const json = (status: number, body: unknown) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      if (url.pathname === "/auth/v1/otp") return json(200, {});
      if (url.pathname === "/auth/v1/verify") {
        const { email, token } = req.postDataJSON();
        if (token !== "123456")
          return json(403, { msg: "Token has expired or is invalid" });
        return json(200, {
          access_token: fakeJwt(),
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: "refresh",
          user: {
            id: userId,
            aud: "authenticated",
            role: "authenticated",
            email,
          },
        });
      }
      if (url.pathname === "/auth/v1/logout")
        return route.fulfill({ status: 204 });
      if (url.pathname !== "/rest/v1/learning_state") return json(404, {});
      const owner = url.searchParams.get("user_id");
      if (req.method() === "GET")
        return json(
          200,
          owner === `eq.${userId}` && store.row ? [store.row] : [],
        );
      if (req.method() === "POST") {
        if (store.row)
          return json(409, { code: "23505", message: "duplicate key" });
        const body = req.postDataJSON();
        const value = Array.isArray(body) ? body[0] : body;
        store.row = {
          revision: 1,
          state: value.state,
          updated_at: new Date().toISOString(),
        };
        return json(201, [store.row]);
      }
      if (req.method() === "PATCH") {
        const expected = Number(url.searchParams.get("revision")?.slice(3));
        if (!store.row || store.row.revision !== expected) return json(200, []);
        const body = req.postDataJSON();
        store.row = {
          revision: body.revision,
          state: body.state,
          updated_at: body.updated_at,
        };
        return json(200, [store.row]);
      }
      return json(405, {});
    });
  }
  return { store, attach };
}
async function signIn(page: Page) {
  await page.goto("#settings");
  await page.getByLabel("Email for cloud sync").fill("me@example.com");
  await page.getByRole("button", { name: "Email me a code" }).click();
  await page.getByLabel("Sign-in code").fill("123456");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Cloud sync status")).toContainText(
    "Signed in as me@example.com",
  );
}
const syncStatus = (page: Page) => page.locator("[data-sync-status]");
async function acceptFirstChunk(page: Page) {
  await page.goto("#lesson/NCE2-L001");
  await page
    .getByRole("button", { name: "Accept", exact: true })
    .first()
    .click();
}
const acceptedChunks = (page: Page) =>
  page.locator("article.chunk-card:not(.candidate)");
test("Learning records sync between two devices and conflicts ask the user", async ({
  browser,
}) => {
  test.setTimeout(90000); // two devices plus debounced syncs
  const server = cloud();
  const deviceA = await browser.newContext();
  const deviceB = await browser.newContext();
  await server.attach(deviceA);
  await server.attach(deviceB);
  const a = await deviceA.newPage();
  const b = await deviceB.newPage();
  // Device A has records before signing in; signing in uploads them.
  await acceptFirstChunk(a);
  await signIn(a);
  await expect(syncStatus(a)).toHaveText("Synced");
  await expect.poll(() => server.store.row?.revision).toBe(1);
  // Device B starts empty and receives A's records.
  await signIn(b);
  await expect(syncStatus(b)).toHaveText("Synced");
  await b.goto("#library");
  await expect(acceptedChunks(b)).toHaveCount(1);
  // A change on B reaches the cloud, and A picks it up when it comes back.
  await b.goto("#lesson/NCE2-L001");
  await b.getByRole("button", { name: "Accept", exact: true }).first().click();
  await expect
    .poll(() => server.store.row?.revision, { timeout: 8000 })
    .toBe(2);
  await a.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await a.goto("#library");
  await expect(acceptedChunks(a)).toHaveCount(2);
  await expect(syncStatus(a)).toHaveText("Synced");
  // Another device writes while A has its own unsynced change: A must ask.
  await a.waitForTimeout(3500); // let A finish its own pending sync first
  const other = structuredClone(server.store.row!);
  server.store.row = {
    ...other,
    revision: other.revision + 1,
    updated_at: new Date().toISOString(),
  };
  await a.goto("#lesson/NCE2-L001");
  await a.getByRole("button", { name: "Accept", exact: true }).first().click();
  await expect(a.getByText("Both copies changed.")).toBeVisible({
    timeout: 8000,
  });
  await expect(syncStatus(a)).toHaveText("Sync conflict");
  const before = server.store.row.revision;
  await a.getByRole("button", { name: "Keep this device's copy" }).click();
  await expect(syncStatus(a)).toHaveText("Synced");
  expect(server.store.row.revision).toBe(before + 1);
  const kept = server.store.row.state as { chunks: unknown[] };
  expect(kept.chunks).toHaveLength(3);
  await deviceA.close();
  await deviceB.close();
});
test("Without signing in, the app never contacts the sync server", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/media/**", (route) => route.abort());
  await page.route("https://sync.test/**", (route) => {
    calls++;
    return route.abort();
  });
  await acceptFirstChunk(page);
  await page.goto("#settings");
  await expect(page.getByLabel("Email for cloud sync")).toBeVisible();
  await page.waitForTimeout(3500);
  expect(calls).toBe(0);
  await expect(page.locator("[data-sync-status]")).toHaveCount(0);
});
