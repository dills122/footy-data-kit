import {
  buildIntegrationCoverageReport,
  formatIntegrationCoverageReport,
} from '../../scripts/report-integration-coverage.js';

describe('report-integration-coverage', () => {
  test('counts unique season coverage, assertion coverage, sources, and tags', () => {
    const dataset = {
      seasons: {
        1900: {},
        1901: {},
        1902: {},
        1903: {},
      },
    };
    const pages = [
      {
        season: '1900',
        source: 'overview',
        coverage: ['first-tag'],
        tests: {
          promoted: ['Example FC'],
          relegated: ['Old FC'],
          tableEntries: [{ tier: 'tier1', data: { team: 'Example FC' } }],
          tierMetadataEntries: [{ tier: 'tier1', data: { leagueLevel: 1 } }],
        },
      },
      {
        season: '1900',
        source: 'both',
        coverage: ['first-tag', 'second-tag'],
        tests: {
          tableEntries: [{ tier: 'tier2', data: { team: 'Second FC' } }],
        },
      },
      {
        season: '1902',
        tests: {
          seasonInfo: { tableCount: 0, competitionStatus: 'abandoned-season' },
        },
      },
    ];

    const report = buildIntegrationCoverageReport({ pages, dataset });

    expect(report.coveredSeasonCount).toBe(2);
    expect(report.totalSeasonCount).toBe(4);
    expect(report.seasonCoveragePercent).toBe(50);
    expect(report.fixturePageCount).toBe(3);
    expect(report.sourceCounts).toEqual({ both: 1, overview: 1, promotion: 1 });
    expect(report.assertedTierCounts).toEqual({ tier1: 2, tier2: 1 });
    expect(report.assertionCounts).toEqual({
      transitionTeams: 2,
      tableRows: 2,
      tierMetadata: 1,
      seasonInfoFields: 2,
    });
    expect(report.coverageTags).toEqual({
      'first-tag': ['1900'],
      'second-tag': ['1900'],
    });
    expect(report.clubMetadata.fixtureClubCount).toBeGreaterThan(0);
    expect(report.clubMetadata.assertionCounts.observedRows).toBeGreaterThan(0);
  });

  test('formats a readable CLI report', () => {
    const output = formatIntegrationCoverageReport({
      totalSeasonCount: 4,
      coveredSeasonCount: 2,
      seasonCoveragePercent: 50,
      fixturePageCount: 2,
      sourceCounts: { overview: 2 },
      assertedTierCounts: { tier1: 2 },
      assertionCounts: {
        transitionTeams: 2,
        tableRows: 1,
        tierMetadata: 0,
        seasonInfoFields: 0,
      },
      coverageTags: { 'first-tag': ['1900', '1901'] },
      clubMetadata: {
        fixtureClubCount: 2,
        statusReasonCounts: { dissolved: 1, merged: 1 },
        relationshipCounts: { merger: 1 },
        assertionCounts: {
          lifecycleEvents: 2,
          relationships: 1,
          observedRows: 2,
        },
        coverageTags: { defunct: ['example fc'], merged: ['merged fc'] },
      },
    });

    expect(output).toContain('Season fixtures: 2/4 (50%)');
    expect(output).toContain('Source modes: overview: 2');
    expect(output).toContain('first-tag: 2 season(s) (1900, 1901)');
    expect(output).toContain('Fixture clubs: 2');
    expect(output).toContain('Status reasons: dissolved: 1, merged: 1');
    expect(output).toContain('defunct: 1 club(s) (example fc)');
  });
});
