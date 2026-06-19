# V1 Metadata Audit

This document defines how to read the current club metadata sidecar for v1.
It is a release-readiness contract, not a claim that every historical club fact
has been researched.

## Files

- `data-output/all-seasons.json` is the generated season dataset.
- `data/club-metadata.json` is the generated club metadata sidecar.
- `schemas/club-metadata.schema.json` defines the sidecar shape.

Do not hand-edit generated output to fix metadata. Fix parser rules, shared
configuration, or source-backed overrides, then rebuild the generated files.

## Field Classes

Generated observations:

- `trackedFromSeason` and `trackedToSeason` are observed coverage bounds in the
  generated table data. They are not founded, dissolved, admitted, or expelled
  dates.
- `history.trackedMembership` is generated as observed stints in the maintained
  season dataset. It is not a claim that the club existed continuously between
  separate stints.
- `history.absenceExplanations` is generated from expected pauses, table notes,
  and continuity rules.
- `hasUnexplainedGaps` means expected tracked membership has an internal absence
  that is not currently explained by known war years, notes, or configured
  reasons. Ordinary gaps between observed lower-tier stints remain visible in
  `derived.coverageGaps`.

Curated or source-backed history:

- `history.lifecycleEvents` may include source-backed lifecycle events such as
  liquidation, resignation, failed re-election, merger, expulsion, or re-formed
  club notes.
- `sourceRefs` should point to the source used for any curated historical claim.

Derived metadata:

- `status.current` is the current high-level lifecycle/status label for the
  metadata record. It is not a row-level league outcome.
- `status.reason: "below-tracked-coverage"` means the club is treated as active
  but currently below the supported generated league coverage.
- `derived.*` fields are generated aids for consumers and audits. Treat them as
  helpful observations, not as legal-entity proof.
- `derived.relationships` can express lineage or identity guidance where the
  source data spans predecessor, successor, phoenix, or renamed clubs.

Row-level season outcomes:

- Administrative outcomes inside a season belong on table rows, primarily via
  `outcomeStatus`.
- Examples include expulsion, resignation, failed re-election, liquidation,
  merger, abandonment, and points-deduction context.
- Do not use `status.current` to infer what happened to a club in a specific
  season row.

## V1 Stable Contract

The following semantics are stable enough for v1 consumers:

- The sidecar is keyed by `clubId`.
- `canonicalName` is the display name used for the metadata record.
- `trackedFromSeason` and `trackedToSeason` describe observed generated coverage.
- `status.current` is a current/high-level metadata status, separate from
  row-level outcomes.
- `history.trackedMembership`, `history.absenceExplanations`, and
  `history.lifecycleEvents` are arrays with explicit season/source context where
  applicable.
- `sourceRefs` identifies source material for curated historical claims.
- Schema validation is part of the release gate.

## V1 Caution Areas

These are intentionally not treated as complete or exhaustive in v1:

- Legal-entity identity across every re-formed, renamed, relocated, or phoenix
  club.
- Full historical lifecycle coverage for all clubs outside the maintained table
  data.
- Exhaustive lower-tier status, especially where tier 5 and tier 6 source pages
  are incomplete or structurally inconsistent.
- Club-level histories that require specialist sources beyond the maintained
  Wikipedia table scope.
- `derived.relationships` as legal proof of continuity. Use it as a navigation
  and audit aid only.

## Lineage Watchlist

The following records are meaningful v1 review targets because their public
history can span predecessor, successor, phoenix, relocation, or dissolved-club
semantics:

- Bradford Park Avenue
- Merthyr Town
- Farsley Celtic / Farsley
- Darlington
- Gateshead / South Shields
- Accrington Stanley
- Maidstone United
- Newport County
- Wimbledon / AFC Wimbledon / Milton Keynes Dons

For v1, the goal is to avoid false precision. If a lineage relationship is not
source-backed and represented clearly, document the limitation instead of
guessing.

## Release Review Checklist

Before tagging v1:

- Run the release dry-run data build and confirm completeness reports the
  expected season count and non-zero club metadata count.
- Run schema verification for `all-seasons.json`, minified season output,
  overview output, minified overview output, and `club-metadata.json`.
- Run data verification and club continuity verification with historical
  reasons enabled.
- Review the generated release diff for season rows with `outcomeStatus`,
  promotion/relegation labels, tier metadata, and club metadata changes.
- Spot-check any changed lineage-watchlist club against the cited source.
- Document unresolved ambiguity in release notes rather than encoding a weak
  assertion.
