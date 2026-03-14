import { jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WIKIPEDIA_DATA_SOURCES, isWikipediaWarSuspensionYear } from '../config.js';
import { canonicalizeTeamName } from '../data/data-quality-config.js';
import {
  buildSeasonOverviewSeasonRecord,
  fetchSeasonOverviewTables,
} from '../builders/parse-ext-season-overview-pages.js';
import { constructTier1SeasonResults, fetchSeasonTeams } from '../builders/parse-season-pages.js';
import { fetchWikipediaSeasonPage } from '../parser-core/page-fetcher.js';
import testPages from './config.js';
import { getPageSources, parseRequestedSources } from './source-selection.js';

const TEST_TIMEOUT_MS = 120_000;
jest.setTimeout(TEST_TIMEOUT_MS);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const DATA_SOURCES = Object.fromEntries(
  Object.entries(WIKIPEDIA_DATA_SOURCES).map(([key, config]) => [
    key,
    {
      datasetPath: path.join(repoRoot, 'data-output', config.datasetFileName),
      liveLabel: config.liveLabel,
      sourceId: config.sourceId,
    },
  ])
);

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

function getPageUrlForSource(page, sourceKey) {
  return page.urls?.[sourceKey] || null;
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

function getSavedSeasonRecordMaybe(sourceKey, season) {
  const dataset = getSavedDataset(sourceKey);
  return dataset.seasons?.[String(season)] || null;
}

function getSeasonInfoFromRecord(seasonRecord) {
  return seasonRecord.seasonInfo ?? null;
}

function getTierEntriesFromRecord(seasonRecord) {
  const tierEntries = [];
  for (const [tierKey, tierRecord] of Object.entries(seasonRecord)) {
    if (tierKey === 'seasonInfo') continue;
    if (!tierKey.match(/^tier\d+$/)) continue;
    if (!tierRecord || typeof tierRecord !== 'object') continue;
    if (!Array.isArray(tierRecord.table)) continue;
    tierEntries.push([tierKey, tierRecord]);
  }
  return tierEntries;
}

function getTopTierKey(seasonRecord) {
  if (!seasonRecord || typeof seasonRecord !== 'object') return null;
  const primary = getTierEntriesFromRecord(seasonRecord).find(([tierKey]) => tierKey === 'tier1');
  if (primary) return primary[0];
  const tierEntries = getTierEntriesFromRecord(seasonRecord);
  if (!tierEntries.length) return null;
  return tierEntries
    .map(([tierKey]) => Number(tierKey.replace('tier', '')))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)[0]
    ?.toString()
    .replace(/^(\d+)$/, 'tier$1');
}

function getTopTierTableFromRecord(seasonRecord) {
  const tierKey = getTopTierKey(seasonRecord);
  if (!tierKey) {
    return null;
  }
  const tierRecord = seasonRecord?.[tierKey];
  if (!Array.isArray(tierRecord?.table)) {
    return null;
  }
  return tierRecord.table;
}

function getMetadataValue(value) {
  if (value == null) return null;
  return value;
}

function normalizeSourceUrl(value) {
  if (!value || typeof value !== 'string') return value;
  try {
    const parsed = new URL(value);
    return `${parsed.origin}${decodeURIComponent(parsed.pathname)}`;
  } catch (error) {
    return decodeURIComponent(value);
  }
}

function isPlaceholderSeasonRecord(seasonRecord) {
  const seasonInfo = getSeasonInfoFromRecord(seasonRecord);
  return (
    Boolean(seasonInfo?.competitionStatus) && getTierEntriesFromRecord(seasonRecord).length === 0
  );
}

function assertSavedMetadataIntegrity(page, sourceKey, seasonRecord) {
  const config = DATA_SOURCES[sourceKey];
  const seasonInfo = getSeasonInfoFromRecord(seasonRecord);
  const expectedSourceId = config?.sourceId;
  const seasonYear = Number(page.season);

  if (!seasonInfo) {
    throw new Error(`Missing seasonInfo for season ${page.season} (${page.url})`);
  }

  if (seasonInfo.season !== seasonYear) {
    throw new Error(
      `Season info mismatch for ${page.season}: expected ${seasonYear}, got ${seasonInfo.season}`
    );
  }

  if (seasonInfo.seasonSlug !== page.slug) {
    throw new Error(
      `Season info seasonSlug mismatch for ${page.season}: expected ${page.slug}, got ${seasonInfo.seasonSlug}`
    );
  }

  if (
    seasonInfo.sourceUrl &&
    normalizeSourceUrl(seasonInfo.sourceUrl) !== normalizeSourceUrl(page.url)
  ) {
    throw new Error(
      `Season info sourceUrl mismatch for ${page.season}: expected ${page.url}, got ${seasonInfo.sourceUrl}`
    );
  }

  if (!Number.isInteger(seasonInfo.tableCount)) {
    throw new Error(`Season info tableCount must be an integer for ${page.season}`);
  }

  const tierEntries = getTierEntriesFromRecord(seasonRecord);
  if (!tierEntries.length && isPlaceholderSeasonRecord(seasonRecord)) {
    if (sourceKey !== 'overview') {
      throw new Error(`Only overview fixtures may use placeholder seasons (${page.season})`);
    }
    if (typeof seasonInfo.officialLeagueTables !== 'boolean') {
      throw new Error(`Placeholder season ${page.season} missing officialLeagueTables flag`);
    }
    return;
  }

  if (!tierEntries.length) {
    throw new Error(`No tier data found for ${page.season}`);
  }

  for (const [tierKey, tierRecord] of tierEntries) {
    const metadata = tierRecord?.metadata || {};

    if (metadata.source !== expectedSourceId) {
      throw new Error(
        `Tier metadata source mismatch for ${page.season} ${tierKey}: expected ${expectedSourceId}, got ${metadata.source}`
      );
    }

    if (
      metadata.sourceUrl &&
      normalizeSourceUrl(metadata.sourceUrl) !== normalizeSourceUrl(page.url)
    ) {
      throw new Error(
        `Tier metadata sourceUrl mismatch for ${page.season} ${tierKey}: expected ${page.url}, got ${metadata.sourceUrl}`
      );
    }

    if (metadata.seasonSlug !== page.slug) {
      throw new Error(
        `Tier metadata seasonSlug mismatch for ${page.season} ${tierKey}: expected ${page.slug}, got ${metadata.seasonSlug}`
      );
    }

    if (metadata.tierKey !== tierKey) {
      throw new Error(
        `Tier metadata tierKey mismatch for ${page.season} ${tierKey}: tier record is ${tierKey}, metadata is ${metadata.tierKey}`
      );
    }

    if (sourceKey === 'overview') {
      if (typeof getMetadataValue(metadata.title) !== 'string' || !metadata.title.trim()) {
        throw new Error(`Overview tier metadata missing title for ${page.season} ${tierKey}`);
      }
      if (typeof getMetadataValue(metadata.leagueId) !== 'string' || !metadata.leagueId.trim()) {
        throw new Error(`Overview tier metadata missing leagueId for ${page.season} ${tierKey}`);
      }
      if (!Number.isInteger(metadata.tableIndex)) {
        throw new Error(
          `Overview tier metadata tableIndex must be an integer for ${page.season} ${tierKey}`
        );
      }
      if (!Number.isInteger(metadata.tableCount)) {
        throw new Error(
          `Overview tier metadata tableCount must be an integer for ${page.season} ${tierKey}`
        );
      }
    }
  }
}

function canonicalizedSet(values) {
  return new Set(
    values
      .map((value) => canonicalizeTeamName(value))
      .filter((value) => typeof value === 'string' && value.length)
  );
}

function collectTransitionTeamsFromSeasonRecord(sourceKey, seasonRecord) {
  const seasonInfo = getSeasonInfoFromRecord(seasonRecord);
  const promoted = [];
  const relegated = [];

  if (Array.isArray(seasonInfo?.promoted)) {
    promoted.push(...seasonInfo.promoted);
  }
  if (Array.isArray(seasonInfo?.relegated)) {
    relegated.push(...seasonInfo.relegated);
  }

  if (sourceKey === 'overview') {
    return { promoted, relegated };
  }

  if (promoted.length || relegated.length) {
    return { promoted, relegated };
  }

  const tier1 = seasonRecord.tier1;
  return {
    promoted: Array.isArray(tier1?.promoted) ? tier1.promoted : [],
    relegated: Array.isArray(tier1?.relegated) ? tier1.relegated : [],
  };
}

function assertSavedContinuity(page, sourceKey, seasonRecord) {
  const season = Number(page.season);
  const nextSeason = season + 1;
  const nextRecord = getSavedSeasonRecordMaybe(sourceKey, nextSeason);
  if (!nextRecord) {
    if (isWikipediaWarSuspensionYear(nextSeason)) return;
    throw new Error(
      `Saved continuity check needs next season ${nextSeason}, but it is missing for source ${sourceKey}`
    );
  }

  const transition = collectTransitionTeamsFromSeasonRecord(sourceKey, seasonRecord);
  const promoted = canonicalizedSet(transition.promoted);
  const relegated = canonicalizedSet(transition.relegated);
  const nextTopTierTable = getTopTierTableFromRecord(nextRecord);
  if (!nextTopTierTable) {
    throw new Error(
      `Saved continuity check for ${page.season}: next season ${nextSeason} has no top-tier table`
    );
  }

  const nextTopTierTeams = canonicalizedSet(nextTopTierTable.map((teamRow) => teamRow.team));
  const missingPromoted = [];
  const unexpectedRelegated = [];

  for (const team of promoted) {
    if (!nextTopTierTeams.has(team)) {
      missingPromoted.push(team);
    }
  }

  for (const team of relegated) {
    if (nextTopTierTeams.has(team)) {
      unexpectedRelegated.push(team);
    }
  }

  if (!missingPromoted.length && !unexpectedRelegated.length) {
    return;
  }

  const lines = [
    `Cross-season continuity failed for ${page.season} -> ${nextSeason} (${page.url})`,
    `Missing promoted teams in ${nextSeason} top tier: ${missingPromoted.join(', ') || 'none'}`,
    `Relegated teams still in ${nextSeason} top tier: ${unexpectedRelegated.join(', ') || 'none'}`,
  ];
  throw new Error(lines.join('\n'));
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

function verifySeasonInfoFields(page, actualSeasonInfo, expectedSeasonInfo = {}) {
  for (const [key, expectedValue] of Object.entries(expectedSeasonInfo)) {
    if (JSON.stringify(actualSeasonInfo?.[key]) !== JSON.stringify(expectedValue)) {
      throw new Error(
        `Season info mismatch for ${page.season} ${key}: expected ${JSON.stringify(
          expectedValue
        )}, got ${JSON.stringify(actualSeasonInfo?.[key])}`
      );
    }
  }
}

const requestedSourcesEnv = process.env.WIKI_TEST_SOURCE || null;
const requestedSources = parseRequestedSources(requestedSourcesEnv);

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
    for (const sourceKey of getPageSources(page)) {
      if (requestedSources && !requestedSources.has(sourceKey)) {
        continue;
      }
      hasMatchingPages = true;
      const handler = sourceHandlers[sourceKey];
      if (!handler) {
        throw new Error(`Unsupported data source "${sourceKey}" for season ${page.season}`);
      }

      const pageUrl = getPageUrlForSource(page, sourceKey);
      if (!pageUrl) {
        throw new Error(`Missing ${sourceKey} url for season ${page.season}`);
      }
      const slug = slugFromUrl(pageUrl);
      const seasonYear = Number(page.season);
      const testTitle = `${seasonYear} [${sourceKey}] – ${slug}`;

      test(
        testTitle,
        async () => {
          const sourcedPage = { ...page, url: pageUrl };
          const expected = page.tests || {};
          const expectsPlaceholder = Boolean(expected.seasonInfo?.competitionStatus);
          let summary;
          let tierRecords;

          if (expectsPlaceholder) {
            await assertSection(`${describeSource(sourceKey)} – fetch page`, async () => {
              const fetchedPage = await fetchWikipediaSeasonPage(slug);
              if (!fetchedPage?.html) {
                throw new Error(`Failed to fetch ${slug}`);
              }
            });
            summary = {
              promoted: [],
              relegated: [],
            };
            tierRecords = null;
          } else {
            ({ summary, tierRecords } = await handler({
              page: sourcedPage,
              slug,
              seasonYear,
              sourceKey,
            }));
          }

          await assertSection(
            `${describeSource(sourceKey)} – promotion/relegation comparison`,
            () => {
              verifyTeams(sourcedPage, 'promoted', summary.promoted ?? [], expected.promoted ?? []);
              verifyTeams(
                sourcedPage,
                'relegated',
                summary.relegated ?? [],
                expected.relegated ?? []
              );
            }
          );

          const savedSeasonRecord = await assertSection(`Saved dataset (${sourceKey}) lookup`, () =>
            getSavedSeasonRecord(sourceKey, page.season)
          );
          await assertSection(`Saved dataset (${sourceKey}) metadata comparison`, () => {
            assertSavedMetadataIntegrity({ ...sourcedPage, slug }, sourceKey, savedSeasonRecord);
            verifySeasonInfoFields(
              sourcedPage,
              getSeasonInfoFromRecord(savedSeasonRecord),
              expected.seasonInfo ?? {}
            );
          });

          await assertSection(
            `Saved dataset (${sourceKey}) promotion/relegation comparison`,
            () => {
              const savedTeams = collectSavedTeams(savedSeasonRecord);
              verifyTeamsContain(
                sourcedPage,
                'saved promoted',
                savedTeams.promoted,
                expected.promoted ?? []
              );
              verifyTeamsContain(
                sourcedPage,
                'saved relegated',
                savedTeams.relegated,
                expected.relegated ?? []
              );
            }
          );

          if (!expectsPlaceholder) {
            await assertSection(`Saved dataset (${sourceKey}) continuity`, () =>
              assertSavedContinuity({ ...sourcedPage, slug }, sourceKey, savedSeasonRecord)
            );
          }

          if (!expectsPlaceholder) {
            await assertSection(`${describeSource(sourceKey)} – table entry assertions`, () =>
              verifyTableEntries(
                sourcedPage,
                expected.tableEntries ?? [],
                tierRecords,
                savedSeasonRecord
              )
            );
          }
        },
        TEST_TIMEOUT_MS
      );
    }
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
