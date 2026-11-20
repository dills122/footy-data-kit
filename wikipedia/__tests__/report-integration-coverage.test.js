import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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

  test('adds lower-tier fixtures while counting shared season keys only once', () => {
    const report = buildIntegrationCoverageReport({
      dataset: { seasons: { 1979: {}, 1980: {}, 1981: {}, 1982: {} } },
      pages: [{ season: '1979', source: 'overview' }],
      lowerTierFixtures: [
        {
          year: 1979,
          tables: [
            ['national', 20, 'Example FC', 56, 'Bottom FC'],
            ['southern-midland', 22, 'Midland FC', 62, 'Last FC'],
          ],
        },
        { year: 1980, tables: [['south', 24, 'South FC', 66, 'Another FC']] },
        { year: 1980, tables: [['north', 22, 'North FC', 71, 'Northern FC']] },
      ],
    });

    expect(report.coveredSeasons).toEqual(['1979', '1980']);
    expect(report.coveredSeasonCount).toBe(2);
    expect(report.seasonCoveragePercent).toBe(50);
    expect(report.fixturePageCount).toBe(1);
    expect(report.lowerTier).toEqual({
      fixtureCount: 3,
      coveredSeasons: ['1979', '1980'],
      tableCounts: { tier5: 1, tier6: 3 },
    });
    expect(formatIntegrationCoverageReport(report)).toContain('Lower-tier fixtures: 3');
  });

  test('the CLI includes the lower-tier suite in the JSON report', () => {
    const script = fileURLToPath(
      new URL('../../scripts/report-integration-coverage.js', import.meta.url)
    );
    const stdout = execFileSync(process.execPath, [script, '--json'], { encoding: 'utf8' });
    const report = JSON.parse(stdout);

    expect(report.lowerTier.coveredSeasons).toEqual(
      expect.arrayContaining(['1979', '2014', '2015', '2025'])
    );
    expect(report.coveredSeasons).toEqual(expect.arrayContaining(['2014', '2015', '2025']));
    expect(report.coveredSeasons.filter((year) => year === '1979')).toHaveLength(1);
    expect(report.coveredSeasonCount).toBe(new Set(report.coveredSeasons).size);
  });
});
