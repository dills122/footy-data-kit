# Next Work

Temporary working note for the next phase after the clean dataset release.

## In Scope

1. Release diffs

   - Add a tool that compares two FootballData exports and reports what changed.
   - Focus on season-level additions/removals plus tier table, promotion/relegation, and metadata changes.
   - Keep the output suitable for release notes and regression review.

2. Team name reconciliation

   - Expand canonical club-name handling beyond the current minimal alias set.
   - Cover historical rename and spelling variants that affect continuity checks and dataset diffs.
   - Add tests around canonicalisation so future cleanup work is less manual.

3. Regression fixture growth

   - Keep the current Jest + saved-dataset integration approach.
   - Expand the curated edge-case seasons instead of replacing the existing model.
   - Prioritise brittle formats: restructures, rename-heavy seasons, and odd table layouts.

4. Historical overview expansion
   - Continue the pre-modern Wikipedia overview work in [historical-overview-parsing.md](/Users/dsteele/repos/footy-data-kit/docs/historical-overview-parsing.md).
   - Prioritise `1900–1905`, `1919–1921`, and then the `1921+` Third Division North/South split.
   - Keep wartime seasons non-canonical by default; if added later, prefer metadata-only placeholder records behind an explicit option.

## Notes

- Avoid broad pipeline rewrites while the current flow is stable.
- Prefer additive tooling that improves release confidence and future cleanup speed.
