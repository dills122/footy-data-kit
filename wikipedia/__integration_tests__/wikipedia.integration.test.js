import { jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { constructTier1SeasonResults, fetchSeasonTeams } from '../parse-season-pages.js';
import {
  buildSeasonOverviewSeasonRecord,
  fetchSeasonOverviewTables,
} from '../parse-ext-season-overview-pages.js';
import testPages from './config.js';

const TEST_TIMEOUT_MS = 120_000;
jest.setTimeout(TEST_TIMEOUT_MS);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const DATA_SOURCES = {
  promotion: {
    datasetPath: path.join(repoRoot, 'data-output', 'wiki_promotion_relegations_by_season.json'),
    liveLabel: 'Promotion flow',
  },
  overview: {
    datasetPath: path.join(repoRoot, 'data-output', 'wiki_overview_tables_by_season.json'),
    liveLabel: 'Overview flow',
  },
};

const savedDatasets = {};
const savedDatasetErrors = {};
for (const [key, config] of Object.entries(DATA_SOURCES)) {
  try {
    savedDatasets[key] = JSON.parse(fs.readFileSync(config.datasetPath, 'utf8'));
  } catch (err) {
    savedDatasetErrors[key] = err;
  }
}

function slugFromUrl(url) {
  if (!url) throw new Error('Missing url for integration test entry');
  let slug;
  try {
    const parsed = new URL(url);
    const trimmedPath = parsed.pathname.replace(/^\/+/, '');
    slug = trimmedPath.startsWith('wiki/') ? trimmedPath.slice(5) : trimmedPath;
  } catch (err) {
    // Fallback for non-standard urls (should not happen, but keeps tests resilient)
    const [, path = ''] = String(url).split('wiki/');
    slug = path;
  }
  if (!slug) throw new Error(`Unable to derive slug from url: ${url}`);
  return decodeURIComponent(slug);
}

function getSavedDataset(sourceKey) {
  const dataset = savedDatasets[sourceKey];
  if (dataset) return dataset;
  const datasetPath = DATA_SOURCES[sourceKey]?.datasetPath || '(unknown path)';
  const underlying = savedDatasetErrors[sourceKey]
    ? `: ${savedDatasetErrors[sourceKey].message}`
    : '';
  throw new Error(`Unable to load saved dataset for ${sourceKey} at ${datasetPath}${underlying}`);
}

function getSavedSeasonRecord(sourceKey, season) {
  const dataset = getSavedDataset(sourceKey);
  const seasonRecord = dataset.seasons?.[String(season)];
  if (!seasonRecord) {
    const datasetPath = DATA_SOURCES[sourceKey]?.datasetPath || '(unknown path)';
    throw new Error(
      `Saved dataset (${sourceKey}) missing season ${season} entry (expected file ${datasetPath})`
    );
  }

  return seasonRecord;
}

function getSeasonInfoFromRecord(seasonRecord) {
  return seasonRecord.seasonInfo ?? null;
}

function verifyTeams({ season, url }, label, actual = [], expected = []) {
  const missing = expected.filter((team) => !actual.includes(team));
  const unexpected = actual.filter((team) => !expected.includes(team));

  if (missing.length || unexpected.length || actual.length !== expected.length) {
    const lines = [
      `❌ ${season} ${label} mismatch`,
      `URL: ${url}`,
      `Expected (${expected.length}): ${expected.join(', ') || 'none'}`,
      `Actual   (${actual.length}): ${actual.join(', ') || 'none'}`,
    ];
    if (missing.length) lines.push(`Missing: ${missing.join(', ')}`);
    if (unexpected.length) lines.push(`Unexpected: ${unexpected.join(', ')}`);
    throw new Error(lines.join('\n'));
  }
}

function verifyTeamsContain({ season, url }, label, actualTeams = [], expected = []) {
  if (!Array.isArray(expected) || expected.length === 0) return;
  const actualSet = new Set(actualTeams);
  const missing = expected.filter((team) => !actualSet.has(team));

  if (missing.length) {
    const lines = [
      `❌ ${season} ${label} mismatch`,
      `URL: ${url}`,
      `Missing: ${missing.join(', ')}`,
      `Actual contains (${actualSet.size}): ${Array.from(actualSet).join(', ') || 'none'}`,
    ];
    throw new Error(lines.join('\n'));
  }
}

function collectSavedTeams(seasonRecord) {
  const promoted = new Set();
  const relegated = new Set();
  const seasonInfo = getSeasonInfoFromRecord(seasonRecord);

  if (Array.isArray(seasonInfo?.promoted)) {
    for (const team of seasonInfo.promoted) promoted.add(team);
  }
  if (Array.isArray(seasonInfo?.relegated)) {
    for (const team of seasonInfo.relegated) relegated.add(team);
  }

  for (const [key, value] of Object.entries(seasonRecord)) {
    if (key === 'seasonInfo' || !value || Array.isArray(value)) continue;
    if (Array.isArray(value.promoted)) {
      for (const team of value.promoted) promoted.add(team);
    }
    if (Array.isArray(value.relegated)) {
      for (const team of value.relegated) relegated.add(team);
    }
  }

  return { promoted: Array.from(promoted), relegated: Array.from(relegated) };
}

function describeSource(sourceKey) {
  return DATA_SOURCES[sourceKey]?.liveLabel || sourceKey;
}

async function assertSection(label, fn) {
  try {
    return await fn();
  } catch (err) {
    if (err && typeof err === 'object') {
      const message = err.message || '';
      err.message = `[${label}] ${message}`.trim();
      throw err;
    }
    throw new Error(`[${label}] ${String(err)}`);
  }
}

const ALLOWED_SOURCES = Object.freeze(['promotion', 'overview']);
const requestedSourcesEnv = process.env.WIKI_TEST_SOURCE
  ? process.env.WIKI_TEST_SOURCE.split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  : null;
let requestedSources = null;
if (requestedSourcesEnv && requestedSourcesEnv.length) {
  requestedSources = new Set();
  for (const value of requestedSourcesEnv) {
    if (!ALLOWED_SOURCES.includes(value)) {
      throw new Error(
        `Unsupported WIKI_TEST_SOURCE value "${value}". Allowed sources: ${ALLOWED_SOURCES.join(
          ', '
        )}`
      );
    }
    requestedSources.add(value);
  }
}

const sourceHandlers = {
  promotion: async ({ page, slug, seasonYear, sourceKey }) => {
    const tables = await assertSection(`${describeSource(sourceKey)} – fetch tables`, () =>
      fetchSeasonTeams(slug)
    );
    const tier1Table = Array.isArray(tables.first) ? tables.first : [];
    const tier2Table = Array.isArray(tables.second) ? tables.second : [];
    await assertSection(`${describeSource(sourceKey)} – division table presence`, () => {
      if (!tier1Table.length) {
        throw new Error(`First Division table returned empty for ${page.season} (${page.url})`);
      }
      if (!tier2Table.length) {
        throw new Error(`Second Division table returned empty for ${page.season} (${page.url})`);
      }
    });

    const tierResults = await assertSection(
      `${describeSource(sourceKey)} – season construction`,
      () => constructTier1SeasonResults(tier1Table, tier2Table, seasonYear, slug)
    );

    return {
      summary: {
        promoted: tierResults.tier1.promoted ?? [],
        relegated: tierResults.tier1.relegated ?? [],
      },
      tierRecords: tierResults,
    };
  },
  overview: async ({ page, slug, seasonYear, sourceKey }) => {
    const tables = await assertSection(`${describeSource(sourceKey)} – fetch tables`, () =>
      fetchSeasonOverviewTables(slug)
    );
    await assertSection(`${describeSource(sourceKey)} – table presence`, () => {
      const hasRows = tables.some((table) => Array.isArray(table.rows) && table.rows.length);
      if (!hasRows) {
        throw new Error(`No league tables returned for ${page.season} (${page.url})`);
      }
    });

    const seasonRecord = await assertSection(
      `${describeSource(sourceKey)} – season construction`,
      () =>
        buildSeasonOverviewSeasonRecord({
          seasonKey: String(page.season),
          seasonYear,
          seasonSlug: slug,
          tables,
        })
    );

    return {
      summary: {
        promoted: seasonRecord.seasonInfo?.promoted ?? [],
        relegated: seasonRecord.seasonInfo?.relegated ?? [],
      },
      tierRecords: seasonRecord,
    };
  },
};

function getTierTableFromResults(page, results, tierKey) {
  const tier = results[tierKey];
  if (!tier || !Array.isArray(tier.table) || !tier.table.length) {
    throw new Error(
      `Constructed results missing ${tierKey} table data for season ${page.season} (${page.url})`
    );
  }
  return tier.table;
}

function getTierTableFromSavedRecord(page, seasonRecord, tierKey) {
  const tierData = seasonRecord[tierKey];
  const table = Array.isArray(tierData)
    ? tierData
    : Array.isArray(tierData?.table)
    ? tierData.table
    : null;

  if (!table || table.length === 0) {
    throw new Error(
      `Saved dataset missing ${tierKey} table data for season ${page.season} (${page.url})`
    );
  }

  return table;
}

function verifyTableEntryFromTable(page, tierKey, expectedData, table, sourceLabel) {
  if (!expectedData || !expectedData.team) {
    throw new Error(`Invalid table entry expectation for ${page.season} ${tierKey}`);
  }

  const { team, ...rest } = expectedData;
  const row = table.find((entry) => entry.team === team);
  if (!row) {
    throw new Error(
      `${sourceLabel} missing ${tierKey} entry for ${team} (${page.season} – ${page.url})`
    );
  }

  const mismatches = [];
  for (const [key, expectedValue] of Object.entries(rest)) {
    if (row[key] !== expectedValue) {
      mismatches.push(`${key}: expected ${expectedValue}, got ${row[key]}`);
    }
  }

  if (mismatches.length) {
    const messageLines = [
      `❌ ${sourceLabel} ${page.season} ${tierKey} entry mismatch for ${team}`,
      ...mismatches.map((line) => ` - ${line}`),
    ];
    throw new Error(messageLines.join('\n'));
  }
}

function verifyTableEntries(page, expectations = [], results, savedSeasonRecord) {
  if (!Array.isArray(expectations) || expectations.length === 0) return;

  for (const expectation of expectations) {
    const tierKey = expectation.tier;
    const expectedData = expectation.data;
    const liveTable = getTierTableFromResults(page, results, tierKey);
    verifyTableEntryFromTable(page, tierKey, expectedData, liveTable, 'Live table');

    const savedTable = getTierTableFromSavedRecord(page, savedSeasonRecord, tierKey);
    verifyTableEntryFromTable(page, tierKey, expectedData, savedTable, 'Saved dataset');
  }
}

describe('Wikipedia promotion/relegation integration', () => {
  let hasMatchingPages = false;
  for (const page of testPages) {
    const slug = slugFromUrl(page.url);
    const seasonYear = Number(page.season);
    const testTitle = `${seasonYear} – ${slug}`;
    const sourceKey = page.source || 'promotion';
    if (requestedSources && !requestedSources.has(sourceKey)) {
      continue;
    }
    hasMatchingPages = true;
    const handler = sourceHandlers[sourceKey];
    if (!handler) {
      throw new Error(`Unsupported data source "${sourceKey}" for season ${page.season}`);
    }

    test(
      testTitle,
      async () => {
        const { summary, tierRecords } = await handler({
          page,
          slug,
          seasonYear,
          sourceKey,
        });
        const expected = page.tests || {};

        await assertSection(
          `${describeSource(sourceKey)} – promotion/relegation comparison`,
          () => {
            verifyTeams(page, 'promoted', summary.promoted ?? [], expected.promoted ?? []);
            verifyTeams(page, 'relegated', summary.relegated ?? [], expected.relegated ?? []);
          }
        );

        const savedSeasonRecord = await assertSection(`Saved dataset (${sourceKey}) lookup`, () =>
          getSavedSeasonRecord(sourceKey, page.season)
        );
        await assertSection(`Saved dataset (${sourceKey}) metadata comparison`, () => {
          const savedSeasonInfo = getSeasonInfoFromRecord(savedSeasonRecord);
          if (savedSeasonInfo?.sourceUrl && savedSeasonInfo.sourceUrl !== page.url) {
            throw new Error(
              `Source URL mismatch for season ${page.season}: expected ${page.url}, got ${savedSeasonInfo.sourceUrl}`
            );
          }
          if (
            savedSeasonInfo?.seasonSlug &&
            savedSeasonInfo?.sourceUrl &&
            savedSeasonInfo.seasonSlug !== slug
          ) {
            throw new Error(
              `Season slug mismatch for season ${page.season}: expected ${slug}, got ${savedSeasonInfo.seasonSlug}`
            );
          }
        });

        await assertSection(`Saved dataset (${sourceKey}) promotion/relegation comparison`, () => {
          const savedTeams = collectSavedTeams(savedSeasonRecord);
          verifyTeamsContain(page, 'saved promoted', savedTeams.promoted, expected.promoted ?? []);
          verifyTeamsContain(
            page,
            'saved relegated',
            savedTeams.relegated,
            expected.relegated ?? []
          );
        });

        await assertSection(`${describeSource(sourceKey)} – table entry assertions`, () =>
          verifyTableEntries(page, expected.tableEntries ?? [], tierRecords, savedSeasonRecord)
        );
      },
      TEST_TIMEOUT_MS
    );
  }
  if (!hasMatchingPages) {
    const allowedDescription = requestedSourcesEnv?.join(', ') || '';
    test('no matching integration entries', () => {
      throw new Error(
        `No integration tests matched the requested source filter (${allowedDescription}).`
      );
    });
  }
});
