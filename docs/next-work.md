# Next Work

Use [roadmap.md](/Users/dsteele/repos/footy-data-kit/docs/roadmap.md) as the current
release plan and source of truth.

## Active Focus

1. Open and merge the `v1.1.0` pre-release branch after CI passes. The sidecar
   now includes crest candidate bundles, restricted-license backups, curated
   official/Wikimedia candidates, and generated placeholders for researched
   clubs with no usable crest source.
2. Treat the current club asset review baseline as expected unless new source
   evidence appears: one true `needs-more-research` club (`Hounslow`), three
   quality-review candidates (`Bridgend Town`, `Bromsgrove Rovers`,
   `Solihull Borough`), and high-volume restricted-license club marks.
3. Use the completed release-readiness pass in
   [next-release-data-review.md](/Users/dsteele/repos/footy-data-kit/docs/next-release-data-review.md)
   as the current release-note source pass.
4. Continue TypeScript migration with the next implementation slice: convert
   shared config/season-rule boundaries or the parser/builder boundary before
   parser-heavy rewrites.
5. Decide whether the next data expansion target is true level 7, or a source
   spot-check pass over the now-complete tier 5/6 coverage.
6. Confirm `data/club-metadata-review.json` remains clean after the next data
   refresh, then convert any new lower-tier manual review findings into curated
   lifecycle/status rules.
7. Treat
   [pre-2004-tier6-source-spike.md](/Users/dsteele/repos/footy-data-kit/docs/pre-2004-tier6-source-spike.md)
   as the completed source-availability input for the pre-2004 feeder-league
   backfill.
8. Track confirmed or suspected upstream Wikipedia defects in
   [wikipedia-source-issues.md](/Users/dsteele/repos/footy-data-kit/docs/wikipedia-source-issues.md)
   before adding local workarounds.

## Reference Notes

- [club-metadata-layer-2.md](/Users/dsteele/repos/footy-data-kit/docs/club-metadata-layer-2.md)
- [v1-metadata-audit.md](/Users/dsteele/repos/footy-data-kit/docs/v1-metadata-audit.md)
- [tier3-tier4-parser-readiness-plan.md](/Users/dsteele/repos/footy-data-kit/docs/tier3-tier4-parser-readiness-plan.md)
- [lower-tier-coverage-analysis.md](/Users/dsteele/repos/footy-data-kit/docs/lower-tier-coverage-analysis.md)
- [pre-2004-tier6-source-spike.md](/Users/dsteele/repos/footy-data-kit/docs/pre-2004-tier6-source-spike.md)
- [wikipedia-source-issues.md](/Users/dsteele/repos/footy-data-kit/docs/wikipedia-source-issues.md)
- [parallel-season-levels-contract.md](/Users/dsteele/repos/footy-data-kit/docs/parallel-season-levels-contract.md)
- [historical-overview-parsing.md](/Users/dsteele/repos/footy-data-kit/docs/historical-overview-parsing.md)
- [refactor-overview.md](/Users/dsteele/repos/footy-data-kit/docs/refactor-overview.md)
- [cloudflare-r2-release-archive-plan.md](/Users/dsteele/repos/footy-data-kit/docs/cloudflare-r2-release-archive-plan.md)
- [jsonhero-release-links.md](/Users/dsteele/repos/footy-data-kit/docs/jsonhero-release-links.md)
- [post-v1-phase-0-3-plan.md](/Users/dsteele/repos/footy-data-kit/docs/post-v1-phase-0-3-plan.md)
- [next-release-data-review.md](/Users/dsteele/repos/footy-data-kit/docs/next-release-data-review.md)
