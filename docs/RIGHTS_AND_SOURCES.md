# Sources and rights

Upstream: https://github.com/tangx/New-Concept-English, commit `635746ac5f696b193311bc1a7e8ffac3b252eb75`. On 2026-10-09 the complete Git tree was checked (not truncated): Book 2 US directory had 96 `.mp3` and 96 `.lrc` files. Ten exact pilot paths, file sizes and Git blob IDs are in `content/source-manifest/nce2.json`. No LICENSE/LICENCE/COPYING file was found; redistribution rights remain **unverified**. UK ZIP content and original MP3 decoding were not verified.

Five upstream LRCs were retrieved only into a private development verification directory outside this repository to verify parsing: lessons 1–5 contained 18, 19, 14, 13 and 12 timed segments, respectively; parser warnings were zero. Questions and unreviewed lines were retained separately. These files are not in Git, public assets, bundle or CI fixtures. End-user original-audio integration remains a local user verification step with files they may use.

The published application makes no automatic requests for third-party textbooks, PDFs, LRCs or audio. Source links open a reference page after user action. Media comes from the user's own file picker and is stored in local IndexedDB as binary bytes (reconstructed into Blob on load for WebKit compatibility). Accent is labeled by the user, not identified automatically.

The catalog, candidate definitions, Chinese glosses, examples and writing/speaking prompts are project-authored. Short expression names and lesson titles identify study topics; no textbook narrative paragraphs are reproduced. Each accepted expression is keyed by form and sense and linked to lessons only after user acceptance.

Public-assets scans check committed file types, common credential patterns and excessive timed-transcript patterns; final review also checks the upstream transcript text is absent from tracked files and bundles. These scoped checks are evidence of what was examined, not a claim of universal legal clearance or secret detection. No public media license has been inferred from GitHub availability.
