# Next Work

Use [roadmap.md](/Users/dsteele/repos/footy-data-kit/docs/roadmap.md) as the current
release plan and source of truth.

## Active Focus

1. Review the production dependency advisories on the Wikipedia ingestion path
   and test compatible updates. See [issue #67](https://github.com/dills122/footy-data-kit/issues/67).
2. Vet generated tier 5 and level 6 tables against their competition pages.
   Start with the 1979–82 Southern League split, the 2004 pyramid restructure,
   and the latest covered season. Add assertions for gaps found in that pass.
3. Continue TypeScript migration at the shared config/season-rule or
   parser/builder boundary. Use the coverage baseline below to pick focused
   regression cases.
4. Confirm `data/club-metadata-review.json` remains clean after the next data
   refresh, then convert any new lower-tier manual review findings into curated
   lifecycle/status rules.
5. Track confirmed or suspected upstream Wikipedia defects in
   [wikipedia-source-issues.md](/Users/dsteele/repos/footy-data-kit/docs/wikipedia-source-issues.md)
   before adding local workarounds.

## Coverage Baseline

On the November 19, 2026 readiness pass, `pnpm test:coverage --runInBand`
passed 247 tests across 26 suites. The current Jest configuration measured
61.75% statements, 55.35% branches, 68.76% functions, and 63.54% lines.
This includes scripts and CLI files covered by the Jest collection rules.

| Maintained module                               | Statements | Branches |
| ----------------------------------------------- | ---------: | -------: |
| `wikipedia/data/verify-json-schemas.js`         |      38.7% |    17.1% |
| `wikipedia/data/verify-club-continuity.js`      |      79.7% |    56.4% |
| `wikipedia/parser-core/wiki-overview-parser.js` |      74.0% |    67.3% |
| `wikipedia/data/season-rules.js`                |      77.1% |    71.3% |

`pnpm integration:coverage` reports 55 of 138 seasons (39.9%) across the
overview, promotion, and lower-tier suites. The 11 lower-tier fixtures cover
43 tables and add six unique seasons. The report also tracks 10 club metadata
fixtures.

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
