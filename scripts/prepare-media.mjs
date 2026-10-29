import { voaAssets } from "./voa-assets.mjs";
import {
  readFile,
  readdir,
  mkdir,
  copyFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const root = "projects/New-Concept-English";
const indexPath = "content/source-manifest/hosted.json";
const sha256 = (b) => createHash("sha256").update(b).digest("hex");
if (process.argv.includes("--index")) {
  const entries = [];
  for (const [book, count] of [
    [2, 96],
    [3, 60],
    [4, 48],
  ]) {
    const dir = `book${book}/audio-us`;
    const files = (await readdir(`${root}/${dir}`))
      .filter((x) => x.endsWith(".mp3"))
      .sort();
    assert.equal(files.length, count);
    for (const file of files) {
      const match = /^(\d+)－(.+)\.mp3$/.exec(file);
      assert(match, `Unexpected filename: ${file}`);
      const number = Number(match[1]);
      const asset = async (name) => {
        const path = `${dir}/${name}`;
        const bytes = await readFile(`${root}/${path}`);
        return { path, sizeBytes: bytes.length, sha256: sha256(bytes) };
      };
      entries.push({
        lessonId: `NCE${book}-L${String(number).padStart(3, "0")}`,
        book,
        number,
        title: match[2],
        audio: await asset(file),
        transcript: await asset(file.replace(/\.mp3$/, ".lrc")),
      });
    }
  }
  const excludedFiles = [];
  for (const book of [2, 3, 4]) {
    const path = `book${book}/textbook.pdf`;
    const bytes = await readFile(`${root}/${path}`);
    excludedFiles.push({
      path,
      sizeBytes: bytes.length,
      sha256: sha256(bytes),
    });
  }
  await writeFile(
    indexPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        sourceRepo: "werneryang/nce-learning-lab",
        sourceRef: "b461e8d1250da958643e3a336a09d58d7a0b8406",
        rightsStatus: "unverified",
        deploymentBasis:
          "User explicitly requested deployment of the existing repository MP3/LRC files; this does not establish a publisher license.",
        entries,
        excludedFiles,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Indexed ${entries.length} exact MP3/LRC pairs; PDFs excluded from deployment.`,
  );
} else {
  const manifest = JSON.parse(await readFile(indexPath, "utf8"));
  await rm("public/media", { recursive: true, force: true });
  let count = 0;
  for (const entry of manifest.entries)
    for (const asset of [entry.audio, entry.transcript]) {
      assert(
        /^book[234]\/audio-us\/[^/]+\.(mp3|lrc)$/.test(asset.path) &&
          !asset.path.includes(".."),
        "Unsafe asset path",
      );
      const bytes = await readFile(`${root}/${asset.path}`);
      assert.equal(
        bytes.length,
        asset.sizeBytes,
        `Size mismatch: ${asset.path}`,
      );
      assert.equal(sha256(bytes), asset.sha256, `Hash mismatch: ${asset.path}`);
      await mkdir(
        `public/media/${asset.path.slice(0, asset.path.lastIndexOf("/"))}`,
        { recursive: true },
      );
      await copyFile(`${root}/${asset.path}`, `public/media/${asset.path}`);
      count++;
    }
  assert.equal(count, 408);
  const voa = await voaAssets();
  for (const asset of voa) {
    const source = `resources/${asset.path}`;
    const target = `public/media/${asset.path}`;
    const bytes = await readFile(source);
    assert.equal(bytes.length, asset.sizeBytes, `Size mismatch: ${source}`);
    assert.equal(sha256(bytes), asset.sha256, `Hash mismatch: ${source}`);
    await mkdir(target.slice(0, target.lastIndexOf("/")), { recursive: true });
    await copyFile(source, target);
  }
  console.log(
    `Prepared ${count} verified NCE assets and ${voa.length} verified VOA assets; no PDFs or private files copied.`,
  );
}
