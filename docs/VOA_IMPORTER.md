# VOA listening resources

The website includes ten Health & Lifestyle articles as a separate VOA collection. Choose **VOA · Health & Lifestyle** on Lessons and press Play. Audio and reading text load from this site's repository assets; no local import is required. The 204 NCE lessons and their source files are unchanged.

## Repository and publication

`resources/voa/` contains the ten MP3 files, cleaned transcripts, vocabulary, source metadata, validated lesson records and the original collection package (`library.json`). `content/source-manifest/voa-hosted.json` lists every deployed asset with its size and SHA-256. `predev` and `prebuild` verify and copy only this explicit list into `public/media/voa/`, and the public-assets scan verifies the built files again. Builds do not download from VOA. Original website HTML and local validation environments are excluded.

Publication follows the owner's explicit 2026-10-29 request to put the VOA resources in the repository and make them accessible through the website. This is deployment authorization, not a third-party redistribution license. The ten articles retain AP/AFP reporting credits and `rightsStatus: unverified`; no AP/AFP photographs are included. See [VOA content policy](https://learningenglish.voanews.com/p/6861.html) and [terms](https://learningenglish.voanews.com/p/6021.html).

## Learning behavior

Courses use separate `VOA-<article ID>` identities. Hosted articles and optional private imports with the same ID appear once. Loading an article never confirms its body lines automatically. Existing local text, review choices, practice, chunks and audio overrides take priority and are not overwritten on refresh.

VOA reading segments have no invented timestamps: current-line filtering, line seeking and line loops are unavailable until actual timed subtitles are supplied. Whole-audio playback, speed, seeking, ten-second jumps and whole-lesson loops work. Vocabulary remains separate. Single-segment practice uses the first selected paragraph or heading, rather than claiming that it is one sentence.

Every item is marked `page_linked_unreviewed`. Complete audio decoding and a same-page MP3 link do not establish verbatim text/audio equivalence. Paragraphs may include unspoken headings or narrator sign-offs; confirm the text you want to practice. Automatic alignment and human listening review are not claimed.

Learning records and imported overrides remain private in browser IndexedDB. JSON backups include course metadata/text and exclude audio. Hosted audio remains available after restore without selecting files; a missing private replacement falls back to hosted audio with a notice to check the pairing. Private-only courses still need their MP3s reimported. Other devices can access the hosted resources immediately, but learning progress still uses the existing backup/merge workflow rather than cloud synchronization.

VOA metadata lives in its import record and travels with backup/merge. NCE-only exports retain envelope version 1. Exports containing VOA use envelope version 2 so earlier releases reject them rather than silently discard metadata. This release reads both; the internal state remains version 1 with additive import metadata.

## Local collection and validation

Python 3.9+ and FFmpeg on PATH are required for the collector:

```sh
python3 scripts/download-voa.py --limit 10
```

The default output is ignored `private/voa-health/`. This directory is for collection and validation; editing it does not modify the hosted site. Promoting a different collection requires explicitly updating repository assets and their manifest.

`--limit` and `--max-pages` are bounded to 1–20; default maximum pages is 3. `--output` may select another directory, but repository paths outside `private/` are rejected. The collector reads the article archive and each article's own MP3 link, preferring 64 kbps. RSS/title/date similarity is not used as a substitute for a same-page audio association. It extracts body paragraphs and vocabulary separately, excludes nested players/image captions, verifies full MP3 decoding, records hashes and writes a per-run report. Network requests are spaced, size-limited, retried and restricted to VOA hosts including redirects.

Reruns reuse files and validate their hashes; changed or incomplete files are reported and never overwritten. A different selection or a fresh extraction needs a new output directory. A partial collection is saved with a nonzero exit status. This is a bounded pilot collector, not a claim of archive completeness.

Under **Optional local VOA files**, a folder or `library.json` plus its MP3s may still be imported privately. Duplicate imports preserve existing review and practice. Conflicting audio versions are rejected rather than silently replacing a course. Nothing selected through this optional browser importer is uploaded.

## Validation

The collected ten MP3s total 33,403,075 bytes and passed full FFmpeg decoding. The real package was also imported in an isolated Chromium profile, with all ten courses visible and the first 408.37-second recording played. This test did not alter the user's browser records.

```sh
python3 -m unittest discover -s tests -p 'test_voa*.py'
npm test
npm run lint
npm run typecheck
npm run build
npm run scan
npx playwright test
```

Run the build before or after browser tests, not concurrently: the existing media staging script regenerates `public/media`. Browser tests cover direct hosted playback, delayed text loading, review preservation, reload, optional import and unchanged NCE collections on Chromium, WebKit and iPhone WebKit. Optional import fixtures use original generated audio; set `FFMPEG_PATH` to a binary with `libmp3lame` for those tests.
