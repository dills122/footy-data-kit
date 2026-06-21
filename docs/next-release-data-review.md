# Next Release Data Review

This note summarizes the data-facing work completed after `v1.0.0` and before
the next release. Use it as release-note source material and as a checklist for
the final merge/release review.

## Since `v1.0.0`

The post-`v1.0.0` branch work has three main data themes:

1. Expanded and validated tier 5/level 6 generated data.
2. Tightened club metadata over the expanded generated season scope.
3. Added club crest asset metadata, review tooling, and consumer guidance.

## Dataset Coverage

The season range remains unchanged: `1888-2025`, with 138 generated season
records.

Tier coverage changed materially:

| Area            | `v1.0.0` | Current branch | Notes                                                      |
| --------------- | -------: | -------------: | ---------------------------------------------------------- |
| `tier1` seasons |      127 |            127 | unchanged                                                  |
| `tier2` seasons |      125 |            125 | unchanged                                                  |
| `tier3` seasons |       99 |             99 | unchanged                                                  |
| `tier4` seasons |       68 |             68 | unchanged                                                  |
| `tier5` seasons |       14 |             47 | expanded to the modern lower-tier slice                    |
| `tier6` seasons |        5 |             47 | expanded with parallel divisions under `tier6.divisions[]` |

The main release note should call out that the release does not change the top
four tier contract, but it substantially broadens generated lower-tier coverage
from 1979 through 2025.

## Club Metadata

Club metadata grew from 232 records at `v1.0.0` to 375 records on this branch.
That growth is expected because the expanded tier 5/6 generated data surfaces
more clubs in the maintained dataset.

Current high-level club status counts:

| `status.current` | Count |
| ---------------- | ----: |
| `active`         |   290 |
| `defunct`        |    60 |
| `merged`         |    18 |
| `historical`     |     6 |
| `relocated`      |     1 |

`data/club-metadata-review.json` is clean on this branch:

- `issueCount`: 0
- `issueCounts`: `{}`

Consumer-facing reminder for release notes:

- `trackedFromSeason` and `trackedToSeason` are observed generated-data bounds,
  not founded/dissolved dates.
- `status.current` is the current high-level metadata status, not a season-row
  outcome.
- `history` contains source-backed facts; `derived` contains generated audit and
  navigation fields.

## Club Crest Assets

This branch adds `assets.crest` bundles to `data/club-metadata.json`.

The pipeline stores image URLs and provenance only. It does not download or
commit image binaries.

Current crest status counts:

| `assets.crest.status` | Count | Meaning                                                                               |
| --------------------- | ----: | ------------------------------------------------------------------------------------- |
| `restricted`          |   339 | A candidate exists, but the best available club mark is license/trademark restricted. |
| `usable`              |    18 | A source-discovered or curated candidate has a passing license check.                 |
| `placeholder`         |    17 | Generated fallback crest from source-backed colors; not official artwork.             |
| `needs-more-research` |     1 | No acceptable image or source-backed color fallback yet.                              |

Current asset review issue counts:

| Issue                            | Count | Release interpretation                                                                                                   |
| -------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------ |
| `club-asset-license-restricted`  |   350 | Expected for club marks; consumers must opt in to using restricted artwork.                                              |
| `club-asset-needs-more-research` |     1 | `Hounslow` remains the only true missing crest/color case.                                                               |
| `club-asset-quality-review`      |     3 | `Bridgend Town`, `Bromsgrove Rovers`, and `Solihull Borough` have club-related candidates that need better replacements. |

The noisy review buckets are currently clear:

- `club-asset-identity-uncertain`: 0
- `club-asset-non-crest-candidate`: 0
- `club-asset-multiple-review-candidates`: 0

Consumer-facing asset guidance for release notes:

- Use `usable` for assets with passing license checks.
- Include `placeholder` if generated fallback shields are acceptable.
- Include `restricted` only if the consuming app/service can handle club mark
  licensing and trademark restrictions.
- Treat `needs-review`, `needs-more-research`, and `failed` as non-display
  states unless the consumer has its own review workflow.

## Tooling And Docs

New or expanded support around this data:

- `wikipedia/data/generate-club-assets.js` discovers and classifies crest
  candidates.
- `data/club-assets-review.json` summarizes manual review issues.
- `docs/club-assets-review.html` provides a temporary local audit UI.
- `docs/club-assets.md` documents statuses, sources, review rules, and consumer
  filtering.
- The docs site now links to the asset review UI and schema docs.
- JSON Hero release-link helper docs and scripts were added for release data
  inspection.

## Validation Run During Branch Work

Focused checks run during the branch work included:

- asset Jest tests
- club asset generation tests
- JSON Schema verification tests
- `pnpm -s schema:verify`
- `pnpm format:check`
- `pnpm -s docs:check`
- `pnpm -s lint`

## Release Readiness Pass

The release-readiness pass on June 21, 2026 completed the local data/docs gate
for this branch:

- `pnpm test`
- `pnpm test:integration`
- `pnpm typecheck`
- `pnpm -s verify:data`
- `pnpm -s schema:verify`
- `pnpm format:check`
- `pnpm -s docs:check`
- `pnpm -s lint`
- `pnpm -s release:dry-run-data`

The live integration and release dry-run commands require network access for
Wikipedia source pages. The release dry-run rebuilt the full `1888-2025` range
into a temporary directory, produced 138 season records and 375 club metadata
records, and passed data verification, club continuity verification, and JSON
Schema verification against the dry-run output.

Package version changes, generated release-note pages, and final release-note
validation are intentionally left for the dedicated pre-release branch.

## Final Release Gate Still Recommended Before Tagging

On the pre-release branch, repeat the full release-level gate from a clean tree
after applying the package version and release-note changes:

```bash
pnpm test
pnpm test:integration
pnpm typecheck
pnpm -s verify:data
pnpm -s schema:verify
pnpm format:check
pnpm -s docs:check
pnpm -s lint
pnpm -s release-notes:check
pnpm -s release-notes:check:all
```

Also rerun the release dry-run if the release process expects regenerated data:

```bash
pnpm -s release:dry-run-data
```

## Release Note Draft Points

Recommended user-facing points for the next release note:

- Expanded generated lower-tier data: tier 5 and level 6 now cover 1979-2025
  where source pages expose usable tables.
- Club metadata now covers 375 records and reflects the expanded lower-tier
  generated scope.
- Club metadata now includes `assets.crest` candidate bundles with provenance,
  license checks, generated placeholders, and manual-review flags.
- Club crest URLs are links/provenance only; the package does not redistribute
  image binaries.
- Most club marks are license/trademark restricted. Consumers should filter by
  status according to their app's rights model.
- Known remaining non-license asset review items are limited to Hounslow
  missing research and three quality-review candidates.
