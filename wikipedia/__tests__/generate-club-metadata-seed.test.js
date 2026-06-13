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
        identitySources: [
          {
            type: 'wikipedia-club-page',
            sourceUrl: 'https://en.wikipedia.org/wiki/Arsenal_F.C.',
          },
        ],
        observedNames: [
          {
            rawName: 'Woolwich Arsenal',
            normalizedName: 'woolwich arsenal',
            firstSeenSeason: 1893,
            lastSeenSeason: 1894,
            seasonsSeen: [1893, 1894],
            tiersSeen: ['tier2'],
          },
          {
            rawName: 'Arsenal',
            normalizedName: 'arsenal',
            firstSeenSeason: 1914,
            lastSeenSeason: 1914,
            seasonsSeen: [1914],
            tiersSeen: ['tier1'],
          },
        ],
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
    expect(seed['birmingham city'].canonicalName).toBe('Birmingham City');
    expect(seed['birmingham city'].derived.aliases).toEqual(['Birmingham', 'Small Heath']);
    expect(seed['birmingham city'].derived.coverageGaps).toEqual([
      { startSeason: 1894, endSeason: 1903, length: 10 },
    ]);
  });

  test('keeps successor clubs separate and applies season-aware identity rules', () => {
    const seed = buildClubMetadataSeed({
      seasons: {
        1982: {
          tier4: {
            table: [{ team: 'Chester' }],
          },
        },
        1983: {
          tier4: {
            table: [{ team: 'Chester City' }],
          },
        },
        2003: {
          tier2: {
            table: [{ team: 'Wimbledon' }],
          },
        },
        2011: {
          tier4: {
            table: [{ team: 'AFC Wimbledon' }],
          },
        },
        2013: {
          tier5: {
            table: [{ team: 'Halifax Town' }, { team: 'FC Halifax Town' }],
          },
        },
        2024: {
          tier6: {
            table: [{ team: 'Chester' }],
          },
        },
      },
    });

    expect(Object.keys(seed).sort()).toEqual([
      'afc wimbledon',
      'chester',
      'chester city',
      'fc halifax town',
      'halifax town',
      'wimbledon',
    ]);
    expect(seed['chester city'].derived.aliases).toEqual(['Chester', 'Chester City']);
    expect(seed['chester city'].derived.identitySources).toEqual([
      {
        type: 'former-efl-clubs-list',
        sourceUrl: 'https://en.wikipedia.org/wiki/List_of_former_English_Football_League_clubs',
        notes:
          'Earlier Football League Chester records belong to the Chester City identity; modern Chester is a successor club.',
      },
    ]);
    expect(seed.chester.derived.aliases).toEqual(['Chester']);
    expect(seed['chester city'].derived.relationships).toEqual([
      {
        clubKey: 'chester',
        relationship: 'phoenix',
        direction: 'successor',
        sourceRefs: [
          {
            type: 'former-efl-clubs-list',
            sourceUrl: 'https://en.wikipedia.org/wiki/List_of_former_English_Football_League_clubs',
          },
        ],
      },
    ]);
    expect(seed.chester.derived.relationships).toEqual([
      {
        clubKey: 'chester city',
        relationship: 'phoenix',
        direction: 'predecessor',
        sourceRefs: [
          {
            type: 'former-efl-clubs-list',
            sourceUrl: 'https://en.wikipedia.org/wiki/List_of_former_English_Football_League_clubs',
          },
        ],
      },
    ]);
    expect(seed['halifax town'].derived.relationships).toEqual([
      {
        clubKey: 'fc halifax town',
        relationship: 'phoenix',
        direction: 'successor',
        sourceRefs: [
          {
            type: 'former-efl-clubs-list',
            sourceUrl: 'https://en.wikipedia.org/wiki/List_of_former_English_Football_League_clubs',
          },
        ],
      },
    ]);
    expect(seed['afc wimbledon'].canonicalName).toBe('AFC Wimbledon');
    expect(seed.wimbledon.canonicalName).toBe('Wimbledon');
  });

  test('splits same-name historical and modern club identities when sources distinguish them', () => {
    const seed = buildClubMetadataSeed({
      seasons: {
        1929: {
          tier3: {
            table: [{ team: 'South Shields' }],
          },
        },
        1930: {
          tier3: {
            table: [{ team: 'Gateshead' }],
          },
        },
        1961: {
          tier4: {
            table: [{ team: 'Accrington Stanley' }],
          },
        },
        2006: {
          tier4: {
            table: [{ team: 'Accrington Stanley' }],
          },
        },
        2024: {
          tier6: {
            table: [{ team: 'South Shields' }],
          },
        },
      },
    });

    expect(Object.keys(seed).sort()).toEqual([
      'accrington stanley',
      'accrington stanley 1891',
      'gateshead 1899',
      'south shields',
    ]);
    expect(seed['accrington stanley 1891'].canonicalName).toBe('Accrington Stanley (1891)');
    expect(seed['accrington stanley 1891'].derived.seasonsSeen).toEqual([1961]);
    expect(seed['accrington stanley'].canonicalName).toBe('Accrington Stanley');
    expect(seed['accrington stanley'].derived.seasonsSeen).toEqual([2006]);
    expect(seed['accrington stanley 1891'].derived.relationships).toEqual([
      {
        clubKey: 'accrington stanley',
        relationship: 'phoenix',
        direction: 'successor',
        sourceRefs: [
          {
            type: 'former-efl-clubs-list',
            sourceUrl: 'https://en.wikipedia.org/wiki/List_of_former_English_Football_League_clubs',
          },
        ],
      },
    ]);
    expect(seed['gateshead 1899'].canonicalName).toBe('Gateshead (1899)');
    expect(seed['gateshead 1899'].derived.aliases).toEqual(['Gateshead', 'South Shields']);
    expect(seed['gateshead 1899'].derived.seasonsSeen).toEqual([1929, 1930]);
    expect(seed['gateshead 1899'].derived.identitySources).toEqual([
      {
        type: 'former-efl-clubs-list',
        sourceUrl: 'https://en.wikipedia.org/wiki/List_of_former_English_Football_League_clubs',
        notes:
          'Former EFL list describes the older Gateshead club as defunct with new Gateshead and South Shields clubs formed.',
      },
      {
        type: 'wikipedia-club-page',
        sourceUrl: 'https://en.wikipedia.org/wiki/Gateshead_A.F.C.',
        notes:
          'The original South Shields club relocated to Gateshead in 1930 and adopted the Gateshead name.',
      },
    ]);
    expect(seed['south shields'].canonicalName).toBe('South Shields');
    expect(seed['south shields'].derived.seasonsSeen).toEqual([2024]);
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
