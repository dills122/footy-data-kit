# Next Work

Use [roadmap.md](/Users/dsteele/repos/footy-data-kit/docs/roadmap.md) as the current
release plan and source of truth.

## Active Focus

1. Finish review and release preparation for the completed phase 0 through
   phase 3 branch in
   [post-v1-phase-0-3-plan.md](/Users/dsteele/repos/footy-data-kit/docs/post-v1-phase-0-3-plan.md).
2. Review the generated-output diff for the lower-tier backfill: tier 5 now
   covers 1979-2025 and level 6 now covers 2004-2025.
3. Continue TypeScript migration with the next implementation slice: convert
   shared config/season-rule boundaries or the parser/builder boundary before
   parser-heavy rewrites.
4. Decide whether the next data expansion target is true level 7, or a cleanup
   pass over tier 5/6 metadata and source-diff review.
5. Plan the club metadata sidecar expansion for lower-tier-only clubs before
   regenerating `data/club-metadata.json` from the expanded season dataset.

## Reference Notes

- [club-metadata-layer-2.md](/Users/dsteele/repos/footy-data-kit/docs/club-metadata-layer-2.md)
- [v1-metadata-audit.md](/Users/dsteele/repos/footy-data-kit/docs/v1-metadata-audit.md)
- [tier3-tier4-parser-readiness-plan.md](/Users/dsteele/repos/footy-data-kit/docs/tier3-tier4-parser-readiness-plan.md)
- [lower-tier-coverage-analysis.md](/Users/dsteele/repos/footy-data-kit/docs/lower-tier-coverage-analysis.md)
- [parallel-season-levels-contract.md](/Users/dsteele/repos/footy-data-kit/docs/parallel-season-levels-contract.md)
- [historical-overview-parsing.md](/Users/dsteele/repos/footy-data-kit/docs/historical-overview-parsing.md)
- [refactor-overview.md](/Users/dsteele/repos/footy-data-kit/docs/refactor-overview.md)
- [cloudflare-r2-release-archive-plan.md](/Users/dsteele/repos/footy-data-kit/docs/cloudflare-r2-release-archive-plan.md)
- [post-v1-phase-0-3-plan.md](/Users/dsteele/repos/footy-data-kit/docs/post-v1-phase-0-3-plan.md)
