# v9 Integration Verification — 2026-10-31

## Checks performed locally

1. Unit tests: **21 passed** (`python -m unittest discover -s scripts -p 'test_*.py'`).
2. JavaScript syntax: `app.js`, `results.js`, `sw.js` passed Node `--check`.
3. Offline pipeline: `python scripts/run_sync.py --offline` generated Meta and integrity reports, five source jobs were intentionally marked skipped; did not make external fetches.
4. Chromium headless via Playwright using local mocked fetch responses: pages navigated, 7 source records rendered, two complete decks opened comparison dialog, Meta region/time view displayed, card library/builder/status pages rendered; **no pageerror**.
5. Deck data validation: 7 source rows loaded; 0 schema rejections; 7 unique complete deck fingerprints. This does not independently verify original tournament results.
6. PWA source includes HTTPS service worker and install manifest, but an actual Pages deployment/install test **not performed**.

## Deferred online checks (must not claim pass)

- First GitHub Actions actual connection to Limitless and published card metadata.
- TOP DECKS robots.txt access and source HTML layout under production execution.
- Every new set after OP17 and all countries’ data sources (not yet supported in importer).
- Any public RSS feeds (none pre-configured).
- Current tournament ban/restricted-card policy (rulesets intentionally empty).
- Actual Android PWA install and service worker upgrade/offline behavior under HTTPS.

## Evidence taxonomy

- `platform_result`: public tournament platform record; not independent verification of play logs.
- `source_reported`: third-party website's tournament report.
- `community_claim`: player/community post, not official result.
- `topCutShare`: ratio of **indexed top-eight entries**, not global win rate or popularity share.

No invented win rates or unauthorized card art reproductions were added.
