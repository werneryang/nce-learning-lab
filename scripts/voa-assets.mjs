import { readFile } from "node:fs/promises";
export async function voaAssets() {
  const manifest = JSON.parse(
    await readFile("content/source-manifest/voa-hosted.json", "utf8"),
  );
  const assets = [
    manifest.package,
    ...manifest.entries.flatMap((e) => [e.audio, e.transcript, ...e.files]),
  ];
  const paths = new Set();
  for (const a of assets) {
    if (
      !/^voa\/(?:library\.json|VOA-\d+\/(?:VOA-\d+\.mp3|lesson\.json|metadata\.json|transcript\.txt|vocabulary\.txt))$/.test(
        a.path,
      ) ||
      paths.has(a.path) ||
      !Number.isSafeInteger(a.sizeBytes) ||
      a.sizeBytes <= 0 ||
      !/^[a-f0-9]{64}$/.test(a.sha256)
    )
      throw new Error("Invalid or duplicate VOA asset manifest entry");
    paths.add(a.path);
  }
  return assets;
}
