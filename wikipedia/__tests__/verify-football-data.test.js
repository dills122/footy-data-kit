import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyzeDataset, analyzeFile, expandTargets } from '../verify-football-data.js';

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
});
