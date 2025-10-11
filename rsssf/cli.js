#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { decodeRsssfBuffer, fetchRsssfPage, parseRsssfPage } from './parse-page.js';

const DEFAULT_URL_TEMPLATE = 'https://www.rsssf.org/engpaul/FLA/{seasonSlug}.html';

function ensureJsonOutputPath(parsedResult, explicitPath) {
  if (explicitPath) return path.resolve(explicitPath);

  const baseDir = path.resolve(process.cwd(), 'data-output', 'rsssf');
  const slugSource = (() => {
    if (parsedResult.seasonSlug) return parsedResult.seasonSlug;
    if (typeof parsedResult.season === 'string') return parsedResult.season;
    if (Array.isArray(parsedResult.season) && parsedResult.season.length === 1) {
      return parsedResult.season[0];
    }
    return null;
  })();

  const fallback = 'season';
  const safeSlug = (slugSource || fallback)
    .toString()
    .toLowerCase()
    .replace(/[/\\\s]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-|-$/g, '');

  const fileName = `rsssf-${safeSlug || fallback}.json`;
  return path.join(baseDir, fileName);
}

function collectValues(value, previous) {
  if (!previous) return [value];
  return previous.concat(value);
}

function formatSeasonParts(startYear) {
  const endYear = startYear + 1;
  const endYearShort = String(endYear).slice(-2).padStart(2, '0');
  const seasonSlug = `${startYear}-${endYearShort}`;
  const seasonSlugFull = `${startYear}-${endYear}`;
  const seasonSlugUnderscore = `${startYear}_${endYearShort}`;
  const seasonSlugCompact = `${startYear}${endYearShort}`;
  const seasonLabel = `${startYear}/${endYear}`;

  return {
    startYear,
    endYear,
    endYearShort,
    seasonSlug,
    seasonSlugFull,
    seasonSlugUnderscore,
    seasonSlugCompact,
    seasonLabel,
  };
}

function applyTemplate(template, parts) {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(parts, key)) {
      return String(parts[key]);
    }
    return match;
  });
}

function buildSeasonRangeUrls(startYear, endYear, template) {
  if (startYear > endYear) {
    throw new Error('Start year must be less than or equal to end year.');
  }

  const urls = [];
  for (let year = startYear; year <= endYear; year += 1) {
    const parts = formatSeasonParts(year);
    const url = applyTemplate(template, parts);
    urls.push({ url, parts });
  }

  return urls;
}

function ensureAggregateOutputPath(explicitPath) {
  if (explicitPath) return path.resolve(explicitPath);
  const baseDir = path.resolve(process.cwd(), 'data-output', 'rsssf');
  return path.join(baseDir, 'rsssf_promotion_relegations_by_season.json');
}

function extractSeasonYear(seasonValue, parts) {
  if (parts?.startYear != null) return parts.startYear;
  if (typeof seasonValue === 'number') return seasonValue;
  if (typeof seasonValue === 'string') {
    const match = seasonValue.match(/\d{4}/);
    if (match) return Number.parseInt(match[0], 10);
  }
  if (Array.isArray(seasonValue)) {
    for (const entry of seasonValue) {
      const year = extractSeasonYear(entry);
      if (year != null) return year;
    }
  }
  return null;
}

function summariseTierOneCompetition(competition, seasonYear) {
  if (!competition) return null;
  const table = competition.rows || [];
  const relegated = table.filter((row) => row.wasRelegated).map((row) => row.team);
  const promoted = table.filter((row) => row.wasPromoted).map((row) => row.team);

  return {
    season: seasonYear,
    table,
    relegated,
    promoted,
  };
}

function buildSeasonRecordFromParsed(parsed, parts) {
  const competitions = Array.isArray(parsed?.competitions) ? parsed.competitions : [];
  if (!competitions.length) return null;

  const seasonYear = extractSeasonYear(parsed.season, parts);
  const seasonKey =
    seasonYear != null ? String(seasonYear) : parts?.seasonSlug || parsed.seasonSlug;

  if (!seasonKey) return null;

  const seasonRecord = {};
  const tierOne = summariseTierOneCompetition(competitions[0], seasonYear);
  if (tierOne) {
    seasonRecord.tier1 = tierOne;
  }

  competitions.slice(1).forEach((competition, idx) => {
    const tierKey = `tier${idx + 2}`;
    seasonRecord[tierKey] = competition.rows || [];
  });

  return { seasonKey, record: seasonRecord };
}

function buildEmptySeasonRecord(parts) {
  const seasonYear = extractSeasonYear(null, parts);
  const seasonKey = seasonYear != null ? String(seasonYear) : parts?.seasonSlug;
  if (!seasonKey) return null;

  return {
    seasonKey,
    record: {
      tier1: {
        season: seasonYear ?? null,
        table: [],
        relegated: [],
        promoted: [],
      },
    },
  };
}

async function writeJsonToFile(filePath, data, prettySpacing) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, prettySpacing), 'utf8');
}

async function readLocalHtml(filePath) {
  const absPath = path.resolve(filePath);
  const buffer = await fs.readFile(absPath);
  return decodeRsssfBuffer(buffer);
}

const program = new Command();

program
  .name('rsssf-scraper')
  .description('Scrape RSSSF league tables into structured JSON')
  .version('1.0.0');

program
  .command('scrape')
  .description('Fetch and parse an RSSSF page')
  .option('-u, --url <url>', 'RSSSF page to fetch', collectValues, [])
  .option(
    '-f, --from-file <file>',
    'Parse HTML from a local file instead of fetching',
    collectValues,
    []
  )
  .option('-s, --start <year>', 'First season (inclusive) to fetch by range')
  .option('-e, --end <year>', 'Final season (inclusive) to fetch by range')
  .option(
    '--url-template <template>',
    'Template for season URLs (supports {seasonSlug}, {startYear}, {endYear}, {endYearShort}, {seasonSlugUnderscore}, {seasonSlugFull}, {seasonSlugCompact}, {seasonLabel})',
    DEFAULT_URL_TEMPLATE
  )
  .option('-o, --output <file>', 'Optional JSON output path')
  .option('--pretty', 'Pretty-print JSON output', false)
  .option('--save-html <file>', 'Optional path to persist the raw HTML payload')
  .action(async (opts) => {
    const { output: outputOption, pretty, saveHtml, start, end, urlTemplate } = opts;
    const urls = Array.isArray(opts.url) ? opts.url : opts.url ? [opts.url] : [];
    const files = Array.isArray(opts.fromFile)
      ? opts.fromFile
      : opts.fromFile
      ? [opts.fromFile]
      : [];

    const rangeSources = [];
    const hasStart = typeof start !== 'undefined';
    const hasEnd = typeof end !== 'undefined';
    if (hasStart || hasEnd) {
      if (!hasStart || !hasEnd) {
        console.error('Both --start and --end must be provided when using a year range.');
        process.exit(1);
      }

      const startYear = Number.parseInt(start, 10);
      const endYear = Number.parseInt(end, 10);

      if (Number.isNaN(startYear) || Number.isNaN(endYear)) {
        console.error('Start and end must be valid numeric years.');
        process.exit(1);
      }

      try {
        const generated = buildSeasonRangeUrls(startYear, endYear, urlTemplate);
        for (const entry of generated) {
          rangeSources.push({
            kind: 'remote',
            value: entry.url,
            meta: { seasonParts: entry.parts, isRange: true },
          });
          console.log(`Generated URL for ${entry.parts.seasonLabel}: ${entry.url}`);
        }
      } catch (err) {
        console.error(`Failed to generate URLs: ${err.message}`);
        process.exit(1);
      }
    }

    if (!urls.length && !files.length && !rangeSources.length) {
      console.error(
        'Please provide either --url, --from-file, or a --start/--end range so the scraper has HTML to parse.'
      );
      process.exit(1);
    }

    const sources = [
      ...urls.map((url) => ({ kind: 'remote', value: url })),
      ...files.map((filePath) => ({ kind: 'local', value: filePath })),
      ...rangeSources,
    ];
    const isRangeMode = rangeSources.length > 0;
    let individualOutput = outputOption;
    if (isRangeMode) {
      individualOutput = null;
    }
    const multipleSources = sources.length > 1;
    const treatOutputAsDirectory = multipleSources && individualOutput && !isRangeMode;
    const prettySpacing = pretty ? 2 : 0;

    if (treatOutputAsDirectory) {
      console.log(
        'Multiple sources detected: treating --output as a directory for individual JSON files.'
      );
    }

    const aggregateResults = isRangeMode ? { seasons: {} } : null;
    const aggregateOutputPath = aggregateResults ? ensureAggregateOutputPath(outputOption) : null;
    const persistAggregate = async () => {
      if (!aggregateResults || !aggregateOutputPath) return;
      try {
        await writeJsonToFile(aggregateOutputPath, aggregateResults, prettySpacing);
        console.log(`💾 Progress saved to ${aggregateOutputPath}`);
      } catch (err) {
        console.error(`Failed to save aggregate progress: ${err.message}`);
      }
    };
    let hasRegisteredSignalHandler = false;
    const results = [];

    for (const source of sources) {
      if (aggregateResults && !hasRegisteredSignalHandler) {
        let interrupted = false;
        process.on('SIGINT', async () => {
          if (interrupted) return;
          interrupted = true;
          console.log('\n🛑 Interrupted, attempting to save progress before exit...');
          await persistAggregate();
          process.exit(0);
        });
        hasRegisteredSignalHandler = true;
      }

      let html;
      let sourceLabel = source.value;

      try {
        if (source.kind === 'local') {
          html = await readLocalHtml(source.value);
          sourceLabel = path.resolve(source.value);
        } else {
          html = await fetchRsssfPage(source.value);
          sourceLabel = source.value;
        }
      } catch (err) {
        const rangeParts = source.meta?.seasonParts;
        if (aggregateResults && source.meta?.isRange && rangeParts) {
          console.warn(
            `Skipping ${rangeParts.seasonLabel} (${source.value}) due to fetch error: ${err.message}`
          );
          const emptySeason = buildEmptySeasonRecord(rangeParts);
          if (emptySeason) {
            aggregateResults.seasons[emptySeason.seasonKey] = emptySeason.record;
            await persistAggregate();
          }
          results.push({ sourceLabel, outputPath: null, parsed: null, skipped: true });
          continue;
        }

        console.error(`Failed to load HTML (${source.value}): ${err.message}`);
        process.exit(1);
      }

      const parsed = parseRsssfPage(html, { source: sourceLabel });
      const payload = JSON.stringify(parsed, null, prettySpacing);

      const defaultOutputPath = ensureJsonOutputPath(parsed, null);
      const defaultFileName = path.basename(defaultOutputPath);
      const isRangeSource = Boolean(source.meta?.seasonParts);

      let resolvedOutputPath = null;
      if (!(isRangeMode && isRangeSource)) {
        if (treatOutputAsDirectory) {
          const outputDir = path.resolve(individualOutput);
          await fs.mkdir(outputDir, { recursive: true });
          resolvedOutputPath = path.join(outputDir, defaultFileName);
        } else {
          resolvedOutputPath = ensureJsonOutputPath(parsed, individualOutput);
        }
      }

      try {
        if (resolvedOutputPath) {
          await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
          await fs.writeFile(resolvedOutputPath, payload, 'utf8');
          console.log(`Saved JSON to ${resolvedOutputPath}`);
        }

        if (saveHtml) {
          let htmlPath;
          if (multipleSources) {
            const htmlDir = path.resolve(saveHtml);
            await fs.mkdir(htmlDir, { recursive: true });
            const htmlFileName = defaultFileName.replace(/\.json$/i, '') || 'rsssf-page';
            htmlPath = path.join(htmlDir, `${htmlFileName}.html`);
          } else {
            htmlPath = path.resolve(saveHtml);
            await fs.mkdir(path.dirname(htmlPath), { recursive: true });
          }
          await fs.writeFile(htmlPath, html, 'utf8');
          console.log(`Raw HTML written to ${htmlPath}`);
        }
      } catch (err) {
        console.error(`Failed to write output files for ${sourceLabel}: ${err.message}`);
        process.exit(1);
      }

      if (!parsed.competitions.length) {
        console.warn(`No competitions parsed from ${sourceLabel}.`);
      } else {
        console.log(
          `Parsed ${parsed.competitions.length} competition${
            parsed.competitions.length === 1 ? '' : 's'
          } from ${sourceLabel}`
        );
        for (const competition of parsed.competitions) {
          console.log(
            ` - ${competition.league || competition.heading} (${competition.rows.length} clubs)`
          );
        }
      }

      if (aggregateResults && isRangeSource) {
        const seasonInfo =
          buildSeasonRecordFromParsed(parsed, source.meta.seasonParts) ||
          buildEmptySeasonRecord(source.meta.seasonParts);
        if (seasonInfo) {
          aggregateResults.seasons[seasonInfo.seasonKey] = seasonInfo.record;
          await persistAggregate();
        } else {
          console.warn(`Unable to build aggregate record for ${sourceLabel}.`);
        }
      }

      results.push({ sourceLabel, outputPath: resolvedOutputPath, parsed });
    }

    if (results.length > 1) {
      console.log(`Processed ${results.length} sources successfully.`);
    }

    if (aggregateResults) {
      await persistAggregate();
    }
  });

program.parse(process.argv);
