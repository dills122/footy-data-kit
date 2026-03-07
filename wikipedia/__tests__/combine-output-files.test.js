import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { combineFootballDataFiles } from '../combine-output-files.js';

describe('combine-output-files CLI', () => {
  const tmpDirs = [];

  afterEach(() => {
    while (tmpDirs.length) {
      const dir = tmpDirs.pop();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('merges inputs, keeps richer tier data, normalises goal difference, and removes war years', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'combine-output-test-'));
    tmpDirs.push(tmpDir);

    const overviewFile = path.join(tmpDir, 'overview.json');
    const promoFile = path.join(tmpDir, 'promo.json');
    const outputFile = path.join(tmpDir, 'all-seasons.json');

    fs.writeFileSync(
      overviewFile,
      JSON.stringify(
        {
          seasons: {
            2000: {
              tier1: {
                season: 2000,
                table: [
                  {
                    pos: 1,
                    team: 'Team Rich Data',
                    played: 1,
                    won: 1,
                    drawn: 0,
                    lost: 0,
                    goalsFor: 4,
                    goalsAgainst: 1,
                    goalDifference: 999, // intentionally incorrect to ensure normalisation
                    goalAverage: null,
                    points: 3,
                    notes: 'Test notes',
                    wasRelegated: false,
                    wasPromoted: true,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                ],
                promoted: [],
                relegated: [],
              },
            },
            1915: {
              tier1: {
                season: 1915,
                table: [
                  {
                    pos: 1,
                    team: 'War Season Team',
                    played: 1,
                    won: 1,
                    drawn: 0,
                    lost: 0,
                    goalsFor: 2,
                    goalsAgainst: 0,
                    goalDifference: 2,
                    goalAverage: null,
                    points: 2,
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
              },
            },
          },
        },
        null,
        2
      )
    );

    fs.writeFileSync(
      promoFile,
      JSON.stringify(
        {
          seasons: {
            2000: {
              tier1: {
                season: 2000,
                table: [],
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

    const result = combineFootballDataFiles({
      inputs: [overviewFile, promoFile],
      output: outputFile,
      cwd: process.cwd(),
    });

    expect(fs.existsSync(outputFile)).toBe(true);

    const combined = result.dataset;
    expect(combined).toHaveProperty('seasons.2000');
    const tier1Table = combined.seasons['2000'].tier1.table;
    expect(Array.isArray(tier1Table)).toBe(true);
    expect(tier1Table).toHaveLength(1);

    const mergedRow = tier1Table[0];
    expect(mergedRow.team).toBe('Team Rich Data');
    expect(mergedRow.goalDifference).toBe(mergedRow.goalsFor - mergedRow.goalsAgainst);

    expect(combined.seasons['1915']).toBeUndefined();
  });

  test('combineFootballDataFiles reports missing season ranges and non-numeric keys', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'combine-output-test-'));
    tmpDirs.push(tmpDir);

    const missingSeasonInput = path.join(tmpDir, 'missing.json');
    const partialInput = path.join(tmpDir, 'partial.json');
    const outputFile = path.join(tmpDir, 'merged.json');

    fs.writeFileSync(
      missingSeasonInput,
      JSON.stringify(
        {
          seasons: {
            abc: {
              tier1: {
                season: 'abc',
                table: [],
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

    fs.writeFileSync(
      partialInput,
      JSON.stringify(
        {
          seasons: {
            2001: {
              tier1: {
                season: 2001,
                table: [],
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

    const result = combineFootballDataFiles({
      inputs: [missingSeasonInput, partialInput],
      output: outputFile,
      includeEmpty: false,
      cwd: process.cwd(),
    });

    expect(result.stats.missingSeasonNumbers).toEqual([2001]);
    expect(result.stats.nonNumericMissing).toEqual(['abc']);
  });

  test('combineFootballDataFiles prefers the richer populated tier when both inputs contain data', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'combine-output-test-'));
    tmpDirs.push(tmpDir);

    const sparseInput = path.join(tmpDir, 'sparse.json');
    const richInput = path.join(tmpDir, 'rich.json');
    const outputFile = path.join(tmpDir, 'merged.json');

    fs.writeFileSync(
      sparseInput,
      JSON.stringify(
        {
          seasons: {
            2002: {
              tier1: {
                season: 2002,
                table: [
                  {
                    pos: 1,
                    team: 'Alpha FC',
                    played: 1,
                    won: 1,
                    drawn: 0,
                    lost: 0,
                    goalsFor: 2,
                    goalsAgainst: 0,
                    goalDifference: 2,
                    goalAverage: null,
                    points: 3,
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
              },
            },
          },
        },
        null,
        2
      )
    );

    fs.writeFileSync(
      richInput,
      JSON.stringify(
        {
          seasons: {
            2002: {
              tier1: {
                season: 2002,
                table: [
                  {
                    pos: 1,
                    team: 'Alpha FC',
                    played: 2,
                    won: 2,
                    drawn: 0,
                    lost: 0,
                    goalsFor: 5,
                    goalsAgainst: 1,
                    goalDifference: 4,
                    goalAverage: null,
                    points: 6,
                    notes: null,
                    wasRelegated: false,
                    wasPromoted: true,
                    isExpansionTeam: false,
                    wasReElected: false,
                    wasReprieved: false,
                  },
                  {
                    pos: 2,
                    team: 'Beta FC',
                    played: 2,
                    won: 1,
                    drawn: 0,
                    lost: 1,
                    goalsFor: 3,
                    goalsAgainst: 3,
                    goalDifference: 0,
                    goalAverage: null,
                    points: 3,
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
                title: 'Rich League',
              },
            },
          },
        },
        null,
        2
      )
    );

    const result = combineFootballDataFiles({
      inputs: [sparseInput, richInput],
      output: outputFile,
      cwd: process.cwd(),
    });

    expect(result.dataset.seasons['2002'].tier1.table).toHaveLength(2);
    expect(result.dataset.seasons['2002'].tier1.promoted).toEqual(['Alpha FC']);
    expect(result.dataset.seasons['2002'].tier1.title).toBe('Rich League');
  });

  test('combineFootballDataFiles throws when an input file is missing', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'combine-output-test-'));
    tmpDirs.push(tmpDir);
    const outputFile = path.join(tmpDir, 'merged.json');

    expect(() => {
      combineFootballDataFiles({
        inputs: [path.join(tmpDir, 'does-not-exist.json')],
        output: outputFile,
        cwd: process.cwd(),
      });
    }).toThrow(/Input file not found/i);
  });
});
