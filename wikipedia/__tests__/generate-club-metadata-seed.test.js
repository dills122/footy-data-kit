import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildClubMetadataSeed,
  writeClubMetadataSeedFile,
} from '../data/generate-club-metadata-seed.js';

describe('buildClubMetadataSeed', () => {
  test('derives canonical club metadata from observed league table rows', () => {
    const seed = buildClubMetadataSeed({
      seasons: {
        1893: {
          tier2: {
            table: [{ team: 'Woolwich Arsenal' }, { team: 'Small Heath' }],
          },
        },
        1894: {
          tier2: {
            table: [{ team: 'Woolwich Arsenal' }],
          },
        },
        1904: {
          tier1: {
            table: [{ team: 'Small Heath' }],
          },
        },
        1905: {
          tier1: {
            table: [{ team: 'Birmingham' }],
          },
        },
        1914: {
          tier1: {
            table: [{ team: 'Arsenal' }],
          },
        },
      },
    });

    expect(Object.keys(seed)).toEqual(['arsenal', 'birmingham city']);
    expect(seed.arsenal).toEqual({
      canonicalName: 'Arsenal',
      derived: {
        source: 'football-data-output',
        aliases: ['Arsenal', 'Woolwich Arsenal'],
        observedNamePeriods: [
          { name: 'Woolwich Arsenal', startSeason: 1893, endSeason: 1894 },
          { name: 'Arsenal', startSeason: 1914, endSeason: 1914 },
        ],
        firstSeenSeason: 1893,
        lastSeenSeason: 1914,
        seasonsSeen: [1893, 1894, 1914],
        totalSeasonsSeen: 3,
        tiersSeen: ['tier1', 'tier2'],
        tierSeasons: [
          { tierKey: 'tier1', seasons: [1914] },
          { tierKey: 'tier2', seasons: [1893, 1894] },
        ],
        coverageGaps: [{ startSeason: 1895, endSeason: 1913, length: 19 }],
      },
    });
    expect(seed['birmingham city'].canonicalName).toBe('Birmingham');
    expect(seed['birmingham city'].derived.aliases).toEqual(['Birmingham', 'Small Heath']);
    expect(seed['birmingham city'].derived.coverageGaps).toEqual([
      { startSeason: 1894, endSeason: 1903, length: 10 },
    ]);
  });
});

describe('writeClubMetadataSeedFile', () => {
  const tmpDirs = [];

  afterEach(() => {
    while (tmpDirs.length) {
      fs.rmSync(tmpDirs.pop(), { recursive: true, force: true });
    }
  });

  test('writes a sidecar club metadata file from a FootballData input file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'club-metadata-seed-test-'));
    tmpDirs.push(tmpDir);

    const inputFile = path.join(tmpDir, 'all-seasons.json');
    const outputFile = path.join(tmpDir, 'club-metadata.json');

    fs.writeFileSync(
      inputFile,
      JSON.stringify({
        seasons: {
          2024: {
            tier1: {
              season: 2024,
              table: [{ team: 'Arsenal' }],
              promoted: [],
              relegated: [],
            },
          },
        },
      })
    );

    const result = writeClubMetadataSeedFile({
      input: inputFile,
      output: outputFile,
      cwd: process.cwd(),
    });

    const saved = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    expect(result.clubCount).toBe(1);
    expect(saved.metadata.generator).toBe('club-metadata-seed');
    expect(saved.clubs.arsenal.derived.seasonsSeen).toEqual([2024]);
  });
});
