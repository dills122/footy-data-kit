# Roadmap

This roadmap defines how `footy-data-kit` becomes source-of-truth worthy for its
stated scope: English football league tables generated from Wikipedia, validated
locally, and released as dependable static data files.

The product goal is data trust. The technical goal is TypeScript migration for
better type safety, parser quality, and safer release automation.

## Direction

Main goal:

- Harden and vet the generated data until we can confidently describe it as
  source-of-truth worthy for the supported coverage.

Technical goal:

- Convert the maintained pipeline to TypeScript in controlled slices so data
  contracts, parser outputs, metadata, and verification code are checked by the
  compiler as well as by tests.

Operating principles:

- Prefer `wikipedia/` for active ingestion work.
- Treat `rsssf/` as legacy unless a task explicitly targets archive comparison.
- Do not hand-edit generated `data-output/` files except intentional fixture
  repair.
- Keep output semantics stable unless a release explicitly documents the change.
- Add verification before broadening coverage.
- Convert code to TypeScript without behavior rewrites unless tests and release
  diffs prove the behavior change is intended.

## Current Baseline

Current release:

- `v0.9.0`

Current state:

- The overview scraper is the maintained dataset path.
- Release automation can rebuild data, generate release diffs, generate release
  notes, publish assets, and deploy docs.
- JSON Schema contracts exist for the season dataset and club metadata sidecar.
- Data verification checks schema shape, table consistency, club continuity, and
  historical club-reason coverage.
- Integration coverage is at the v1 floor at 43 of 138 season records, or 31.2%,
  but it still needs targeted boundary depth before v1.
- TypeScript is present but partial: the repo has strict TS settings and a small
  number of `.ts` model/normalizer files, while most pipeline, parser, verifier,
  and test code is still JavaScript.
- Club metadata is useful but needs a deliberate audit: what is generated, what
  is source-backed, what is missing, and what should wait for later layers.

## V0.9.1: Data Label Correctness And V1 Prep

Purpose:

- Correct consumer-visible labels and row flags in the existing dataset before
  the v1 readiness release.

Scope:

- Keep the `tierN` parallel-league contract stable.
- Fix generated row flags where reprieve notes were not reflected by
  `wasReprieved`.
- Replace generic overview tier titles such as `League tables` with canonical
  season/level labels while preserving source `leagueId` metadata.
- Add verifier coverage for reprieve note/flag mismatches.
- Update release notes, docs, and generated output in one reviewable slice.

Non-goals:

- Do not backfill tier 5 or level 6 coverage.
- Do not redesign restructure semantics for 1957-58 beyond documenting the
  remaining decision.
- Do not change the published schema shape.

## Release Tracks

Every planned release should advance both tracks unless the release notes explain
why one was intentionally deferred.

| Track       | Goal                                                                                    | Evidence                                                                                                |
| ----------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Data trust  | Consumers can understand what changed, what was verified, and where known limits remain | release diff, release notes, schema validation, data verification, integration fixtures, metadata audit |
| Type safety | Core data contracts and pipeline behavior are protected by TypeScript                   | typed models, typed config, typed parser boundaries, strict typecheck, fewer unchecked JS modules       |
| Coverage    | More seasons and league structures are tested directly                                  | integration coverage by season, boundary fixtures, weird-case matrix                                    |
| Metadata    | Club and league metadata are clear enough for consumers to use safely                   | metadata inventory, source-backed fields, generated-field boundaries, documented gaps                   |

## V1: Source-Of-Truth Readiness

Purpose:

- Make the current dataset release process trustworthy enough to call v1 stable
  for the supported scope.

What v1 is not:

- It is not a full lower-tier expansion release.
- It is not a complete TypeScript migration.
- It is not the release where every club-history fact is researched.
- It is not a schema redesign.

### V1 Feature Scope

Release notes:

- Release notes describe changes in plain English, not only raw diffs.
- Notes separate generated-data changes, schema changes, metadata changes,
  parser changes, and known limitations.
- Notes call out material season/tier changes with enough context for consumers
  to review them.
- Machine-readable and markdown release diffs remain attached to releases.

Safe releases:

- Release workflow rebuilds from source, verifies generated data, minifies
  assets, creates diffs, builds release notes, publishes the release zip, and
  deploys docs.
- Pre-release review includes a generated-data diff and a short human summary of
  why the diff is expected.
- Releases fail closed when schema verification, data verification, docs, lint,
  typecheck, unit tests, or integration tests fail.

Data vetting:

- Verification covers schema validity, table ordering, duplicate teams, stat
  sanity, promotion/relegation consistency, tier metadata, expected war gaps,
  club continuity, and source metadata presence.
- Known historical exceptions are represented as explicit rules or documented
  limitations, not broad verifier tolerance.
- A repeatable audit checklist exists for reviewing generated `all-seasons.json`,
  overview output, club metadata, and release diffs before tagging.

Integration coverage:

- Integration tests cover 30-40% of seasons in some meaningful respect.
- Coverage is counted by unique season keys with at least one integration
  assertion, saved fixture, or source-selection check.
- With the current 138-season dataset, that means roughly 42-55 seasons.
- Coverage prioritizes structural variety over evenly spaced sampling.
- Required categories include early Football League seasons, Football Alliance
  seasons, war boundaries, Third Division North/South, 1958 restructure, Premier
  League renaming, 2004 EFL rebrand, COVID/PPG seasons, and modern lower-tier
  parallel leagues.

Metadata audit:

- Document what current club metadata fields mean and where they come from.
- Classify fields as generated observation, source-backed history, curated
  override, or derived status.
- Identify high-value missing metadata for later releases, especially club
  identity, league identity, historical absences, phoenix/reformed clubs, and
  lower-tier league levels.
- Decide what metadata is v1-stable and what is explicitly experimental or
  incomplete.

TypeScript:

- Establish the TypeScript migration plan and order of conversion.
- Keep strict `tsconfig` settings.
- Type the core data contracts and release/data verification boundaries first.
- Avoid broad parser rewrites during v1 unless they are required to make
  verification trustworthy.

### V1 Definition Of Done

- Release notes produce a readable English summary of what changed.
- Release notes include generated facts: season count, coverage range, club
  metadata count, validation status, release assets, and compact diff summary.
- Release workflow is safe and reliable on a clean tag.
- `pnpm test` passes.
- `pnpm test:integration` passes.
- `pnpm typecheck` passes.
- `pnpm lint` passes.
- `pnpm format:check` passes.
- `pnpm docs:check` passes.
- `pnpm -s verify:data` passes.
- Integration coverage reaches 30-40% of seasons.
- A metadata audit document exists and is linked from the roadmap or README.
- Known data limitations are documented in release notes or docs.
- No generated data diff is released without human review.

## V1.1: Tier 4 Hardening And TypeScript Progress

Purpose:

- Harden lower tiers through tier 4 while making visible progress on TypeScript
  migration.

### V1.1 Feature Scope

Tier 1-4 data hardening:

- Treat tier 1 through tier 4 as the main supported depth for this release.
- Confirm `tierN` keys represent actual pyramid levels.
- Lock the Third Division North/South model under `tier3.divisions[]` before 1958.
- Confirm true level 4 begins in 1958.
- Verify 1992 naming shifts and 2004 EFL rebrand behavior.
- Add explicit handling or documentation for 1957-58 restructure movement.
- Add explicit handling or documentation for 2019-20 COVID/PPG and
  Bury/Macclesfield-style administrative cases.

Tier 5 discussion:

- Light planning only.
- Identify what needs to be true before tier 5 can be called vetted.
- Avoid promoting tier 5 to stable support until parser identity, league levels,
  and fixtures are strong enough.

TypeScript:

- Convert shared config, season rules, data models, and verification utilities
  before parser-heavy modules.
- Add typed return shapes for parser boundaries where the JS parser remains.
- Keep CLI entry points thin and compatible.

### V1.1 Definition Of Done

- Tier 1-4 semantics are documented and covered by tests.
- Boundary fixtures cover at least 1920, 1921, 1957, 1958, 1992, 2004, and 2019.
- Verifier checks enforce `tierN` and `metadata.leagueLevel` consistency.
- Tier 5 readiness notes exist, but tier 5 is not overclaimed.
- Meaningful TypeScript progress is visible in core data/config/verifier modules.
- `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, and
  `pnpm -s verify:data` pass.

## V1.2: Tier 5/6 Vetting, Weird Cases, And Coverage Maturity

Purpose:

- Bring tier 5 and level 6 data into good order, cover weird cases thoroughly,
  and raise automated test confidence.

### V1.2 Feature Scope

Tier 5/6 data:

- Vet tier 5 and level 6 coverage, league identity, league levels, source
  metadata, table ordering, and promotion/relegation semantics.
- Backfill or repair coverage only after verifier rules and fixtures are ready.
- Keep modern parallel leagues under their actual level with `divisions[]`.
- Document remaining level 7 limitations if level 7 is still out of stable
  scope.

Weird-case integration coverage:

- Integration tests cover all known weird structural categories.
- A larger portion of seasons and leagues is covered than v1; target the majority
  of structurally important eras before chasing blanket year-by-year coverage.
- Season matrix includes early era, election era, war boundaries, North/South
  parallel divisions, restructure years, naming changes, playoff introduction,
  insolvency/expulsion cases, COVID/PPG, tier 5, and level 6 parallel leagues.

Test coverage:

- Jest coverage target is at least 95% for maintained code.
- Any excluded legacy or generated files are explicitly documented in Jest
  coverage settings.
- Coverage target should not encourage shallow tests; behavior and data
  assertions remain more important than line counting.

TypeScript:

- Convert the bulk of maintained `wikipedia/` data, config, and verification
  modules.
- Parser modules should have typed boundaries even where implementation details
  remain JavaScript.
- New maintained modules should be TypeScript by default unless there is a clear
  reason not to.

### V1.2 Definition Of Done

- Tier 5 and level 6 are vetted and documented as stable for the supported
  seasons.
- Integration tests cover all known weird cases.
- Integration tests cover a large portion of seasons and leagues, with a clear
  season matrix.
- Jest coverage for maintained code is at least 95%.
- TypeScript migration has covered the main data contract, verification, config,
  and output-normalization paths.
- `pnpm test:coverage`, `pnpm test:integration`, `pnpm typecheck`, and
  `pnpm -s verify:data` pass.

## Post-V1.2 Candidates

These are important, but they should wait until data trust, lower-tier vetting,
and TypeScript migration are stronger.

- Row-level `clubId` embedding in season table rows.
- Source-backed club history override layer for deeper lifecycle facts.
- Stable `canonicalLeagueId` or `leagueGroup` metadata.
- Metadata-only wartime and abandoned-season records.
- True level 7 support.
- Richer distinction between table markers, final administrative outcomes, and
  restructure placements.

Definition of ready:

- Schema impact is written down.
- Migration notes exist for consumers.
- Compatibility behavior is defined before implementation.
- Fixtures show before/after behavior for representative seasons.

## Integration Coverage Targets

Coverage should be measured by unique season keys with meaningful assertions,
not by number of scraped pages.

| Milestone | Target                                                       | Current dataset equivalent                |
| --------- | ------------------------------------------------------------ | ----------------------------------------- |
| V1        | 30-40% of seasons                                            | About 42-55 of 138 seasons                |
| V1.1      | All tier 1-4 structural boundaries plus broader era sampling | Exact count depends on boundary matrix    |
| V1.2      | Large portion of seasons and leagues, all known weird cases  | Count should be reported in release notes |

Required categories:

- 1888 start of the Football League.
- 1890-1892 Football Alliance and election-era movement.
- WWI and WWII boundaries.
- 1921 Third Division North/South split.
- 1957-58 regional-to-national restructure.
- 1986-87 playoff and Conference boundary.
- 1991-94 reduced fourth-tier sizes.
- 1992 Premier League naming shift.
- 2004 EFL rebrand.
- 2019-20 COVID/PPG and administrative outcomes.
- 2021+ modern lower-tier parallel leagues.

## TypeScript Migration Order

1. Shared data contracts and output models.
2. Config and season rules.
3. Data verification and schema verification.
4. Release diff and release-note generation.
5. Dataset persistence and output normalization.
6. Parser boundary types.
7. Parser implementations.
8. CLI entry points after core behavior is typed.
9. Tests and integration config where typing helps maintainability.

Migration rules:

- Keep each conversion small enough to review.
- Run focused tests for every converted area.
- Do not combine mechanical conversion with parser behavior changes.
- Prefer typed functions and explicit return shapes over broad `any`.
- Leave legacy RSSSF code alone unless needed for comparison.

## Data Vetting Techniques

Automated checks:

- JSON Schema validation.
- Table row ordering and points sanity.
- Duplicate team detection.
- Promotion/relegation consistency.
- `tierN` and `metadata.leagueLevel` consistency.
- Expected war-year handling.
- Club continuity and historical absence checks.
- Source metadata presence.
- Release diff generation.

Human review:

- Review release diff summary before tagging.
- Spot-check representative changed seasons against source pages.
- Review any changed promotion/relegation arrays.
- Review metadata additions for source quality and consumer meaning.
- Document unresolved ambiguity instead of guessing.

Future checks to consider:

- Fixture snapshots for representative source HTML.
- Cross-source comparison against legacy CSV/RSSSF data for selected seasons.
- Row-count expectation rules by league era.
- League identity checks independent from display title.
- Coverage reporting for integration season matrix.

## Open Decisions

- What exact integration coverage counting script or report should define the
  30-40% v1 target?
- Which current metadata fields are v1-stable versus experimental?
- Is row-level `clubId` a v2 schema change or a v1.x additive field?
- How should 1957-58 restructure placement be represented?
- Should 2019-20 relegation arrays represent table markers, final administrative
  outcomes, or both?
- What should the minimum TypeScript conversion threshold be for v1.1 and v1.2?
- Which files should count toward the 95% maintained-code coverage target?

## Source Planning Docs

Use these as detailed references for implementation slices:

- `docs/club-metadata-layer-2.md`
- `docs/tier3-tier4-parser-readiness-plan.md`
- `docs/lower-tier-coverage-analysis.md`
- `docs/historical-overview-parsing.md`
- `docs/refactor-overview.md`
- `docs/rsssf-legacy.md`
