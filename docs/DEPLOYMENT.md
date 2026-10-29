# Deployment

The independent repository is `werneryang/nce-learning-lab`; no files in `werneryang.github.io` are modified. Vite base is `/nce-learning-lab/` and routes use hashes so GitHub Pages does not require server rewrite rules.

GitHub Pages is configured for Actions. `.github/workflows/ci-pages.yml` runs lint, typecheck, unit tests, all three browser projects and build/public-assets scan. The source-specific LRC check is skipped in CI deliberately. Only successful pushes to main or the development branch may publish static `dist/` through the official Pages artifact/deploy actions. PR events validate without deploying.

No private files, credentials, API keys or environment files belong in deployment assets. Pages provides static hosting only; there is no secure AI service, cloud synchronization or automatic offline application cache. The browser can continue editing local data while open and disconnected, but a fresh offline navigation is not promised.

See HOSTED_RESOURCES_REPORT.md for the current source commit, workflow and online checks. ACCEPTANCE_REPORT.md is the original Phase 0–2 historical report; configuration alone is not proof of publication.

## Repository audio/subtitle assets

`predev` and `prebuild` stage the manifest-listed MP3/LRC files from the existing repository into ignored `public/media/`. Vite copies them to `dist/media/`; URLs include the Pages base path and encode every filename component, including full-width punctuation. PDF files and unrelated/private files are never copied. No media is fetched from upstream during build. `scan-public.mjs` permits only exact manifest resources, verifies sizes/hashes and rejects unexpected media or PDFs in deployment. Update source files intentionally with `node scripts/prepare-media.mjs --index`, inspect the manifest diff, and rebuild.

Fresh browsers need no local import. Direct streaming requires network access; optional local replacements retain priority. JSON restore does not require re-importing repository audio. The absence of publisher licensing is still recorded explicitly; Git availability alone is not a license.

## VOA repository resources

The owner's 2026-10-29 request additionally authorizes publishing the ten collected VOA Health & Lifestyle articles. `resources/voa/` holds MP3, text, vocabulary and source metadata. `content/source-manifest/voa-hosted.json` controls the 51 files staged into `media/voa/`; exact sizes/hashes are checked before copying and again in the public scan. No local validation files or original page HTML are published. The existing 408 NCE MP3/LRC assets are unchanged. See [VOA resources](VOA_IMPORTER.md) for rights status and playback limitations.
