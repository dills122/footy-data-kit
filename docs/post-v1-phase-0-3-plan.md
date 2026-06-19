# Post-V1 Phase 0-3 Plan

This plan defines the first post-v1 branch scope. It keeps TypeScript migration
and lower-tier expansion moving together while preserving the v1 dataset
contract and avoiding hand edits to generated `data-output/` files.

## Overview

The branch targets four connected phases:

1. Reset the post-v1 baseline.
2. Add TypeScript contract foundations for maintained Wikipedia data flow.
3. Lock tier 1-4 semantics before broader lower-tier expansion.
4. Prepare and execute lower-tier backfill slices for tier 5 and level 6.

Generated data refreshes were deferred until parser behavior, typed contracts,
and focused tests were in place. After those gates passed, this branch refreshed
the checked-in generated output from source pages.

## Completion Status

| Phase   | Status                    | Evidence                                                                                                                                                          |
| ------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 | Complete                  | Roadmap and next-work docs now point at the post-v1 baseline and this plan.                                                                                       |
| Phase 1 | Complete for branch scope | Shared TypeScript contracts exist for Wikipedia tier/config/parser boundaries, with output metadata aligned to those contracts.                                   |
| Phase 2 | Complete                  | Focused tests lock tier 1-4 boundaries, including 1921/1957 parallel level 3, 1958 true tier 4, 1992 renumbering, 2004 rebrand, and 2019 administrative outcomes. |
| Phase 3 | Complete for branch scope | Lower-tier competition pages now backfill tier 5 from 1979-2025 and level 6 from 2004-2025; refreshed generated output verifies cleanly.                          |

Checked-in `data-output/` is intentionally refreshed on this branch after the
parser/config/test gates and lower-tier dry runs proved the backfill path.
`data/club-metadata.json` now follows the expanded season scope. Intermittent
level-5/6 membership is represented as observed stints, and unresolved
lower-tier status work is tracked in `data/club-metadata-review.json`.

## Architecture Decisions

- Keep `wikipedia/` as the maintained ingestion path.
- Keep `tierN` as the actual pyramid level, with parallel leagues stored under
  `tierN.divisions[]`.
- Add typed boundaries before converting parser-heavy modules.
- Treat `rsssf/` as legacy comparison/archive tooling.
- Change checked-in generated output only through source rebuild commands after
  parser/config/test gates pass.

## Phase 0: Baseline Reset

**Description:** Move planning from the pre-v1 release gate to the post-v1
implementation track and make local verification expectations explicit.

**Acceptance criteria:**

- [x] Roadmap names `v1.0.0` as the current release.
- [x] Next-work points at this branch plan.
- [x] Runtime mismatch is documented if `pnpm` runs under Node older than 20.
- [x] No generated `data-output/` files changed during baseline reset.

**Verification:**

- [x] `git diff -- docs/roadmap.md docs/next-work.md docs/post-v1-phase-0-3-plan.md`
- [x] `node -p "process.version"`

**Dependencies:** None

**Files likely touched:**

- `docs/roadmap.md`
- `docs/next-work.md`
- `docs/post-v1-phase-0-3-plan.md`

**Estimated scope:** Small

## Phase 1: TypeScript Contract Foundation

**Description:** Add shared TypeScript contracts for Wikipedia tier keys,
league-level rules, parsed overview tables, and season build inputs without
rewriting parser behavior.

**Acceptance criteria:**

- [x] Maintained modules can import a shared type surface for tier keys,
      parallel groups, overview parsed tables, and league-level metadata.
- [x] Existing output model types reuse or align with the shared contracts.
- [x] TypeScript checking stays strict and passes.

**Verification:**

- [x] `node_modules/.bin/tsc --noEmit`
- [x] Focused Jest tests for touched output normalizer and builder behavior.

**Dependencies:** Phase 0

**Files likely touched:**

- `wikipedia/models/output-file.ts`
- `wikipedia/models/wikipedia.ts`
- `wikipedia/data/*.ts`
- `wikipedia/builders/parse-ext-season-overview-pages.js`

**Estimated scope:** Medium

## Phase 2: Tier 1-4 Semantic Lock

**Description:** Add focused tests that protect established tier semantics
before broadening lower-tier coverage.

**Acceptance criteria:**

- [x] Tests prove `tier3.divisions[]` represents Third Division North/South from
      1921-1957.
- [x] Tests prove true `tier4` starts in 1958.
- [x] Tests prove 1992 and 2004 naming shifts do not change level semantics.
- [x] Tests preserve 2019 administrative outcome behavior.

**Verification:**

- [x] `node_modules/.bin/jest --runTestsByPath wikipedia/__tests__/parse-ext-season-overview-pages.test.js wikipedia/__tests__/wiki-overview-parser.test.js`
- [x] `node_modules/.bin/jest --runTestsByPath wikipedia/__tests__/verify-football-data.test.js`

**Dependencies:** Phase 1 typed contracts where useful

**Files likely touched:**

- `wikipedia/__tests__/parse-ext-season-overview-pages.test.js`
- `wikipedia/__tests__/wiki-overview-parser.test.js`
- `wikipedia/__tests__/verify-football-data.test.js`

**Estimated scope:** Medium

## Phase 3: Lower-Tier Backfill

**Description:** Prepare parser/config/test slices for tier 5 and level 6
backfill, then regenerate checked-in output from source pages after dry-run
validation.

**Recommended slice order:**

1. Backfill level 6 for `2012-2020`, because `tier5` already exists there.
2. Backfill `tier5` and level 6 for `2004-2011`.
3. Backfill `tier5` for `1979-2003`.
4. Defer true level 7 until tier 5 and level 6 are vetted.

**Acceptance criteria:**

- [x] Tests document the expected parser/build behavior for each backfill slice.
- [x] Any added config rules use shared constants and typed contracts.
- [x] Representative dry-run findings are documented before generated output is refreshed.
- [x] Checked-in `data-output/` files are regenerated only after parser, verifier, and dry-run gates pass.
- [x] Source-availability gaps are separated from parser/builder capability gaps.

**Verification:**

- [x] Focused parser/builder Jest tests pass.
- [x] `node_modules/.bin/tsc --noEmit`
- [x] `pnpm wiki:build:lower-tiers`
- [x] `pnpm wiki:build:combined`
- [x] `pnpm wiki:minify:overview`
- [x] `pnpm wiki:minify:combined`
- [x] `pnpm -s verify:data`

**Dependencies:** Phases 1 and 2

**Files likely touched:**

- `wikipedia/config.js`
- `wikipedia/parser-core/wiki-overview-parser.js`
- `wikipedia/builders/parse-ext-season-overview-pages.js`
- `wikipedia/__tests__/parse-ext-season-overview-pages.test.js`
- `docs/lower-tier-coverage-analysis.md`

**Estimated scope:** Medium

## Risks And Mitigations

| Risk                                               | Impact | Mitigation                                                                                 |
| -------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------ |
| Parser changes silently alter generated data       | High   | Add tests first, dry-run broad ranges, and regenerate only through source build commands   |
| TypeScript conversion becomes a behavior rewrite   | Medium | Add typed boundaries before converting implementation-heavy files                          |
| Lower-tier labels are ambiguous on Wikipedia pages | Medium | Preserve source metadata and add canonical typed contracts only where justified            |
| Local `pnpm` runs under Node 16                    | Medium | Verify with direct local binaries or switch shell runtime to Node 20+ before release gates |

## Open Questions

- What threshold should mark the next TypeScript slice: `config` and
  `season-rules` conversion, or the builder/parser boundary first?
- Should true level 7 become the next lower-tier target, or should tier 5/6
  metadata cleanup and source-diff review happen first?
- Which `data/club-metadata-review.json` findings should become curated
  lifecycle/status rules before the next release?
