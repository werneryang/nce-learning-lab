import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .trim()
  .split("\n");
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
  if (/\.(mp3|lrc|pdf|wav|aiff|webm)$/i.test(p))
    issues.push(`Forbidden media file: ${p}`);
  const text = await readFile(p, "utf8").catch(() => "");
  if (
    /(?:ghp_|gho_|sk-proj-)[A-Za-z0-9_-]{20,}/.test(text) ||
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)
  )
    issues.push(`Potential key in ${p}`);
  if (
    (text.match(/\[\d{2}:\d{2}\.\d{2,3}\]/g) || []).length > 8 &&
    !p.startsWith("tests/")
  )
    issues.push(`Potential full timed transcript in ${p}`);
}
if (issues.length) throw new Error(issues.join("\n"));
console.log(
  `PASS: ${tracked.length} tracked paths and ${built.length} built assets scanned for forbidden media, credential patterns and full timed transcripts. This is a scoped scan, not a universal secret detector.`,
);
