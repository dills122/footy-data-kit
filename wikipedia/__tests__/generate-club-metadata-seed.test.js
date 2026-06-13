import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildClubMetadataSeed,
  writeClubMetadataSeedFile,
} from '../data/generate-club-metadata-seed.js';
import { analyzeClubContinuity } from '../data/verify-club-continuity.js';

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
    expect(seed.arsenal).toMatchObject({
      clubId: 'arsenal',
      canonicalName: 'Arsenal',
      status: {
        current: 'active',
        trackedFromSeason: 1893,
        trackedToSeason: null,
        hasUnexplainedGaps: true,
      },
      history: {
        nameHistory: [],
        lifecycleEvents: [],
        trackedMembership: [
          {
            fromSeason: 1893,
            toSeason: null,
            tiers: ['tier1', 'tier2'],
            basis: 'observed',
          },
        ],
        absenceExplanations: [],
      },
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
    expect(seed.arsenal.clubId).toBe('arsenal');
    expect(seed['birmingham city'].canonicalName).toBe('Birmingham City');
    expect(seed['birmingham city'].clubId).toBe('birmingham-city');
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
    expect(seed['accrington stanley 1891'].clubId).toBe('accrington-stanley-1891');
    expect(seed['accrington stanley 1891'].derived.seasonsSeen).toEqual([1961]);
    expect(seed['accrington stanley'].canonicalName).toBe('Accrington Stanley');
    expect(seed['accrington stanley'].clubId).toBe('accrington-stanley');
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

  test('adds official pause explanations for wartime observed coverage gaps', () => {
    const seed = buildClubMetadataSeed({
      seasons: {
        1938: {
          tier3: {
            table: [{ team: 'Accrington Stanley' }],
          },
        },
        1939: {
          seasonInfo: {
            season: 1939,
            competitionStatus: 'abandoned-season',
            officialLeagueTables: false,
          },
        },
        1940: {
          seasonInfo: {
            season: 1940,
            competitionStatus: 'wartime-special',
            officialLeagueTables: false,
          },
        },
        1941: {
          seasonInfo: {
            season: 1941,
            competitionStatus: 'wartime-special',
            officialLeagueTables: false,
          },
        },
        1942: {
          seasonInfo: {
            season: 1942,
            competitionStatus: 'wartime-special',
            officialLeagueTables: false,
          },
        },
        1943: {
          seasonInfo: {
            season: 1943,
            competitionStatus: 'wartime-special',
            officialLeagueTables: false,
          },
        },
        1944: {
          seasonInfo: {
            season: 1944,
            competitionStatus: 'wartime-special',
            officialLeagueTables: false,
          },
        },
        1945: {
          seasonInfo: {
            season: 1945,
            competitionStatus: 'regional-bridge-season',
            officialLeagueTables: false,
          },
        },
        1946: {
          tier3: {
            table: [{ team: 'Accrington Stanley' }],
          },
        },
      },
    });

    expect(seed['accrington stanley 1891'].derived.coverageGaps).toEqual([
      { startSeason: 1939, endSeason: 1945, length: 7 },
    ]);
    expect(seed['accrington stanley 1891'].history.absenceExplanations).toEqual([
      {
        fromSeason: 1939,
        toSeason: 1945,
        reason: 'official-competition-paused',
        basis: 'season-metadata',
      },
    ]);
    expect(seed['accrington stanley 1891'].status.hasUnexplainedGaps).toBe(false);
  });

  test('derives gap explanations from table notes when clubs leave tracked coverage', () => {
    const dataset = {
      seasons: {
        2007: {
          tier4: {
            metadata: {
              sourceUrl: 'https://example.test/2007-08',
              seasonSlug: '2007-08-example-season',
              title: 'League Two',
            },
            table: [
              {
                team: 'Example Town',
                notes: 'Relegation to 2008–09 Conference National',
              },
            ],
          },
        },
        2008: { tier4: { table: [] } },
        2009: { tier4: { table: [] } },
        2010: { tier4: { table: [] } },
        2011: { tier4: { table: [] } },
        2012: {
          tier5: {
            table: [{ team: 'Example Town' }],
          },
        },
      },
    };

    const seed = buildClubMetadataSeed(dataset);

    expect(seed['example town'].history.lifecycleEvents).toEqual([
      {
        type: 'relegated-outside-tracked-coverage',
        season: 2007,
        description: 'Relegation to 2008–09 Conference National',
        sourceRefs: [
          {
            type: 'wikipedia-season-page',
            sourceUrl: 'https://example.test/2007-08',
            notes: 'League Two table in 2007-08-example-season',
          },
        ],
      },
    ]);
    expect(seed['example town'].history.absenceExplanations).toEqual([
      {
        fromSeason: 2008,
        toSeason: 2011,
        reason: 'outside-tracked-coverage',
        linkedEventType: 'relegated-outside-tracked-coverage',
        basis: 'table-note',
        notes: 'Relegation to 2008–09 Conference National',
        sourceRefs: [
          {
            type: 'wikipedia-season-page',
            sourceUrl: 'https://example.test/2007-08',
            notes: 'League Two table in 2007-08-example-season',
          },
        ],
      },
    ]);
    expect(seed['example town'].status.hasUnexplainedGaps).toBe(false);
    expect(analyzeClubContinuity(dataset, { clubs: seed })).toEqual([]);
  });
});

describe('analyzeClubContinuity', () => {
  test('reports missing expected seasons outside official pauses and explanations', () => {
    const dataset = {
      seasons: {
        1950: { tier2: { table: [{ team: 'Example Town' }] } },
        1951: { tier2: { table: [] } },
        1952: { tier2: { table: [] } },
        1953: { tier2: { table: [{ team: 'Example Town' }] } },
      },
    };
    const clubMetadata = {
      clubs: {
        'example town': {
          clubId: 'example-town',
          canonicalName: 'Example Town',
          derived: {
            seasonsSeen: [1950, 1953],
          },
          history: {
            trackedMembership: [
              {
                fromSeason: 1950,
                toSeason: 1953,
                tiers: ['tier2'],
                basis: 'observed',
              },
            ],
            absenceExplanations: [],
          },
        },
      },
    };

    expect(analyzeClubContinuity(dataset, clubMetadata)).toEqual([
      expect.objectContaining({
        type: 'unexplained-club-gap',
        clubId: 'example-town',
        canonicalName: 'Example Town',
        fromSeason: 1951,
        toSeason: 1952,
        missingSeasons: [1951, 1952],
      }),
    ]);
  });

  test('ignores official competition pauses and explicit absence explanations', () => {
    const dataset = {
      seasons: {
        1938: { tier3: { table: [{ team: 'Example Town' }] } },
        1939: {
          seasonInfo: {
            season: 1939,
            competitionStatus: 'abandoned-season',
            officialLeagueTables: false,
          },
        },
        1940: {
          seasonInfo: {
            season: 1940,
            competitionStatus: 'wartime-special',
            officialLeagueTables: false,
          },
        },
        1941: {
          seasonInfo: {
            season: 1941,
            competitionStatus: 'wartime-special',
            officialLeagueTables: false,
          },
        },
        1942: {
          tier3: { table: [{ team: 'Example Town' }] },
        },
      },
    };
    const clubMetadata = {
      clubs: {
        'example town': {
          clubId: 'example-town',
          canonicalName: 'Example Town',
          derived: {
            seasonsSeen: [1938, 1942],
          },
          history: {
            trackedMembership: [
              {
                fromSeason: 1938,
                toSeason: 1942,
                tiers: ['tier3'],
                basis: 'observed',
              },
            ],
            absenceExplanations: [{ fromSeason: 1941, toSeason: 1941, reason: 'data-gap' }],
          },
        },
      },
    };

    expect(analyzeClubContinuity(dataset, clubMetadata)).toEqual([]);
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
