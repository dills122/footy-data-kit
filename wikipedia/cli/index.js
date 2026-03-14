#!/usr/bin/env node
import { Command } from 'commander';
import { isWikipediaWarSuspensionYear, WIKIPEDIA_DATA_SOURCES } from '../config.js';
import { loadFootballData } from '../data/generate-output-files.js';
import {
  buildSeasonOverview,
  buildSeasonOverviewForSlug,
  buildSeasonOverviewSlug,
} from '../builders/parse-ext-season-overview-pages.js';
import { buildPromotionRelegation } from '../builders/parse-season-pages.js';
import {
  addYearOptions,
  buildCommonRunOptions,
  buildDatasetOutput,
  installInterruptHandler,
  parseSeasonRange,
} from './shared.js';

const program = new Command();

program
  .name('wiki-league')
  .description('CLI tool to generate historical English league data from Wikipedia')
  .version('1.0.0');

async function buildPromotionData(opts) {
  const { startYear, endYear } = parseSeasonRange(opts, { start: '1888', end: '2000' });
  const outputFile = buildDatasetOutput(WIKIPEDIA_DATA_SOURCES.promotion.key, opts.output);

  console.log(`🏁 Generating data from ${startYear} to ${endYear}...`);
  installInterruptHandler();

  await buildPromotionRelegation(startYear, endYear, outputFile, buildCommonRunOptions(opts));
  console.log(`\n📂 Final output written to ${outputFile}`);
}

async function buildOverviewData(opts) {
  const { startYear, endYear } = parseSeasonRange(opts, { start: '2008', end: '2008' });
  const outputFile = buildDatasetOutput(WIKIPEDIA_DATA_SOURCES.overview.key, opts.output);

  console.log(`🏁 Generating overview data from ${startYear} to ${endYear}...`);
  installInterruptHandler();

  await buildSeasonOverview(startYear, endYear, outputFile, buildCommonRunOptions(opts));
  console.log(`\n📂 Final overview output written to ${outputFile}`);
}

async function buildCombinedData(opts) {
  const { startYear, endYear } = parseSeasonRange(opts, { start: '1888', end: '2000' });
  const { updateOnly, forceUpdate, ignoreWarYears } = buildCommonRunOptions(opts);
  const promoOutput = buildDatasetOutput(WIKIPEDIA_DATA_SOURCES.promotion.key, opts.output);
  const overviewOutput = buildDatasetOutput(WIKIPEDIA_DATA_SOURCES.overview.key, opts.output);

  console.log(`🏁 Combined fetch from ${startYear} to ${endYear}...`);
  installInterruptHandler();

  await buildPromotionRelegation(startYear, endYear, promoOutput, {
    updateOnly,
    forceUpdate,
    ignoreWarYears,
  });

  if (forceUpdate) {
    await buildSeasonOverview(startYear, endYear, overviewOutput, {
      updateOnly: false,
      forceUpdate: true,
      ignoreWarYears,
    });
  } else {
    const promoData = loadFootballData(promoOutput);
    const missingSeasons = [];
    for (let year = startYear; year <= endYear; year++) {
      if (ignoreWarYears && isWikipediaWarSuspensionYear(year)) continue;
      const record = promoData.seasons?.[String(year)];
      const tier1Table = record?.tier1?.table;
      if (!Array.isArray(tier1Table) || tier1Table.length === 0) {
        missingSeasons.push(year);
      }
    }

    if (missingSeasons.length) {
      console.log(`\n🔄 Running overview fallback for seasons: ${missingSeasons.join(', ')}`);
      for (const year of missingSeasons) {
        const slug = buildSeasonOverviewSlug(year);
        await buildSeasonOverviewForSlug(slug, overviewOutput);
      }
    } else {
      console.log('\n✅ No overview fallback required; promotion data exists for all seasons.');
    }
  }

  console.log(`\n📂 Promotion/relegation data: ${promoOutput}`);
  console.log(`📂 Overview tables: ${overviewOutput}`);
}

const buildCommand = program
  .command('build')
  .description('Build legacy promotion/relegation dataset between given start and end years');
addYearOptions(buildCommand, { start: '1888', end: '2000' });
buildCommand.action(buildPromotionData);

const overviewCommand = program
  .command('overview')
  .description('Build the primary maintained overview dataset between given start and end years');
addYearOptions(overviewCommand, { start: '2008', end: '2008' });
overviewCommand.action(buildOverviewData);

const combinedCommand = program
  .command('combined')
  .description(
    'Legacy bridge flow: build promotion/relegation data first, then fallback to overview tables for missing seasons'
  );
addYearOptions(combinedCommand, { start: '1888', end: '2000' });
combinedCommand.action(buildCombinedData);

program.parse(process.argv);
