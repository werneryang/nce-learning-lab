# Deployment

The independent repository is `werneryang/nce-learning-lab`; no files in `werneryang.github.io` are modified. Vite base is `/nce-learning-lab/` and routes use hashes so GitHub Pages does not require server rewrite rules.

GitHub Pages is configured for Actions. `.github/workflows/ci-pages.yml` runs lint, typecheck, unit tests, all three browser projects and build/public-assets scan. The source-specific LRC check is skipped in CI deliberately. Only successful pushes to main or the development branch may publish static `dist/` through the official Pages artifact/deploy actions. PR events validate without deploying.

No private files, credentials, API keys or environment files belong in deployment assets. Pages provides static hosting only; there is no secure AI service, cloud synchronization or automatic offline application cache. The browser can continue editing local data while open and disconnected, but a fresh offline navigation is not promised.

See ACCEPTANCE_REPORT.md for the actual source commit, workflow, online checks and any deployment limitation; configuration alone is not proof of publication.
