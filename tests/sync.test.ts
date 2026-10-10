import { describe, expect, it } from "vitest";
import { emptyState } from "../src/shared/schema";
import { fingerprint, isBlank, planSync } from "../src/sync/plan";
const remote = (revision: number, blank = false) => ({ revision, blank });
describe("cloud sync plan", () => {
  it("creates the cloud copy only when this device has records", () => {
    const base = { remote: null, baseRevision: 0, dirty: true };
    expect(planSync({ ...base, localBlank: false })).toBe("upload");
    expect(planSync({ ...base, localBlank: true })).toBe("none");
  });
  it("pushes local changes when the cloud is where this device left it", () => {
    expect(
      planSync({
        remote: remote(3),
        baseRevision: 3,
        dirty: true,
        localBlank: false,
      }),
    ).toBe("push");
    expect(
      planSync({
        remote: remote(3),
        baseRevision: 3,
        dirty: false,
        localBlank: false,
      }),
    ).toBe("none");
  });
  it("downloads a newer cloud copy when this device has no unsynced changes", () => {
    expect(
      planSync({
        remote: remote(4),
        baseRevision: 3,
        dirty: false,
        localBlank: false,
      }),
    ).toBe("apply");
    // A fresh device with nothing yet adopts the cloud copy.
    expect(
      planSync({
        remote: remote(4),
        baseRevision: 0,
        dirty: false,
        localBlank: true,
      }),
    ).toBe("apply");
  });
  it("asks the user when both sides changed", () => {
    expect(
      planSync({
        remote: remote(4),
        baseRevision: 3,
        dirty: true,
        localBlank: false,
      }),
    ).toBe("conflict");
    // A second device with its own records meets an existing cloud copy.
    expect(
      planSync({
        remote: remote(1),
        baseRevision: 0,
        dirty: true,
        localBlank: false,
      }),
    ).toBe("conflict");
  });
  it("overwrites an empty cloud copy instead of reporting a conflict", () => {
    expect(
      planSync({
        remote: remote(2, true),
        baseRevision: 0,
        dirty: true,
        localBlank: false,
      }),
    ).toBe("push");
  });
});
describe("state fingerprint", () => {
  it("ignores key order, as returned by Postgres jsonb", async () => {
    const state = emptyState();
    const reordered = JSON.parse(
      JSON.stringify(Object.fromEntries(Object.entries(state).reverse())),
    );
    reordered.settings = Object.fromEntries(
      Object.entries(state.settings).reverse(),
    );
    expect(await fingerprint(reordered)).toBe(await fingerprint(state));
  });
  it("changes when learning records change", async () => {
    const state = emptyState();
    const changed = { ...state, rejectedCandidates: ["c1"] };
    expect(isBlank(state)).toBe(true);
    expect(isBlank(changed)).toBe(false);
    expect(await fingerprint(changed)).not.toBe(await fingerprint(state));
  });
});
