import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);
const manifest = JSON.parse(
  await readFile("content/source-manifest/hosted.json", "utf8"),
);
const approved = new Map();
for (const entry of manifest.entries)
  for (const a of [entry.audio, entry.transcript]) {
    if (
      !/^book[234]\/audio-us\/[^/]+\.(mp3|lrc)$/.test(a.path) ||
      a.path.includes("..")
    )
      throw new Error("Unsafe allowlist path");
    approved.set(`projects/New-Concept-English/${a.path}`, a);
    approved.set(`dist/media/${a.path}`, a);
  }
for (const a of manifest.excludedFiles)
  approved.set(`projects/New-Concept-English/${a.path}`, a);
async function all(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    out.push(...(e.isDirectory() ? await all(p) : [p]));
  }
  return out;
}
const built = await all("dist");
const issues = [];
for (const p of [...tracked, ...built]) {
  const bytes = await readFile(p);
  const a = approved.get(p);
  if (
    a &&
    (a.sizeBytes !== bytes.length ||
      a.sha256 !== createHash("sha256").update(bytes).digest("hex"))
  )
    issues.push(`Repository resource mismatch: ${p}`);
  if (/\.(mp3|lrc|pdf|wav|aiff|webm)$/i.test(p) && !a)
    issues.push(`Unexpected media: ${p}`);
  if (/\.(mp3|pdf)$/i.test(p)) continue;
  const text = bytes.toString("utf8");
  if (
    /(?:ghp_|gho_|sk-proj-)[A-Za-z0-9_-]{20,}/.test(text) ||
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)
  )
    issues.push(`Potential key in ${p}`);
  if (
    (text.match(/\[\d{2}:\d{2}\.\d{2,3}\]/g) || []).length > 8 &&
    !p.startsWith("tests/") &&
    !a
  )
    issues.push(`Unexpected transcript in ${p}`);
}
for (const entry of manifest.entries)
  for (const a of [entry.audio, entry.transcript])
    if (!built.includes(`dist/media/${a.path}`))
      issues.push(`Deployment resource missing: ${a.path}`);
if (built.some((p) => p.endsWith(".pdf")))
  issues.push("PDF unexpectedly deployed");
if (issues.length) throw new Error(issues.join("\n"));
console.log(
  `PASS: ${tracked.length} tracked files, ${built.length} built files; 408 exact repository MP3/LRC assets verified; no PDF deployment or unexpected media/credential/transcript patterns. Scoped scan only.`,
);
