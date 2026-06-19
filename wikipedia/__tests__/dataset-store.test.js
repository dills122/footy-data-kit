import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDatasetStore } from '../data/dataset-store.js';

describe('createDatasetStore', () => {
  const tmpDirs = [];

  afterEach(() => {
    while (tmpDirs.length) {
      fs.rmSync(tmpDirs.pop(), { recursive: true, force: true });
    }
  });

  test('preserves full build range metadata during partial season updates', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'footy-dataset-store-'));
    tmpDirs.push(tmpDir);
    const filePath = path.join(tmpDir, 'overview.json');

    fs.writeFileSync(
      filePath,
      JSON.stringify({
        metadata: {
          schemaVersion: 1,
          generator: 'wikipedia-overview',
          generatedAt: '2026-06-19T00:00:00.000Z',
          buildOptions: {
            startYear: 1957,
            endYear: 1957,
            forceUpdate: true,
          },
        },
        seasons: {
          1888: {
            seasonInfo: {
              season: 1888,
              table: [],
              promoted: [],
              relegated: [],
            },
          },
          2025: {
            seasonInfo: {
              season: 2025,
              table: [],
              promoted: [],
              relegated: [],
            },
          },
        },
      })
    );

    const store = createDatasetStore(filePath, {
      generator: 'wikipedia-overview',
      buildOptions: {
        startYear: 1957,
        endYear: 1957,
        forceUpdate: true,
        includeWarPlaceholders: true,
      },
    });

    store.writeSeason('1957', {
      seasonInfo: {
        season: 1957,
        table: [],
        promoted: [],
        relegated: [],
      },
    });

    const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    expect(saved.metadata.buildOptions).toMatchObject({
      startYear: 1888,
      endYear: 2025,
      forceUpdate: true,
      includeWarPlaceholders: true,
    });
  });

  test('writes a single tier without replacing existing season data', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'footy-dataset-store-'));
    tmpDirs.push(tmpDir);
    const filePath = path.join(tmpDir, 'overview.json');

    fs.writeFileSync(
      filePath,
      JSON.stringify({
        metadata: {
          schemaVersion: 1,
          generator: 'wikipedia-overview',
          generatedAt: '2026-06-19T00:00:00.000Z',
        },
        seasons: {
          2012: {
            seasonInfo: {
              season: 2012,
              table: [],
              promoted: ['Cardiff City'],
              relegated: ['Wigan Athletic'],
            },
            tier1: {
              season: 2012,
              table: [{ pos: 1, team: 'Manchester United', played: 38, points: 89 }],
              promoted: [],
              relegated: [],
            },
          },
        },
      })
    );

    const store = createDatasetStore(filePath, {
      generator: 'wikipedia-overview',
      buildOptions: {
        source: 'lower-tier-page',
      },
    });

    store.writeTier('2012', 'tier5', {
      season: 2012,
      table: [{ pos: 1, team: 'Mansfield Town', played: 46, points: 95 }],
      promoted: ['Mansfield Town'],
      relegated: [],
      metadata: {
        source: 'wikipedia-overview',
        seasonSlug: '2012–13_Football_Conference',
        tierKey: 'tier5',
        title: 'Conference Premier',
        leagueLevel: 5,
        structure: 'single-league',
      },
    });

    const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    expect(saved.seasons['2012'].seasonInfo.promoted).toEqual(['Cardiff City']);
    expect(saved.seasons['2012'].tier1.table[0]).toMatchObject({
      team: 'Manchester United',
      points: 89,
    });
    expect(saved.seasons['2012'].tier5).toMatchObject({
      season: 2012,
      promoted: ['Mansfield Town'],
      metadata: {
        tierKey: 'tier5',
        title: 'Conference Premier',
        leagueLevel: 5,
      },
    });
  });

  test('writes multiple tier records in one save without replacing existing season data', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'footy-dataset-store-'));
    tmpDirs.push(tmpDir);
    const filePath = path.join(tmpDir, 'overview.json');

    fs.writeFileSync(
      filePath,
      JSON.stringify({
        seasons: {
          2012: {
            seasonInfo: {
              season: 2012,
              table: [],
              promoted: ['Cardiff City'],
              relegated: ['Wigan Athletic'],
            },
            tier1: {
              season: 2012,
              table: [{ pos: 1, team: 'Manchester United', played: 38, points: 89 }],
              promoted: [],
              relegated: [],
            },
          },
        },
      })
    );

    const store = createDatasetStore(filePath, {
      generator: 'wikipedia-overview',
      buildOptions: {
        source: 'lower-tier-page',
      },
    });

    store.writeTiers('2012', {
      seasonInfo: {
        season: 2012,
        promoted: ['Should Not Be Written'],
        relegated: [],
      },
      tier5: {
        season: 2012,
        table: [{ pos: 1, team: 'Mansfield Town', played: 46, points: 95 }],
        promoted: ['Mansfield Town'],
        relegated: [],
      },
      tier6: {
        season: 2012,
        table: [],
        promoted: [],
        relegated: [],
        metadata: {
          source: 'wikipedia-overview',
          seasonSlug: '2012–13_Football_Conference',
          tierKey: 'tier6',
          title: 'Conference North/South',
          leagueLevel: 6,
          structure: 'parallel-leagues',
          parallelGroup: 'conference-north-south',
          divisionCount: 2,
        },
        divisions: [
          {
            season: 2012,
            table: [{ pos: 1, team: 'Chester', played: 42, points: 107 }],
            promoted: ['Chester'],
            relegated: [],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '2012–13_Football_Conference',
              tierKey: 'tier6',
              title: 'Conference North',
              leagueLevel: 6,
              structure: 'single-league',
              parallelGroup: 'conference-north-south',
              divisionKey: 'north',
            },
          },
          {
            season: 2012,
            table: [{ pos: 1, team: 'Welling United', played: 42, points: 86 }],
            promoted: ['Welling United'],
            relegated: [],
            metadata: {
              source: 'wikipedia-overview',
              seasonSlug: '2012–13_Football_Conference',
              tierKey: 'tier6',
              title: 'Conference South',
              leagueLevel: 6,
              structure: 'single-league',
              parallelGroup: 'conference-north-south',
              divisionKey: 'south',
            },
          },
        ],
      },
    });

    const saved = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    expect(saved.seasons['2012'].seasonInfo.promoted).toEqual(['Cardiff City']);
    expect(saved.seasons['2012'].tier1.table[0].team).toBe('Manchester United');
    expect(saved.seasons['2012'].tier5.table[0].team).toBe('Mansfield Town');
    expect(saved.seasons['2012'].tier6.metadata).toMatchObject({
      structure: 'parallel-leagues',
      parallelGroup: 'conference-north-south',
      divisionCount: 2,
    });
    expect(saved.seasons['2012'].tier6.divisions.map((division) => division.table[0].team)).toEqual(
      ['Chester', 'Welling United']
    );
  });
});
