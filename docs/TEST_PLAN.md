# Reproducible checks

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run scan`, `npm audit`.

`npm run verify:sources` checks the pinned upstream tree only; it never downloads media. `NCE_SOURCE_VERIFY_DIR=<private-folder> npm test` additionally runs the private five-LRC integration. Ordinary CI skips this one check because textbooks are not CI fixtures.

`npx playwright install chromium webkit`; then `npm run test:e2e`. FFmpeg must include libmp3lame (or use FFMPEG_PATH). The suite generates its own 10-second MP3 tone and authored LRC/text at runtime in ignored test-results. This is codec/playback evidence, not verification of the publisher's original voice.

Browser projects: Chromium desktop, WebKit desktop, WebKit with iPhone 13 viewport/touch/user agent. These are automation engines, **not native Mac Safari or a physical iPhone**. A passing emulation test does not claim a real-device acceptance.

Coverage maps:

| Spec        | Evidence                                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T01/T03/T07 | Empty state, disabled audio, role confirmation, empty review; unit tests cover repeated/invalid timestamps, metadata, Unicode and encoding failure                             |
| T02         | Generated real MP3 decode/play, highlighted line, 1.25x, loop, seek; original textbook MP3 requires user-local verification                                                    |
| T04/T05/T06 | Refresh restores draft and hidden subtitles; >200 characters, paste-equivalent fill, composition events, selection/blur preserve text; no /api/tutor calls; L1/L2/L3 hints     |
| T08/T09     | Original fidelity differences never automatically become grammar errors; rewriting has no word-match score; local semantic limitations visible                                 |
| T10/T11     | Delayed review + concurrent edit labels old version; review/revise/recheck/finish retains history and snapshot                                                                 |
| T12/T13     | Five lessons reuse one same-sense card across lessons 1/4; independent recognition/writing/speaking records                                                                    |
| T14/T15     | Export/delete/restore history and mistakes; missing backend is explicit and manual sharing is available                                                                        |
| T16         | Hostile LRC rendered literally, no HTML execution; schema/adapter unit tests validate model-shaped feedback as data                                                            |
| T17         | Artifact/commit scans plus absence checks against five privately held source transcripts                                                                                       |
| T18         | Keyboard focus, long draft, narrow layout; WebKit iPhone simulation; native Mac Safari was manually checked for import/play/review/refresh; physical iPhone remains unverified |

Failure handling tests include encoding, malformed timestamps, comparison size bound, damaged backup checksums, future schema versions, duplicate mastery, unknown source references, cancellation and malformed remote feedback. No live AI backend is tested or represented as connected. The network adapter's HTTP tests use explicit mocks solely for its optional contract.

An additional privacy test verifies individual session deletion requires an explicit confirmation and clears dependent private records. It runs in all three browser projects; a unit test also checks dependency cleanup and preservation of other sessions/aggregate schedules.

Native Mac Safari manual check (2026-10-09): locally import original project-authored MP3/LRC, play and observe time, explicitly confirm a body line, start dictation, hide subtitles, save a draft, review one edit, revise/recheck to zero edits, finish, then reload and restore draft/audio/two feedback turns. The public HTTPS home and five-lesson directory were also opened. No original textbook MP3 or physical iPhone was used.
