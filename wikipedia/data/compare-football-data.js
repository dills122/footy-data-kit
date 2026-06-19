#!/usr/bin/env node

import { Command } from 'commander';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFootballData } from './generate-output-files.ts';
import { canonicalizeTeamName } from './data-quality-config.js';
import { getTierKeys as getTierKeysFromRules, sortSeasonKeys } from './season-rules.js';

const ROW_COMPARE_FIELDS = [
  'pos',
  'played',
  'won',
  'drawn',
  'lost',
  'goalsFor',
  'goalsAgainst',
  'goalDifference',
  'goalAverage',
  'points',
  'notes',
  'wasRelegated',
  'wasPromoted',
  'isExpansionTeam',
  'wasReElected',
  'wasReprieved',
  'outcomeStatus',
];

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function compareNameLists(before = [], after = []) {
  const beforeMap = new Map(before.map((name) => [canonicalizeTeamName(name), name]));
  const afterMap = new Map(after.map((name) => [canonicalizeTeamName(name), name]));

  const added = [];
  const removed = [];

  for (const [key, name] of afterMap) {
    if (!beforeMap.has(key)) added.push(name);
  }
  for (const [key, name] of beforeMap) {
    if (!afterMap.has(key)) removed.push(name);
  }

  return {
    added: added.sort(),
    removed: removed.sort(),
  };
}

function getTierKeys(record) {
  const source = asObject(record) || {};
  const keys = getTierKeysFromRules(source);
  return keys;
}

function getTableRows(tier) {
  if (Array.isArray(tier?.table) && tier.table.length) {
    return tier.table.filter((row) => row && typeof row === 'object');
  }
  if (Array.isArray(tier?.divisions)) {
    return tier.divisions.flatMap((division) => getTableRows(division));
  }
  return [];
}

function compareMetadata(before, after) {
  const left = asObject(before) || {};
  const right = asObject(after) || {};
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  const changedFields = [];

  for (const key of keys) {
    if (JSON.stringify(left[key]) !== JSON.stringify(right[key])) {
      changedFields.push(key);
    }
  }

  return changedFields.sort();
}

function compareTableRows(beforeRows, afterRows) {
  const beforeMap = new Map(beforeRows.map((row) => [canonicalizeTeamName(row.team), row]));
  const afterMap = new Map(afterRows.map((row) => [canonicalizeTeamName(row.team), row]));

  const addedTeams = [];
  const removedTeams = [];
  const positionChanges = [];
  const statChanges = [];

  for (const [teamKey, row] of afterMap) {
    if (!beforeMap.has(teamKey)) {
      addedTeams.push(row.team);
      continue;
    }

    const beforeRow = beforeMap.get(teamKey);
    if (beforeRow.pos !== row.pos) {
      positionChanges.push({
        team: row.team,
        before: beforeRow.pos,
        after: row.pos,
      });
    }

    const changedFields = ROW_COMPARE_FIELDS.filter(
      (field) => JSON.stringify(beforeRow[field]) !== JSON.stringify(row[field])
    );

    if (changedFields.length) {
      statChanges.push({
        team: row.team,
        fields: changedFields,
      });
    }
  }

  for (const [teamKey, row] of beforeMap) {
    if (!afterMap.has(teamKey)) {
      removedTeams.push(row.team);
    }
  }

  return {
    addedTeams: addedTeams.sort(),
    removedTeams: removedTeams.sort(),
    positionChanges: positionChanges.sort((a, b) => a.team.localeCompare(b.team)),
    statChanges: statChanges.sort((a, b) => a.team.localeCompare(b.team)),
  };
}

function compareTier(beforeTier, afterTier, tierKey) {
  const beforeRows = getTableRows(beforeTier);
  const afterRows = getTableRows(afterTier);
  const tableChanges = compareTableRows(beforeRows, afterRows);
  const promotedChanges = compareNameLists(beforeTier?.promoted, afterTier?.promoted);
  const relegatedChanges = compareNameLists(beforeTier?.relegated, afterTier?.relegated);
  const metadataChangedFields = compareMetadata(beforeTier?.metadata, afterTier?.metadata);

  const hasChanges =
    beforeRows.length !== afterRows.length ||
    tableChanges.addedTeams.length > 0 ||
    tableChanges.removedTeams.length > 0 ||
    tableChanges.positionChanges.length > 0 ||
    tableChanges.statChanges.length > 0 ||
    promotedChanges.added.length > 0 ||
    promotedChanges.removed.length > 0 ||
    relegatedChanges.added.length > 0 ||
    relegatedChanges.removed.length > 0 ||
    metadataChangedFields.length > 0;

  if (!hasChanges) return null;

  return {
    tierKey,
    beforeRowCount: beforeRows.length,
    afterRowCount: afterRows.length,
    ...tableChanges,
    promotedChanges,
    relegatedChanges,
    metadataChangedFields,
  };
}

function compareSeasonInfo(beforeRecord, afterRecord) {
  const beforeInfo = asObject(beforeRecord?.seasonInfo) || {};
  const afterInfo = asObject(afterRecord?.seasonInfo) || {};
  const promotedChanges = compareNameLists(beforeInfo.promoted, afterInfo.promoted);
  const relegatedChanges = compareNameLists(beforeInfo.relegated, afterInfo.relegated);
  const metadataChangedFields = compareMetadata(
    Object.fromEntries(
      Object.entries(beforeInfo).filter(([key]) => key !== 'promoted' && key !== 'relegated')
    ),
    Object.fromEntries(
      Object.entries(afterInfo).filter(([key]) => key !== 'promoted' && key !== 'relegated')
    )
  );

  if (
    !promotedChanges.added.length &&
    !promotedChanges.removed.length &&
    !relegatedChanges.added.length &&
    !relegatedChanges.removed.length &&
    !metadataChangedFields.length
  ) {
    return null;
  }

  return {
    promotedChanges,
    relegatedChanges,
    metadataChangedFields,
  };
}

export function diffFootballData(beforeDataset, afterDataset) {
  const beforeSeasons = asObject(beforeDataset?.seasons) || {};
  const afterSeasons = asObject(afterDataset?.seasons) || {};
  const beforeKeys = new Set(Object.keys(beforeSeasons));
  const afterKeys = new Set(Object.keys(afterSeasons));
  const allKeys = sortSeasonKeys(new Set([...beforeKeys, ...afterKeys]));

  const addedSeasons = [];
  const removedSeasons = [];
  const changedSeasons = [];

  for (const seasonKey of allKeys) {
    if (!beforeKeys.has(seasonKey)) {
      addedSeasons.push(seasonKey);
      continue;
    }
    if (!afterKeys.has(seasonKey)) {
      removedSeasons.push(seasonKey);
      continue;
    }

    const beforeRecord = beforeSeasons[seasonKey];
    const afterRecord = afterSeasons[seasonKey];
    const beforeTierKeys = new Set(getTierKeys(beforeRecord));
    const afterTierKeys = new Set(getTierKeys(afterRecord));
    const tierKeys = sortSeasonKeys(new Set([...beforeTierKeys, ...afterTierKeys]));

    const addedTiers = tierKeys.filter((key) => !beforeTierKeys.has(key));
    const removedTiers = tierKeys.filter((key) => !afterTierKeys.has(key));
    const changedTiers = tierKeys
      .filter((key) => beforeTierKeys.has(key) && afterTierKeys.has(key))
      .map((key) => compareTier(beforeRecord[key], afterRecord[key], key))
      .filter(Boolean);
    const seasonInfoChanges = compareSeasonInfo(beforeRecord, afterRecord);

    if (addedTiers.length || removedTiers.length || changedTiers.length || seasonInfoChanges) {
      changedSeasons.push({
        season: seasonKey,
        addedTiers,
        removedTiers,
        changedTiers,
        seasonInfoChanges,
      });
    }
  }

  return {
    summary: {
      beforeSeasonCount: Object.keys(beforeSeasons).length,
      afterSeasonCount: Object.keys(afterSeasons).length,
      addedSeasonCount: addedSeasons.length,
      removedSeasonCount: removedSeasons.length,
      changedSeasonCount: changedSeasons.length,
    },
    addedSeasons,
    removedSeasons,
    changedSeasons,
  };
}

export function compareFootballDataFiles(beforePath, afterPath) {
  return diffFootballData(loadFootballData(beforePath), loadFootballData(afterPath));
}

function summarizeChangedSeasons(changedSeasons, limit = 10) {
  return changedSeasons.slice(0, limit).map((season) => {
    const detailParts = [];

    if (season.addedTiers.length) detailParts.push(`added tiers: ${season.addedTiers.join(', ')}`);
    if (season.removedTiers.length)
      detailParts.push(`removed tiers: ${season.removedTiers.join(', ')}`);
    if (season.changedTiers.length)
      detailParts.push(`changed tiers: ${season.changedTiers.length}`);

    const seasonInfoChanges = season.seasonInfoChanges;
    if (seasonInfoChanges) {
      const seasonInfoBits = [];
      if (
        seasonInfoChanges.promotedChanges.added.length ||
        seasonInfoChanges.promotedChanges.removed.length
      ) {
        seasonInfoBits.push('promoted list');
      }
      if (
        seasonInfoChanges.relegatedChanges.added.length ||
        seasonInfoChanges.relegatedChanges.removed.length
      ) {
        seasonInfoBits.push('relegated list');
      }
      if (seasonInfoChanges.metadataChangedFields.length) {
        seasonInfoBits.push('season metadata');
      }
      if (seasonInfoBits.length) detailParts.push(`season info: ${seasonInfoBits.join(', ')}`);
    }

    return `- ${season.season}: ${detailParts.join(' | ') || 'record changed'}`;
  });
}

export function renderMarkdownSummary(diff, beforeDataset, afterDataset, options = {}) {
  const beforeMeta = asObject(beforeDataset?.metadata) || {};
  const afterMeta = asObject(afterDataset?.metadata) || {};
  const maxChangedSeasons = Number.isFinite(options.maxChangedSeasons)
    ? options.maxChangedSeasons
    : 10;
  const lines = [
    '# Release Diff Summary',
    '',
    '## Metadata',
    `- Previous generator: ${beforeMeta.generator || 'unknown'}`,
    `- Previous generatedAt: ${beforeMeta.generatedAt || 'unknown'}`,
    `- Previous gitSha: ${beforeMeta.gitSha || 'unknown'}`,
    `- Current generator: ${afterMeta.generator || 'unknown'}`,
    `- Current generatedAt: ${afterMeta.generatedAt || 'unknown'}`,
    `- Current gitSha: ${afterMeta.gitSha || 'unknown'}`,
    '',
    '## Summary',
    `- Seasons before: ${diff.summary.beforeSeasonCount}`,
    `- Seasons after: ${diff.summary.afterSeasonCount}`,
    `- Added seasons: ${diff.summary.addedSeasonCount}`,
    `- Removed seasons: ${diff.summary.removedSeasonCount}`,
    `- Changed seasons: ${diff.summary.changedSeasonCount}`,
  ];

  if (diff.addedSeasons.length) {
    lines.push(`- Added season keys: ${diff.addedSeasons.join(', ')}`);
  }
  if (diff.removedSeasons.length) {
    lines.push(`- Removed season keys: ${diff.removedSeasons.join(', ')}`);
  }

  lines.push('', '## Changed Seasons');
  if (!diff.changedSeasons.length) {
    lines.push('- No season-level differences detected.');
  } else {
    lines.push(...summarizeChangedSeasons(diff.changedSeasons, maxChangedSeasons));
    if (diff.changedSeasons.length > maxChangedSeasons) {
      lines.push(`- ...and ${diff.changedSeasons.length - maxChangedSeasons} more changed seasons`);
    }
  }

  return `${lines.join('\n')}\n`;
}

function printTextReport(diff, beforePath, afterPath) {
  const { summary, addedSeasons, removedSeasons, changedSeasons } = diff;
  console.log(`Compared ${beforePath} -> ${afterPath}`);
  console.log(
    `Seasons: ${summary.beforeSeasonCount} -> ${summary.afterSeasonCount} | added ${summary.addedSeasonCount} | removed ${summary.removedSeasonCount} | changed ${summary.changedSeasonCount}`
  );

  if (addedSeasons.length) {
    console.log(`Added seasons: ${addedSeasons.join(', ')}`);
  }
  if (removedSeasons.length) {
    console.log(`Removed seasons: ${removedSeasons.join(', ')}`);
  }

  for (const season of changedSeasons) {
    console.log(`\nSeason ${season.season}`);
    if (season.addedTiers.length) console.log(`  Added tiers: ${season.addedTiers.join(', ')}`);
    if (season.removedTiers.length)
      console.log(`  Removed tiers: ${season.removedTiers.join(', ')}`);
    if (season.seasonInfoChanges) {
      const { promotedChanges, relegatedChanges, metadataChangedFields } = season.seasonInfoChanges;
      if (promotedChanges.added.length || promotedChanges.removed.length) {
        console.log(
          `  Season info promoted: +${promotedChanges.added.join(', ') || '-'} | -${
            promotedChanges.removed.join(', ') || '-'
          }`
        );
      }
      if (relegatedChanges.added.length || relegatedChanges.removed.length) {
        console.log(
          `  Season info relegated: +${relegatedChanges.added.join(', ') || '-'} | -${
            relegatedChanges.removed.join(', ') || '-'
          }`
        );
      }
      if (metadataChangedFields.length) {
        console.log(`  Season info metadata fields changed: ${metadataChangedFields.join(', ')}`);
      }
    }

    for (const tier of season.changedTiers) {
      console.log(`  ${tier.tierKey}: rows ${tier.beforeRowCount} -> ${tier.afterRowCount}`);
      if (tier.addedTeams.length) console.log(`    Added teams: ${tier.addedTeams.join(', ')}`);
      if (tier.removedTeams.length)
        console.log(`    Removed teams: ${tier.removedTeams.join(', ')}`);
      if (tier.positionChanges.length) {
        console.log(
          `    Position changes: ${tier.positionChanges
            .map((entry) => `${entry.team} ${entry.before}->${entry.after}`)
            .join(', ')}`
        );
      }
      if (tier.statChanges.length) {
        console.log(
          `    Stat changes: ${tier.statChanges
            .map((entry) => `${entry.team} [${entry.fields.join(', ')}]`)
            .join(', ')}`
        );
      }
      if (tier.promotedChanges.added.length || tier.promotedChanges.removed.length) {
        console.log(
          `    Promoted: +${tier.promotedChanges.added.join(', ') || '-'} | -${
            tier.promotedChanges.removed.join(', ') || '-'
          }`
        );
      }
      if (tier.relegatedChanges.added.length || tier.relegatedChanges.removed.length) {
        console.log(
          `    Relegated: +${tier.relegatedChanges.added.join(', ') || '-'} | -${
            tier.relegatedChanges.removed.join(', ') || '-'
          }`
        );
      }
      if (tier.metadataChangedFields.length) {
        console.log(`    Metadata fields changed: ${tier.metadataChangedFields.join(', ')}`);
      }
    }
  }
}

export function runCli(argv = process.argv) {
  const program = new Command();

  program
    .name('compare-football-data')
    .description('Compare two FootballData JSON exports and report the release diff.')
    .argument('<before>', 'Path to the older FootballData export')
    .argument('<after>', 'Path to the newer FootballData export')
    .option('--json', 'Print the diff as JSON instead of a text summary', false)
    .option('--markdown', 'Print a markdown release summary instead of a text summary', false);

  program.parse(argv);

  const [before, after] = program.args;
  const { json, markdown } = program.opts();

  const beforePath = path.resolve(process.cwd(), before);
  const afterPath = path.resolve(process.cwd(), after);
  const beforeDataset = loadFootballData(beforePath);
  const afterDataset = loadFootballData(afterPath);
  const diff = diffFootballData(beforeDataset, afterDataset);

  if (json) {
    console.log(JSON.stringify(diff, null, 2));
    return diff;
  }

  if (markdown) {
    console.log(renderMarkdownSummary(diff, beforeDataset, afterDataset));
    return diff;
  }

  printTextReport(diff, beforePath, afterPath);
  return diff;
}

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectExecution) {
  runCli(process.argv);
}

export default {
  diffFootballData,
  compareFootballDataFiles,
  renderMarkdownSummary,
  runCli,
};
