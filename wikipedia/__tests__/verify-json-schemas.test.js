import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSchemaValidator, validateSchemaTargets } from '../data/verify-json-schemas.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildFootballDataFixture() {
  return {
    metadata: {
      schemaVersion: 1,
      generator: 'test',
      generatedAt: '2026-06-18T00:00:00.000Z',
    },
    clubs: {
      'example fc': {
        canonicalName: 'Example FC',
      },
    },
    seasons: {
      1900: {
        seasonInfo: {
          season: 1900,
          table: [],
          promoted: [],
          relegated: [],
        },
        tier1: {
          season: 1900,
          table: [
            {
              pos: 1,
              team: 'Example FC',
              played: 38,
              won: 25,
              drawn: 8,
              lost: 5,
              goalsFor: 80,
              goalsAgainst: 32,
              goalDifference: 48,
              goalAverage: null,
              points: 83,
              notes: null,
              wasRelegated: false,
              wasPromoted: false,
              isExpansionTeam: false,
              wasReElected: false,
              wasReprieved: false,
              outcomeStatus: null,
            },
          ],
          promoted: [],
          relegated: [],
          metadata: {
            source: 'wikipedia-overview',
            seasonSlug: '1900-01',
            leagueId: 'League_table',
            title: 'Example League',
            leagueLevel: 1,
            tableIndex: 0,
            tableCount: 1,
            tierKey: 'tier1',
          },
        },
      },
    },
  };
}

function buildClubMetadataFixture() {
  return {
    metadata: {
      schemaVersion: 1,
      generator: 'test',
      generatedAt: '2026-06-18T00:00:00.000Z',
    },
    clubs: {
      'example fc': {
        clubId: 'example-fc',
        canonicalName: 'Example FC',
        status: {
          current: 'active',
          trackedFromSeason: 1900,
          trackedToSeason: 1900,
          hasUnexplainedGaps: false,
        },
        history: {
          lifecycleEvents: [
            {
              type: 'renamed',
              season: 1900,
              label: 'Example lifecycle event',
            },
          ],
          absenceExplanations: [],
        },
        derived: {
          aliases: ['Example FC'],
          firstSeenSeason: 1900,
          lastSeenSeason: 1900,
          seasonsSeen: [1900],
          totalSeasonsSeen: 1,
          tiersSeen: ['tier1'],
          tierSeasons: [{ tierKey: 'tier1', seasons: [1900] }],
          coverageGaps: [],
        },
        assets: {
          crest: {
            preferred: 'wikipedia-pageimage-free:Example_FC_crest.svg',
            status: 'usable',
            candidates: [
              {
                assetId: 'wikipedia-pageimage-free:Example_FC_crest.svg',
                kind: 'crest',
                status: 'usable',
                priority: 1,
                source: 'wikipedia-pageimage-free',
                sourceUrl: 'https://en.wikipedia.org/wiki/Example_F.C.',
                imageUrl: 'https://upload.wikimedia.org/example.svg',
                fileTitle: 'File:Example_FC_crest.svg',
                mimeType: 'image/svg+xml',
                width: 512,
                height: 512,
                license: {
                  shortName: 'PD',
                  usageTerms: 'Public domain',
                  copyrighted: false,
                  attribution: 'Example FC',
                },
                verification: {
                  identityMatch: 'strong',
                  licenseCheck: 'pass',
                  httpCheck: 'pass',
                  needsManualReview: false,
                  checkedAt: '2026-06-20T00:00:00.000Z',
                },
              },
            ],
          },
        },
      },
    },
  };
}

describe('verify-json-schemas', () => {
  const tmpDirs = [];

  afterEach(() => {
    while (tmpDirs.length) {
      fs.rmSync(tmpDirs.pop(), { recursive: true, force: true });
    }
  });

  test('validates FootballData and resolves embedded club metadata refs', () => {
    const validator = createSchemaValidator(path.resolve(process.cwd(), 'schemas'));
    const result = validator.validate('football-data.schema.json', buildFootballDataFixture());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('reports missing required fields', () => {
    const validator = createSchemaValidator(path.resolve(process.cwd(), 'schemas'));
    const result = validator.validate('football-data.schema.json', {});

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.keyword === 'required')).toBe(true);
  });

  test('reports unexpected extra fields', () => {
    const validator = createSchemaValidator(path.resolve(process.cwd(), 'schemas'));
    const data = clone(buildFootballDataFixture());
    data.seasons[1900].tier1.table[0].unexpectedField = true;

    const result = validator.validate('football-data.schema.json', data);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.keyword === 'additionalProperties')).toBe(true);
  });

  test('validateSchemaTargets validates explicit data files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'footy-schema-verify-'));
    tmpDirs.push(tmpDir);

    const dataDir = path.join(tmpDir, 'data-output');
    const sidecarDir = path.join(tmpDir, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.mkdirSync(sidecarDir, { recursive: true });
    fs.writeFileSync(
      path.join(dataDir, 'all-seasons.json'),
      JSON.stringify(buildFootballDataFixture())
    );
    fs.writeFileSync(
      path.join(sidecarDir, 'club-metadata.json'),
      JSON.stringify(buildClubMetadataFixture())
    );

    const results = validateSchemaTargets({
      rootDir: tmpDir,
      schemaDir: path.resolve(process.cwd(), 'schemas'),
      targets: [
        {
          label: 'all-seasons.json',
          schemaFile: 'football-data.schema.json',
          dataFile: 'data-output/all-seasons.json',
        },
        {
          label: 'club-metadata.json',
          schemaFile: 'club-metadata.schema.json',
          dataFile: 'data/club-metadata.json',
        },
      ],
    });

    expect(results.map((result) => result.valid)).toEqual([true, true]);
  });
});
