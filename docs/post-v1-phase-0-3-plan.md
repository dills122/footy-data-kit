# Post-V1 Phase 0-3 Plan

This plan defines the first post-v1 branch scope. It keeps TypeScript migration
and lower-tier expansion moving together while preserving the v1 dataset
contract and avoiding hand edits to generated `data-output/` files.

## Overview

The branch targets four connected phases:

1. Reset the post-v1 baseline.
2. Add TypeScript contract foundations for maintained Wikipedia data flow.
3. Lock tier 1-4 semantics before broader lower-tier expansion.
4. Prepare lower-tier backfill slices for tier 5 and level 6.

Generated data refreshes are intentionally out of scope until parser behavior,
typed contracts, and focused tests are in place.

## Completion Status

| Phase   | Status                                | Evidence                                                                                                                                                                                                 |
| ------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 0 | Complete                              | Roadmap and next-work docs now point at the post-v1 baseline and this plan.                                                                                                                              |
| Phase 1 | Complete for branch scope             | Shared TypeScript contracts exist for Wikipedia tier/config/parser boundaries, with output metadata aligned to those contracts.                                                                          |
| Phase 2 | Complete                              | Focused tests lock tier 1-4 boundaries, including 1921/1957 parallel level 3, 1958 true tier 4, 1992 renumbering, 2004 rebrand, and 2019 administrative outcomes.                                        |
| Phase 3 | Complete to parser-readiness boundary | Tests prove the parser/builder can represent tier 5 and level 6 when tables are present; representative dry runs show missing years require alternate lower-tier source pages before generated backfill. |

The branch deliberately leaves checked-in `data-output/` unchanged.

## Architecture Decisions

- Keep `wikipedia/` as the maintained ingestion path.
- Keep `tierN` as the actual pyramid level, with parallel leagues stored under
  `tierN.divisions[]`.
- Add typed boundaries before converting parser-heavy modules.
- Treat `rsssf/` as legacy comparison/archive tooling.
- Do not change checked-in generated output in phase 0-3 unless a later task
  explicitly targets regeneration.

## Phase 0: Baseline Reset

**Description:** Move planning from the pre-v1 release gate to the post-v1
implementation track and make local verification expectations explicit.

**Acceptance criteria:**

- [ ] Roadmap names `v1.0.0` as the current release.
- [ ] Next-work points at this branch plan.
- [ ] Runtime mismatch is documented if `pnpm` runs under Node older than 20.
- [ ] No generated `data-output/` files change.

**Verification:**

- [ ] `git diff -- docs/roadmap.md docs/next-work.md docs/post-v1-phase-0-3-plan.md`
- [ ] `node -p "process.version"`

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

- [ ] Maintained modules can import a shared type surface for tier keys,
      parallel groups, overview parsed tables, and league-level metadata.
- [ ] Existing output model types reuse or align with the shared contracts.
- [ ] TypeScript checking stays strict and passes.

**Verification:**

- [ ] `node_modules/.bin/tsc --noEmit`
- [ ] Focused Jest tests for any touched output normalizer or builder behavior.

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

- [ ] Tests prove `tier3.divisions[]` represents Third Division North/South from
      1921-1957.
- [ ] Tests prove true `tier4` starts in 1958.
- [ ] Tests prove 1992 and 2004 naming shifts do not change level semantics.
- [ ] Tests preserve 2019 administrative outcome behavior.

**Verification:**

- [ ] `node_modules/.bin/jest --runTestsByPath wikipedia/__tests__/parse-ext-season-overview-pages.test.js wikipedia/__tests__/wiki-overview-parser.test.js`
- [ ] `node_modules/.bin/jest --runTestsByPath wikipedia/__tests__/verify-football-data.test.js`

**Dependencies:** Phase 1 typed contracts where useful

**Files likely touched:**

- `wikipedia/__tests__/parse-ext-season-overview-pages.test.js`
- `wikipedia/__tests__/wiki-overview-parser.test.js`
- `wikipedia/__tests__/verify-football-data.test.js`

**Estimated scope:** Medium

## Phase 3: Lower-Tier Backfill Preparation

**Description:** Prepare parser/config/test slices for tier 5 and level 6
backfill without regenerating checked-in output.

**Recommended slice order:**

1. Backfill level 6 for `2012-2020`, because `tier5` already exists there.
2. Backfill `tier5` and level 6 for `2004-2011`.
3. Backfill `tier5` for `1979-2003`.
4. Defer true level 7 until tier 5 and level 6 are vetted.

**Acceptance criteria:**

- [ ] Tests document the expected parser/build behavior for each backfill slice.
- [ ] Any added config rules use shared constants and typed contracts.
- [ ] Representative dry-run findings are documented before generated output is refreshed.
- [ ] Checked-in `data-output/` files remain unchanged on this branch unless
      regeneration is explicitly approved later.
- [ ] Source-availability gaps are separated from parser/builder capability gaps.

**Verification:**

- [ ] Focused parser/builder Jest tests pass.
- [ ] `node_modules/.bin/tsc --noEmit`
- [ ] `git diff -- data-output` is empty.

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
| Parser changes silently alter generated data       | High   | Add tests first and defer regeneration to a dedicated slice                                |
| TypeScript conversion becomes a behavior rewrite   | Medium | Add typed boundaries before converting implementation-heavy files                          |
| Lower-tier labels are ambiguous on Wikipedia pages | Medium | Preserve source metadata and add canonical typed contracts only where justified            |
| Local `pnpm` runs under Node 16                    | Medium | Verify with direct local binaries or switch shell runtime to Node 20+ before release gates |

## Open Questions

- What threshold should mark phase 1 "enough TypeScript" for the next release:
  typed boundaries only, or conversion of `config` and `season-rules`?
- Should lower-tier regeneration happen on this branch after phase 3 tests land,
  or in a separate data-refresh branch?
- Which source path should own missing lower-tier tables when yearly overview
  pages omit them: per-competition Wikipedia season pages, a lower-tier overview
  source, or a curated fixture/import path?
