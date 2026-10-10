# NCE Learning Lab

A local-first English practice app built to the supplied **Complete Specification v1.1**. React + TypeScript + Vite. Listen, recall and rewrite in a quiet editor; ask for Hint or Review yourself.

The app ships **no textbook text or recordings**. Import MP3/LRC you are entitled to use, confirm body lines, then practice. Audio, text, drafts and learning records are saved in browser IndexedDB. JSON backup includes private imported text but excludes audio. Different devices do not synchronize.

**AI Tutor is not configured.** Real deterministic fidelity comparison, limited labeled local rules, and an explicit manual ChatGPT workflow are available. No simulated AI, general language score or pronunciation score.

## Run

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium webkit
npm run test:e2e
```

E2E generates project-original MP3 at runtime. Install FFmpeg with `libmp3lame` or set `FFMPEG_PATH` to such a binary. Fixture audio is only for automated tests, not lesson content. Private source-file verification is optional: set `NCE_SOURCE_VERIFY_DIR` to your local directory of five UTF-8 LRC files to enable `tests/source-local.test.ts`; normal CI explicitly skips this copyrighted-source check.

`npm run verify:sources` revalidates exact upstream paths/blob metadata at the pinned commit (network required). `npm run scan` scans tracked files and built assets after building. See `docs/` for model, privacy, tutor contract, testing, deployment and actual acceptance results.

## Start learning

1. Open a lesson and Import & sources; choose your own MP3 and LRC. Label the audio accent yourself.
2. In source/body review, inspect the lines, choose Lesson body and Confirm. Questions are kept separate.
3. Accept chunks you want to learn. Select a confirmed sentence or a custom group; full lesson uses all confirmed body lines.
4. Start dictation or memory recall (subtitles hide), or choose guided rewriting. Type uninterrupted and save locally.
5. Click Hint for graduated local guidance. Click Review for reference differences and supported rules. Different wording does not imply incorrect English.
6. Revise in your own words, Recheck, save selected issues, then Finish with your own skill rating.
7. Export learning JSON in Settings. Keep backups private; re-import audio when restoring to a different browser.

## Textbook materials

`projects/New-Concept-English/` holds New Concept English (Books 2–4) PDFs, audio and LRC files, collected from [tangx/New-Concept-English](https://github.com/tangx/New-Concept-English). They are kept here **for the owner's personal study only**. Copyright belongs to the original publishers and authors; no rights are claimed or granted. They are not part of the app and not used by the build. If you are a rights holder and want them removed, please open an issue.
