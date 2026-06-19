# Next Work

Use [roadmap.md](/Users/dsteele/repos/footy-data-kit/docs/roadmap.md) as the current
release plan and source of truth.

## Active Focus

1. Run the v1 release-candidate gate on a clean branch: release dry-run data,
   generated diff review, docs check, lint, typecheck, unit tests, integration
   tests, and data verification.
2. Keep integration coverage above the 30-40% v1 floor while adding only
   targeted boundary depth for meaningful gaps found during release review.
3. Treat the v1 metadata audit as the consumer contract for current club
   metadata fields and document unresolved ambiguity instead of adding weak
   assertions.
4. Defer broad TypeScript migration until after v1 unless a typed contract or
   verifier boundary is needed to protect the release.

## Reference Notes

- [club-metadata-layer-2.md](/Users/dsteele/repos/footy-data-kit/docs/club-metadata-layer-2.md)
- [v1-metadata-audit.md](/Users/dsteele/repos/footy-data-kit/docs/v1-metadata-audit.md)
- [tier3-tier4-parser-readiness-plan.md](/Users/dsteele/repos/footy-data-kit/docs/tier3-tier4-parser-readiness-plan.md)
- [lower-tier-coverage-analysis.md](/Users/dsteele/repos/footy-data-kit/docs/lower-tier-coverage-analysis.md)
- [parallel-season-levels-contract.md](/Users/dsteele/repos/footy-data-kit/docs/parallel-season-levels-contract.md)
- [historical-overview-parsing.md](/Users/dsteele/repos/footy-data-kit/docs/historical-overview-parsing.md)
- [refactor-overview.md](/Users/dsteele/repos/footy-data-kit/docs/refactor-overview.md)
- [cloudflare-r2-release-archive-plan.md](/Users/dsteele/repos/footy-data-kit/docs/cloudflare-r2-release-archive-plan.md)
