import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyzeDataset, analyzeFile, expandTargets } from '../data/verify-football-data.js';

describe('verify-football-data', () => {
  const tmpDirs = [];

  afterEach(() => {
    while (tmpDirs.length) {
      fs.rmSync(tmpDirs.pop(), { recursive: true, force: true });
    }
  });

  test('expandTargets recursively finds nested json files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-footy-data-'));
    tmpDirs.push(tmpDir);

    const nestedDir = path.join(tmpDir, 'rsssf');
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'root.json'), JSON.stringify({ seasons: {} }));
    fs.writeFileSync(path.join(nestedDir, 'nested.json'), JSON.stringify({ seasons: {} }));
    fs.writeFileSync(path.join(nestedDir, 'notes.txt'), 'ignore me');

    const files = expandTargets([tmpDir]);

    expect(files).toEqual([path.join(tmpDir, 'root.json'), path.join(nestedDir, 'nested.json')]);
  });

  test('analyzeFile reports duplicate rows in nested-compatible football data exports', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-footy-data-'));
    tmpDirs.push(tmpDir);

    const filePath = path.join(tmpDir, 'data.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          seasons: {
            2001: {
              tier1: {
                season: 2001,
                table: [
                  {
                    pos: 1,
                    team: 'Alpha FC',
                    played: 10,
                    won: 7,
                    drawn: 2,
                    lost: 1,
                    goalsFor: 20,
                    goalsAgainst: 9,
                    goalDifference: 11,
                    goalAverage: null,
                    points: 23,
                  },
                  {
                    pos: 1,
                    team: 'Alpha FC',
                    played: 10,
                    won: 6,
                    drawn: 3,
                    lost: 1,
                    goalsFor: 18,
                    goalsAgainst: 8,
                    goalDifference: 10,
                    goalAverage: null,
                    points: 21,
                  },
                ],
                promoted: [],
                relegated: [],
              },
            },
          },
        },
        null,
        2
      )
    );

    const report = analyzeFile(filePath);
    const issueTypes = report.issues.map((issue) => issue.type);

    expect(issueTypes).toContain('duplicate-teams');
    expect(issueTypes).toContain('duplicate-positions');
  });

  test('analyzeDataset reports table rows that are out of points order', () => {
    const issues = analyzeDataset({
      metadata: {
        schemaVersion: 1,
        generator: 'wikipedia-overview',
        generatedAt: '2026-06-18T00:00:00.000Z',
      },
      seasons: {
        2024: {
          seasonInfo: {
            season: 2024,
            table: [],
            promoted: [],
            relegated: [],
          },
          tier3: {
            season: 2024,
            table: [
              {
                pos: 21,
                team: 'Example Safe',
                played: 46,
                won: 11,
                drawn: 11,
                lost: 24,
                goalsFor: 45,
                goalsAgainst: 70,
                goalDifference: -25,
                goalAverage: null,
                points: 44,
                notes: null,
                wasRelegated: false,
                wasPromoted: false,
                isExpansionTeam: false,
                wasReElected: false,
                wasReprieved: false,
              },
              {
                pos: 22,
                team: 'Rotherham United',
                played: 46,
                won: 10,
                drawn: 11,
                lost: 25,
                goalsFor: 41,
                goalsAgainst: 71,
                goalDifference: -30,
                goalAverage: null,
                points: 41,
                notes: 'Relegation to EFL League Two',
                wasRelegated: true,
                wasPromoted: false,
                isExpansionTeam: false,
                wasReElected: false,
                wasReprieved: false,
              },
              {
                pos: 23,
                team: 'Port Vale',
                played: 46,
                won: 10,
                drawn: 12,
                lost: 24,
                goalsFor: 36,
                goalsAgainst: 61,
                goalDifference: -25,
                goalAverage: null,
                points: 42,
                notes: 'Relegation to EFL League Two',
                wasRelegated: true,
                wasPromoted: false,
                isExpansionTeam: false,
                wasReElected: false,
                wasReprieved: false,
              },
            ],
            promoted: [],
            relegated: ['Rotherham United', 'Port Vale'],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '2024-25',
              sourceUrl: 'https://example.com/2024',
              tierKey: 'tier3',
              title: 'League One',
              leagueId: 'League_One',
              tableIndex: 2,
              tableCount: 7,
            },
          },
        },
      },
    });

    const tableOrderIssue = issues.find((issue) => issue.type === 'table-order-mismatch');
    expect(tableOrderIssue).toBeDefined();
    expect(tableOrderIssue.message).toContain(
      'Port Vale (42 pts, pos 23) should not be below Rotherham United (41 pts, pos 22)'
    );
  });

  test('analyzeDataset reports reprieve notes without reprieved row flags', () => {
    const issues = analyzeDataset({
      metadata: {
        schemaVersion: 1,
        generator: 'wikipedia-overview',
        generatedAt: '2026-06-18T00:00:00.000Z',
      },
      seasons: {
        1994: {
          seasonInfo: {
            season: 1994,
            table: [],
            promoted: [],
            relegated: [],
          },
          tier4: {
            season: 1994,
            table: [
              {
                pos: 22,
                team: 'Exeter City',
                played: 42,
                won: 8,
                drawn: 10,
                lost: 24,
                goalsFor: 40,
                goalsAgainst: 72,
                goalDifference: -32,
                goalAverage: null,
                points: 34,
                notes: 'Reprieved from relegation',
                wasRelegated: true,
                wasPromoted: false,
                isExpansionTeam: false,
                wasReElected: false,
                wasReprieved: false,
              },
            ],
            promoted: [],
            relegated: ['Exeter City'],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '1994-95',
              sourceUrl: 'https://example.com/1994',
              tierKey: 'tier4',
              title: 'Third Division',
              leagueId: 'Third_Division',
              leagueLevel: 4,
              tableIndex: 3,
              tableCount: 4,
            },
          },
        },
      },
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'reprieved-flag-mismatch',
          season: '1994',
          tier: 'tier4',
        }),
      ])
    );
  });

  test('analyzeDataset allows 2019 curtailed leagues ordered by points per game', () => {
    const issues = analyzeDataset({
      metadata: {
        schemaVersion: 1,
        generator: 'wikipedia-overview',
        generatedAt: '2026-06-18T00:00:00.000Z',
      },
      seasons: {
        2019: {
          seasonInfo: {
            season: 2019,
            table: [],
            promoted: [],
            relegated: [],
          },
          tier3: {
            season: 2019,
            table: [
              {
                pos: 3,
                team: 'Wycombe Wanderers',
                played: 34,
                won: 17,
                drawn: 8,
                lost: 9,
                goalsFor: 45,
                goalsAgainst: 40,
                goalDifference: 5,
                goalAverage: null,
                points: 59,
                notes: 'Qualification for League One play-offs',
                wasRelegated: false,
                wasPromoted: true,
                isExpansionTeam: false,
                wasReElected: false,
                wasReprieved: false,
              },
              {
                pos: 4,
                team: 'Oxford United',
                played: 35,
                won: 17,
                drawn: 9,
                lost: 9,
                goalsFor: 61,
                goalsAgainst: 37,
                goalDifference: 24,
                goalAverage: null,
                points: 60,
                notes: 'Qualification for League One play-offs',
                wasRelegated: false,
                wasPromoted: false,
                isExpansionTeam: false,
                wasReElected: false,
                wasReprieved: false,
              },
            ],
            promoted: [],
            relegated: [],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '2019-20',
              sourceUrl: 'https://example.com/2019',
              tierKey: 'tier3',
              title: 'League One',
              leagueId: 'League_One',
              tableIndex: 2,
              tableCount: 5,
            },
          },
        },
      },
    });

    expect(issues.find((issue) => issue.type === 'table-order-mismatch')).toBeUndefined();
  });

  test('analyzeDataset allows the tracked 2025 League One source-order anomaly', () => {
    const issues = analyzeDataset({
      metadata: {
        schemaVersion: 1,
        generator: 'wikipedia-overview',
        generatedAt: '2026-06-18T00:00:00.000Z',
      },
      seasons: {
        2025: {
          seasonInfo: {
            season: 2025,
            table: [],
            promoted: [],
            relegated: [],
          },
          tier3: {
            season: 2025,
            table: [
              {
                pos: 22,
                team: 'Rotherham United',
                played: 46,
                won: 10,
                drawn: 11,
                lost: 25,
                goalsFor: 41,
                goalsAgainst: 71,
                goalDifference: -30,
                goalAverage: null,
                points: 41,
                notes: 'Relegation to EFL League Two',
                wasRelegated: true,
                wasPromoted: false,
                isExpansionTeam: false,
                wasReElected: false,
                wasReprieved: false,
              },
              {
                pos: 23,
                team: 'Port Vale',
                played: 46,
                won: 10,
                drawn: 12,
                lost: 24,
                goalsFor: 36,
                goalsAgainst: 61,
                goalDifference: -25,
                goalAverage: null,
                points: 42,
                notes: 'Relegation to EFL League Two',
                wasRelegated: true,
                wasPromoted: false,
                isExpansionTeam: false,
                wasReElected: false,
                wasReprieved: false,
              },
            ],
            promoted: [],
            relegated: ['Rotherham United', 'Port Vale'],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '2025-26',
              sourceUrl: 'https://example.com/2025',
              tierKey: 'tier3',
              title: 'League One',
              leagueId: 'League_One',
              tableIndex: 2,
              tableCount: 7,
            },
          },
        },
      },
    });

    expect(issues.find((issue) => issue.type === 'table-order-mismatch')).toBeUndefined();
  });

  test('analyzeDataset reports tier contract and football-context issues', () => {
    const issues = analyzeDataset({
      seasons: {
        2001: {
          seasonInfo: {
            season: 2001,
            table: [{ bogus: true }],
            promoted: ['Alpha FC'],
            relegated: ['Legacy Town'],
            seasonSlug: '2001-02',
            sourceUrl: 'https://example.com/2001',
            tableCount: 2,
          },
          tier1: {
            season: 2001,
            table: [
              {
                pos: 1,
                team: 'Alpha FC',
                played: 10,
                won: 7,
                drawn: 2,
                lost: 1,
                goalsFor: 20,
                goalsAgainst: 9,
                goalDifference: 11,
                goalAverage: null,
                points: 23,
                notes: null,
                wasRelegated: false,
                wasPromoted: true,
                isExpansionTeam: false,
                wasReElected: false,
                wasReprieved: false,
              },
              {
                pos: 3,
                team: 'Beta FC',
                played: 10,
                won: 5,
                drawn: 3,
                lost: 2,
                goalsFor: 15,
                goalsAgainst: 10,
                goalDifference: 5,
                goalAverage: null,
                points: 18,
                notes: null,
                wasRelegated: false,
                wasPromoted: false,
                isExpansionTeam: false,
                wasReElected: false,
                wasReprieved: false,
              },
            ],
            promoted: ['Alpha FC'],
            relegated: [],
            seasonSlug: 'legacy-field',
            metadata: {
              source: 'wikipedia-promotion',
              seasonSlug: '2001-02',
            },
          },
        },
        2002: {
          seasonInfo: {
            season: 2002,
            table: [],
            promoted: [],
            relegated: [],
            seasonSlug: '2002-03',
            sourceUrl: 'https://example.com/2002',
            tableCount: 1,
          },
          tier1: {
            season: 2002,
            table: [
              {
                pos: 1,
                team: 'Legacy Town',
                played: 10,
                won: 8,
                drawn: 1,
                lost: 1,
                goalsFor: 22,
                goalsAgainst: 8,
                goalDifference: 14,
                goalAverage: null,
                points: 25,
                notes: null,
                wasRelegated: false,
                wasPromoted: false,
                isExpansionTeam: false,
                wasReElected: false,
                wasReprieved: false,
              },
            ],
            promoted: [],
            relegated: [],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '2002-03',
              tierKey: 'tier2',
            },
          },
        },
      },
    });

    const issueTypes = issues.map((issue) => issue.type);
    expect(issueTypes).toContain('unexpected-season-info-table');
    expect(issueTypes).toContain('legacy-tier-metadata-fields');
    expect(issueTypes).toContain('incomplete-tier-metadata');
    expect(issueTypes).toContain('position-gap');
    expect(issueTypes).toContain('unexpected-top-flight-promotion-flag');
    expect(issueTypes).toContain('unexpected-top-flight-promoted-list');
    expect(issueTypes).toContain('tier-metadata-mismatch');
    expect(issueTypes).toContain('incomplete-overview-metadata');
    expect(issueTypes).toContain('promotion-continuity-mismatch');
    expect(issueTypes).toContain('relegation-continuity-mismatch');
  });

  test('analyzeDataset ignores expected promotion-flow continuity limits after 1991', () => {
    const issues = analyzeDataset({
      seasons: {
        1991: {
          seasonInfo: {
            season: 1991,
            table: [],
            promoted: ['Ipswich Town', 'Middlesbrough', 'Blackburn Rovers'],
            relegated: ['Luton Town', 'Notts County', 'West Ham United'],
            seasonSlug: '1991-92_Football_League',
            sourceUrl: 'https://example.com/1991',
            tableCount: 0,
          },
          tier1: {
            season: 1991,
            table: [
              {
                pos: 20,
                team: 'Luton Town',
                played: 42,
                won: 10,
                drawn: 12,
                lost: 20,
                goalsFor: 35,
                goalsAgainst: 55,
                goalDifference: -20,
                goalAverage: null,
                points: 42,
                notes: 'Relegated',
                wasRelegated: true,
                wasPromoted: false,
                isExpansionTeam: false,
                wasReElected: false,
                wasReprieved: false,
              },
            ],
            promoted: [],
            relegated: ['Luton Town', 'Notts County', 'West Ham United'],
            metadata: {
              source: 'wikipedia-promotion',
              seasonSlug: '1991-92',
              sourceUrl: 'https://example.com/1991',
              tierKey: 'tier1',
            },
          },
          tier2: {
            season: 1991,
            table: [
              {
                pos: 1,
                team: 'Ipswich Town',
                played: 46,
                won: 24,
                drawn: 12,
                lost: 10,
                goalsFor: 70,
                goalsAgainst: 40,
                goalDifference: 30,
                goalAverage: null,
                points: 84,
                notes: 'Promotion to the FA Premier League',
                wasRelegated: false,
                wasPromoted: true,
                isExpansionTeam: false,
                wasReElected: false,
                wasReprieved: false,
              },
            ],
            promoted: ['Ipswich Town', 'Middlesbrough', 'Blackburn Rovers'],
            relegated: [],
            metadata: {
              source: 'wikipedia-promotion',
              seasonSlug: '1991-92',
              sourceUrl: 'https://example.com/1991',
              tierKey: 'tier2',
            },
          },
        },
        1992: {
          seasonInfo: {
            season: 1992,
            table: [],
            promoted: [],
            relegated: [],
            seasonSlug: '1992-93_Football_League',
            sourceUrl: 'https://example.com/1992',
            tableCount: 0,
          },
          tier1: {
            season: 1992,
            table: [
              {
                pos: 1,
                team: 'Portsmouth',
                played: 46,
                won: 20,
                drawn: 12,
                lost: 14,
                goalsFor: 60,
                goalsAgainst: 52,
                goalDifference: 8,
                goalAverage: null,
                points: 72,
                notes: null,
                wasRelegated: false,
                wasPromoted: false,
                isExpansionTeam: false,
                wasReElected: false,
                wasReprieved: false,
              },
            ],
            promoted: ['Stoke City'],
            relegated: [],
            metadata: {
              source: 'wikipedia-promotion',
              seasonSlug: '1992-93',
              sourceUrl: 'https://example.com/1992',
              tierKey: 'tier1',
            },
          },
          tier2: {
            season: 1992,
            table: [],
            promoted: [],
            relegated: [],
            metadata: {
              source: 'wikipedia-promotion',
              seasonSlug: '1992-93',
              sourceUrl: 'https://example.com/1992',
              tierKey: 'tier2',
            },
          },
        },
      },
    });

    const issueTypes = issues.map((issue) => issue.type);
    expect(issueTypes).not.toContain('promotion-continuity-mismatch');
    expect(issueTypes).not.toContain('relegation-continuity-mismatch');
  });

  test('analyzeDataset accepts metadata-only placeholder seasons', () => {
    const issues = analyzeDataset({
      metadata: {
        schemaVersion: 1,
        generator: 'wikipedia-overview',
        generatedAt: '2026-03-13T05:00:00.000Z',
      },
      seasons: {
        1939: {
          seasonInfo: {
            season: 1939,
            table: [],
            promoted: [],
            relegated: [],
            seasonSlug: '1939-40_in_English_football',
            sourceUrl: 'https://example.com/1939',
            tableCount: 0,
            competitionStatus: 'abandoned-season',
            officialLeagueTables: false,
            officialCompetitionsAbandoned: true,
            notes: 'Official programme abandoned after the outbreak of war.',
          },
        },
      },
    });

    expect(issues.map((issue) => issue.type)).toEqual([]);
  });

  test('analyzeDataset requires top-level metadata and era-appropriate tier coverage for canonical datasets', () => {
    const issues = analyzeDataset({
      seasons: {
        1995: {
          seasonInfo: {
            season: 1995,
            table: [],
            promoted: [],
            relegated: [],
            seasonSlug: '1995-96_in_English_football',
            sourceUrl: 'https://example.com/1995',
            tableCount: 3,
          },
          tier1: {
            season: 1995,
            table: [
              {
                pos: 1,
                team: 'Chelsea',
                played: 38,
                won: 30,
                drawn: 3,
                lost: 5,
                goalsFor: 85,
                goalsAgainst: 33,
                goalDifference: 52,
                goalAverage: null,
                points: 93,
                notes: null,
                wasRelegated: false,
                wasPromoted: false,
                isExpansionTeam: false,
                wasReElected: false,
                wasReprieved: false,
              },
            ],
            promoted: [],
            relegated: [],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '1995-96',
              sourceUrl: 'https://example.com/1995',
              tierKey: 'tier1',
              title: 'Premier League',
              leagueId: 'Premier_League',
              tableIndex: 0,
              tableCount: 3,
            },
          },
          tier2: {
            season: 1995,
            table: [],
            promoted: [],
            relegated: [],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '1995-96',
              sourceUrl: 'https://example.com/1995',
              tierKey: 'tier2',
              title: 'Championship',
              leagueId: 'Football_League_Championship',
              tableIndex: 1,
              tableCount: 3,
            },
          },
          tier3: {
            season: 1995,
            table: [],
            promoted: [],
            relegated: [],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '1995-96',
              sourceUrl: 'https://example.com/1995',
              tierKey: 'tier3',
              title: 'League One',
              leagueId: 'Football_League_One',
              tableIndex: 2,
              tableCount: 3,
            },
          },
        },
      },
    });

    const issueTypes = issues.map((issue) => issue.type);
    expect(issueTypes).toContain('missing-dataset-metadata');
    expect(issueTypes).toContain('insufficient-tier-coverage');
  });

  test('analyzeDataset accepts canonical metadata and tier depth that matches the era', () => {
    const issues = analyzeDataset({
      metadata: {
        schemaVersion: 1,
        generator: 'wikipedia-combined',
        generatedAt: '2026-03-08T05:00:00.000Z',
      },
      seasons: {
        2011: {
          seasonInfo: {
            season: 2011,
            table: [],
            promoted: [],
            relegated: [],
            seasonSlug: '2011-12_in_English_football',
            sourceUrl: 'https://example.com/2011',
            tableCount: 4,
          },
          tier1: {
            season: 2011,
            table: [
              {
                pos: 1,
                team: 'Manchester City',
                played: 38,
                won: 29,
                drawn: 6,
                lost: 3,
                goalsFor: 99,
                goalsAgainst: 26,
                goalDifference: 73,
                goalAverage: null,
                points: 93,
                notes: null,
                wasRelegated: false,
                wasPromoted: false,
                isExpansionTeam: false,
                wasReElected: false,
                wasReprieved: false,
              },
            ],
            promoted: [],
            relegated: [],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '2011-12',
              sourceUrl: 'https://example.com/2011',
              tierKey: 'tier1',
              title: 'Premier League',
              leagueId: 'Premier_League',
              tableIndex: 0,
              tableCount: 4,
            },
          },
          tier2: {
            season: 2011,
            table: [],
            promoted: [],
            relegated: [],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '2011-12',
              sourceUrl: 'https://example.com/2011',
              tierKey: 'tier2',
              title: 'Championship',
              leagueId: 'Championship',
              tableIndex: 1,
              tableCount: 4,
            },
          },
          tier3: {
            season: 2011,
            table: [],
            promoted: [],
            relegated: [],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '2011-12',
              sourceUrl: 'https://example.com/2011',
              tierKey: 'tier3',
              title: 'League One',
              leagueId: 'League_One',
              tableIndex: 2,
              tableCount: 4,
            },
          },
          tier4: {
            season: 2011,
            table: [],
            promoted: [],
            relegated: [],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '2011-12',
              sourceUrl: 'https://example.com/2011',
              tierKey: 'tier4',
              title: 'League Two',
              leagueId: 'League_Two',
              tableIndex: 3,
              tableCount: 4,
            },
          },
        },
      },
    });

    const issueTypes = issues.map((issue) => issue.type);
    expect(issueTypes).not.toContain('missing-dataset-metadata');
    expect(issueTypes).not.toContain('incomplete-dataset-metadata');
    expect(issueTypes).not.toContain('insufficient-tier-coverage');
    expect(issueTypes).not.toContain('league-order-mismatch');
  });

  test('analyzeDataset allows parallel regional leagues under one canonical tier', () => {
    const issues = analyzeDataset({
      metadata: {
        schemaVersion: 1,
        generator: 'wikipedia-overview',
        generatedAt: '2026-03-13T05:00:00.000Z',
      },
      seasons: {
        1921: {
          seasonInfo: {
            season: 1921,
            table: [],
            promoted: [],
            relegated: [],
            seasonSlug: '1921-22_in_English_football',
            sourceUrl: 'https://example.com/1921',
            tableCount: 4,
          },
          tier1: {
            season: 1921,
            table: [],
            promoted: [],
            relegated: [],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '1921-22',
              sourceUrl: 'https://example.com/1921',
              tierKey: 'tier1',
              title: 'First Division',
              leagueId: 'First_Division',
              leagueLevel: 1,
              tableIndex: 0,
              tableCount: 4,
            },
          },
          tier2: {
            season: 1921,
            table: [],
            promoted: [],
            relegated: [],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '1921-22',
              sourceUrl: 'https://example.com/1921',
              tierKey: 'tier2',
              title: 'Second Division',
              leagueId: 'Second_Division',
              leagueLevel: 2,
              tableIndex: 1,
              tableCount: 4,
            },
          },
          tier3: {
            season: 1921,
            table: [],
            promoted: [],
            relegated: [],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '1921-22',
              sourceUrl: 'https://example.com/1921',
              tierKey: 'tier3',
              leagueLevel: 3,
              structure: 'parallel-leagues',
              parallelGroup: 'third-division-north-south',
              divisionCount: 2,
              tableCount: 4,
            },
            divisions: [
              {
                season: 1921,
                table: [
                  {
                    pos: 1,
                    team: 'Stockport County',
                    played: 38,
                    won: 20,
                    drawn: 8,
                    lost: 10,
                    goalsFor: 60,
                    goalsAgainst: 40,
                    goalDifference: 20,
                    goalAverage: null,
                    points: 48,
                    notes: null,
                    wasRelegated: false,
                    wasPromoted: false,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                ],
                promoted: [],
                relegated: [],
                metadata: {
                  source: 'wikipedia-overview',
                  seasonSlug: '1921-22',
                  sourceUrl: 'https://example.com/1921',
                  tierKey: 'tier3',
                  title: 'Third Division North',
                  leagueId: 'Third_Division_North',
                  leagueLevel: 3,
                  structure: 'single-league',
                  parallelGroup: 'third-division-north-south',
                  divisionKey: 'north',
                  tableIndex: 2,
                  tableCount: 4,
                },
              },
              {
                season: 1921,
                table: [
                  {
                    pos: 1,
                    team: 'Plymouth Argyle',
                    played: 38,
                    won: 21,
                    drawn: 7,
                    lost: 10,
                    goalsFor: 62,
                    goalsAgainst: 39,
                    goalDifference: 23,
                    goalAverage: null,
                    points: 49,
                    notes: null,
                    wasRelegated: false,
                    wasPromoted: false,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                ],
                promoted: [],
                relegated: [],
                metadata: {
                  source: 'wikipedia-overview',
                  seasonSlug: '1921-22',
                  sourceUrl: 'https://example.com/1921',
                  tierKey: 'tier3',
                  title: 'Third Division South',
                  leagueId: 'Third_Division_South',
                  leagueLevel: 3,
                  structure: 'single-league',
                  parallelGroup: 'third-division-north-south',
                  divisionKey: 'south',
                  tableIndex: 3,
                  tableCount: 4,
                },
              },
            ],
          },
        },
      },
    });

    expect(issues.map((issue) => issue.type)).not.toContain('league-order-mismatch');
  });

  test('analyzeDataset reports overview tiers that are shifted upward when a middle league is missing', () => {
    const issues = analyzeDataset({
      metadata: {
        schemaVersion: 1,
        generator: 'wikipedia-overview',
        generatedAt: '2026-03-08T05:00:00.000Z',
      },
      seasons: {
        2019: {
          seasonInfo: {
            season: 2019,
            table: [],
            promoted: [],
            relegated: [],
            seasonSlug: '2019-20_in_English_football',
            sourceUrl: 'https://example.com/2019',
            tableCount: 4,
          },
          tier1: {
            season: 2019,
            table: [
              {
                pos: 1,
                team: 'Liverpool',
                played: 38,
                won: 32,
                drawn: 3,
                lost: 3,
                goalsFor: 85,
                goalsAgainst: 33,
                goalDifference: 52,
                goalAverage: null,
                points: 99,
                notes: null,
                wasRelegated: false,
                wasPromoted: false,
                isExpansionTeam: false,
                wasReElected: false,
                wasReprieved: false,
              },
            ],
            promoted: [],
            relegated: [],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '2019-20',
              sourceUrl: 'https://example.com/2019',
              tierKey: 'tier1',
              title: 'Premier League',
              leagueId: 'Premier_League',
              tableIndex: 0,
              tableCount: 4,
            },
          },
          tier2: {
            season: 2019,
            table: [],
            promoted: [],
            relegated: [],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '2019-20',
              sourceUrl: 'https://example.com/2019',
              tierKey: 'tier2',
              title: 'League One',
              leagueId: 'League_One',
              tableIndex: 1,
              tableCount: 4,
            },
          },
        },
      },
    });

    const issueTypes = issues.map((issue) => issue.type);
    expect(issueTypes).toContain('league-order-mismatch');
  });

  test('analyzeDataset reports 1957 Fourth Division placement rows labeled as ordinary relegation', () => {
    const issues = analyzeDataset({
      metadata: {
        schemaVersion: 1,
        generator: 'wikipedia-overview',
        generatedAt: '2026-06-18T00:00:00.000Z',
      },
      seasons: {
        1957: {
          seasonInfo: {
            season: 1957,
            table: [],
            promoted: [],
            relegated: [],
            leagueStructureSpecialCases: [
              {
                type: 'restructure-placement',
                levels: [3, 4],
                tierKeys: ['tier3', 'tier4'],
                notes:
                  'Final Third Division North/South season; bottom-half clubs moved into the new Fourth Division for 1958-59.',
              },
            ],
          },
          tier3: {
            season: 1957,
            table: [],
            promoted: [],
            relegated: ['Placement United'],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '1957-58',
              tierKey: 'tier3',
              leagueLevel: 3,
              structure: 'parallel-leagues',
              parallelGroup: 'third-division-north-south',
              divisionCount: 1,
              tableCount: 1,
            },
            divisions: [
              {
                season: 1957,
                table: [
                  {
                    pos: 1,
                    team: 'Regional Champions',
                    points: 60,
                    notes: null,
                    wasRelegated: false,
                  },
                  {
                    pos: 2,
                    team: 'Placement United',
                    points: 40,
                    notes: 'Relegation to the Fourth Division',
                    wasRelegated: true,
                  },
                ],
                promoted: [],
                relegated: ['Placement United'],
                metadata: {
                  source: 'wikipedia-overview',
                  seasonSlug: '1957-58',
                  tierKey: 'tier3',
                  title: 'Third Division North',
                  leagueId: 'Third_Division_North',
                  leagueLevel: 3,
                  structure: 'single-league',
                  parallelGroup: 'third-division-north-south',
                  divisionKey: 'north',
                  tableIndex: 0,
                  tableCount: 1,
                },
              },
            ],
          },
        },
      },
    });

    const issueTypes = issues.map((issue) => issue.type);
    expect(issueTypes).toContain('restructure-placement-relegation-flag');
    expect(issueTypes).toContain('restructure-placement-relegated-list');
  });
});
