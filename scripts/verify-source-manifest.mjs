import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const manifest = JSON.parse(
  await readFile("content/source-manifest/nce2.json", "utf8"),
);
const res = await fetch(
  `https://api.github.com/repos/${manifest.sourceRepo}/git/trees/${manifest.repoRef}?recursive=1`,
);
if (!res.ok) throw new Error(`GitHub source tree failed (${res.status})`);
const tree = await res.json();
assert.equal(tree.truncated, false);
assert.equal(tree.sha, manifest.repoRef);
const paths = new Map(tree.tree.map((x) => [x.path, x]));
for (const entry of manifest.entries)
  for (const s of entry.sources) {
    const item = paths.get(s.relativePath);
    assert(item, `Missing ${s.relativePath}`);
    assert.equal(item.sha, s.gitBlobSha);
    assert.equal(item.size, s.sizeBytes);
    assert.equal(s.rightsStatus, "unverified");
    assert.equal(s.accessMode, "user_local_import");
  }
for (const ext of ["mp3", "lrc"])
  assert.equal(
    tree.tree.filter(
      (x) =>
        x.path.startsWith("新概念英语第2册美音（MP3+LRC）/") &&
        x.path.endsWith("." + ext),
    ).length,
    96,
  );
assert.equal(
  tree.tree.filter((x) => /(^|\/)(license|licence|copying)(\.|$)/i.test(x.path))
    .length,
  0,
);
console.log(
  `PASS: 10 exact paths at ${manifest.repoRef}; 96 MP3 + 96 LRC; no license file found. Rights and original audio decode remain unverified.`,
);
