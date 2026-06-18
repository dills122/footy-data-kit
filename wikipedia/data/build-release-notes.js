#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getTierKeys, sortSeasonKeys } from './season-rules.js';
import { loadFootballData } from './generate-output-files.ts';

const RELEASE_ASSETS = [
  'all-seasons.json',
  'all-seasons.min.json',
  'wiki_overview_tables_by_season.json',
  'wiki_overview_tables_by_season.min.json',
  'club-metadata.json',
  'release-diff.json',
  'release-diff.md',
  'release-notes.md',
];

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readOptionalMarkdown(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8').trim();
}

function stripTopHeading(markdown) {
  return markdown.replace(/^# .*(?:\r?\n)+/, '').trim();
}

function getSeasonRange(dataset) {
  const seasons = sortSeasonKeys(Object.keys(asObject(dataset?.seasons) || {}));
  if (!seasons.length) {
    return {
      firstSeason: 'unknown',
      latestSeason: 'unknown',
      seasonCount: 0,
    };
  }

  return {
    firstSeason: seasons[0],
    latestSeason: seasons[seasons.length - 1],
    seasonCount: seasons.length,
  };
}

function countTierTables(dataset) {
  const seasons = asObject(dataset?.seasons) || {};
  return Object.values(seasons).reduce((total, season) => total + getTierKeys(season).length, 0);
}

function summarizeClubMetadata(clubMetadata) {
  const clubs = asObject(clubMetadata?.clubs) || {};
  const counts = {
    total: Object.keys(clubs).length,
    active: 0,
    historical: 0,
    unknown: 0,
    withLifecycleEvents: 0,
    withAbsenceExplanations: 0,
  };

  for (const club of Object.values(clubs)) {
    const status = club?.status?.current || 'unknown';
    if (status === 'active') {
      counts.active += 1;
    } else if (status === 'historical') {
      counts.historical += 1;
    } else {
      counts.unknown += 1;
    }

    if (Array.isArray(club?.history?.lifecycleEvents) && club.history.lifecycleEvents.length) {
      counts.withLifecycleEvents += 1;
    }
    if (
      Array.isArray(club?.history?.absenceExplanations) &&
      club.history.absenceExplanations.length
    ) {
      counts.withAbsenceExplanations += 1;
    }
  }

  return counts;
}

function summarizeChangedSeason(season) {
  const details = [];
  if (season.addedTiers?.length) details.push(`added ${season.addedTiers.join(', ')}`);
  if (season.removedTiers?.length) details.push(`removed ${season.removedTiers.join(', ')}`);
  if (season.changedTiers?.length) details.push(`${season.changedTiers.length} changed tier(s)`);

  const seasonInfo = season.seasonInfoChanges;
  if (seasonInfo) {
    const listChanges = [];
    if (seasonInfo.promotedChanges?.added?.length || seasonInfo.promotedChanges?.removed?.length) {
      listChanges.push('promoted list');
    }
    if (seasonInfo.relegatedChanges?.added?.length || seasonInfo.relegatedChanges?.removed?.length) {
      listChanges.push('relegated list');
    }
    if (seasonInfo.metadataChangedFields?.length) {
      listChanges.push('season metadata');
    }
    if (listChanges.length) details.push(listChanges.join(', '));
  }

  return `- ${season.season}: ${details.join('; ') || 'record changed'}`;
}

function renderDataChangeSummary(diff) {
  const lines = [
    '## Data Change Summary',
    '',
    `- Seasons before: ${diff.summary.beforeSeasonCount}`,
    `- Seasons after: ${diff.summary.afterSeasonCount}`,
    `- Added seasons: ${diff.summary.addedSeasonCount}`,
    `- Removed seasons: ${diff.summary.removedSeasonCount}`,
    `- Changed seasons: ${diff.summary.changedSeasonCount}`,
  ];

  if (diff.addedSeasons?.length) {
    lines.push(`- Added season keys: ${diff.addedSeasons.join(', ')}`);
  }
  if (diff.removedSeasons?.length) {
    lines.push(`- Removed season keys: ${diff.removedSeasons.join(', ')}`);
  }

  lines.push('');
  if (!diff.changedSeasons?.length) {
    lines.push('No season-table changes were detected after regenerating the release data.');
  } else {
    lines.push('Changed seasons:');
    lines.push(...diff.changedSeasons.slice(0, 12).map(summarizeChangedSeason));
    if (diff.changedSeasons.length > 12) {
      lines.push(`- ...and ${diff.changedSeasons.length - 12} more changed season(s).`);
    }
  }

  return lines;
}

export function renderReleaseNotes({
  tag,
  diff,
  currentDataset,
  clubMetadata,
  manualMarkdown = '',
}) {
  const seasonRange = getSeasonRange(currentDataset);
  const clubSummary = summarizeClubMetadata(clubMetadata);
  const manualBody = stripTopHeading(manualMarkdown);
  const lines = [`# footy-data-kit ${tag}`, ''];

  if (manualBody) {
    lines.push(manualBody, '');
  } else {
    lines.push(
      'This release refreshes the generated English football data package and publishes the current validated JSON assets.',
      ''
    );
  }

  lines.push(
    '## Published Data',
    '',
    `- Season coverage: ${seasonRange.firstSeason}-${seasonRange.latestSeason} (${seasonRange.seasonCount} season records)`,
    `- League table records: ${countTierTables(currentDataset)} tier tables`,
    `- Club metadata records: ${clubSummary.total}`,
    `- Club status split: ${clubSummary.active} active, ${clubSummary.historical} historical, ${clubSummary.unknown} unknown`,
    `- Clubs with source-backed lifecycle events: ${clubSummary.withLifecycleEvents}`,
    `- Clubs with tracked absence explanations: ${clubSummary.withAbsenceExplanations}`,
    '',
    ...renderDataChangeSummary(diff),
    '',
    '## Validation',
    '',
    'Release data is regenerated from the Wikipedia overview pipeline and checked before publishing.',
    '',
    '- Jest unit tests',
    '- Wikipedia integration tests',
    '- ESLint',
    '- Prettier format check',
    '- FootballData structural validation',
    '- Club continuity and historical-reason validation',
    '- Table points-order validation, with the known 2019-20 points-per-game tiers explicitly exempted',
    '',
    '## Assets',
    '',
    ...RELEASE_ASSETS.map((asset) => `- \`${asset}\``),
    '',
    'The detailed machine diff is attached as `release-diff.json`; the compact markdown diff is attached as `release-diff.md`.'
  );

  return `${lines.join('\n')}\n`;
}

export function buildReleaseNotes({
  tag,
  diffPath,
  currentPath,
  clubMetadataPath,
  manualPath,
  outputPath,
}) {
  const diff = readJson(diffPath);
  const currentDataset = loadFootballData(currentPath);
  const clubMetadata = readJson(clubMetadataPath);
  const manualMarkdown = readOptionalMarkdown(manualPath);
  const notes = renderReleaseNotes({
    tag,
    diff,
    currentDataset,
    clubMetadata,
    manualMarkdown,
  });

  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, notes);
  }

  return notes;
}

export function runCli(argv = process.argv) {
  const program = new Command();
  program
    .name('build-release-notes')
    .description('Build user-facing release notes from a curated note plus generated release facts.')
    .requiredOption('--tag <tag>', 'Release tag, for example v0.8.2')
    .requiredOption('--diff <path>', 'Path to release-diff.json')
    .requiredOption('--current <path>', 'Path to the generated all-seasons.json file')
    .requiredOption('--club-metadata <path>', 'Path to the generated club-metadata.json file')
    .option('--manual <path>', 'Optional curated release note markdown')
    .option('--output <path>', 'Optional path to write release-notes.md');

  program.parse(argv);
  const options = program.opts();
  const notes = buildReleaseNotes({
    tag: options.tag,
    diffPath: path.resolve(process.cwd(), options.diff),
    currentPath: path.resolve(process.cwd(), options.current),
    clubMetadataPath: path.resolve(process.cwd(), options.clubMetadata),
    manualPath: options.manual ? path.resolve(process.cwd(), options.manual) : null,
    outputPath: options.output ? path.resolve(process.cwd(), options.output) : null,
  });

  if (!options.output) {
    process.stdout.write(notes);
  }

  return notes;
}

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectExecution) {
  runCli(process.argv);
}

export default {
  buildReleaseNotes,
  renderReleaseNotes,
  runCli,
};
