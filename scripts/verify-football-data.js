#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'node:fs';
import path from 'node:path';
import { loadFootballData } from '../wikipedia/generate-output-files.js';

const program = new Command();

program
  .name('verify-football-data')
  .description('Scan FootballData JSON files for seasons and tiers that may need attention.')
  .argument(
    '[targets...]',
    'JSON files or directories containing FootballData exports (defaults to ./data-output)'
  )
  .option('-d, --data-dir <dir>', 'Directory to scan when no targets are supplied', './data-output')
  .option('--fail-on-issues', 'Exit with code 1 if any issues are detected', false)
  .parse(process.argv);

const options = program.opts();
const suppliedTargets = program.args.length ? program.args : [options.dataDir];

const filesToCheck = expandTargets(suppliedTargets);
if (!filesToCheck.length) {
  program.error('No JSON files found to inspect.');
}

let totalIssues = 0;
for (const filePath of filesToCheck) {
  const report = analyzeFile(filePath);
  totalIssues += report.issues.length;
  printReport(report);
}

if (options.failOnIssues && totalIssues > 0) {
  process.exitCode = 1;
}

/**
 * @param {string[]} targets
 */
function expandTargets(targets) {
  /** @type {string[]} */
  const files = [];
  const seen = new Set();

  for (const target of targets) {
    const resolved = path.resolve(process.cwd(), target);
    if (!fs.existsSync(resolved)) {
      console.warn(`Skipping missing path: ${target}`);
      continue;
    }

    const stats = fs.statSync(resolved);
    if (stats.isDirectory()) {
      for (const entry of fs.readdirSync(resolved)) {
        const child = path.join(resolved, entry);
        if (fs.statSync(child).isFile() && entry.toLowerCase().endsWith('.json')) {
          if (!seen.has(child)) {
            files.push(child);
            seen.add(child);
          }
        }
      }
    } else if (stats.isFile() && resolved.toLowerCase().endsWith('.json')) {
      if (!seen.has(resolved)) {
        files.push(resolved);
        seen.add(resolved);
      }
    } else {
      console.warn(`Skipping unsupported path: ${target}`);
    }
  }

  return files.sort();
}

/**
 * @param {string} filePath
 */
function analyzeFile(filePath) {
  const dataset = loadFootballData(filePath);
  const seasonEntries = Object.entries(dataset.seasons);

  /** @type {Array<Issue>} */
  const issues = [];

  for (const [seasonKey, seasonValue] of seasonEntries) {
    const tierEntries = Object.entries(seasonValue).filter(([key]) => /^tier/i.test(key));
    /** @type {Array<TierAnalysis>} */
    const tierAnalyses = tierEntries.map(([tierKey, tierValue]) =>
      analyzeTier(seasonKey, tierKey, tierValue)
    );

    const seasonHasContent = tierAnalyses.some((entry) => entry.hasContent);
    if (!tierEntries.length || !seasonHasContent) {
      issues.push({
        type: 'missing-season-data',
        file: filePath,
        season: seasonKey,
        message: 'No tier table/promoted/relegated data detected for this season',
      });
      continue;
    }

    for (const tierAnalysis of tierAnalyses) {
      issues.push(...tierAnalysis.issues);
    }
  }

  issues.sort((a, b) => {
    const seasonCompare = compareSeasonKeys(a.season, b.season);
    if (seasonCompare !== 0) return seasonCompare;
    if (a.tier && b.tier) return a.tier.localeCompare(b.tier);
    if (a.tier) return -1;
    if (b.tier) return 1;
    return a.type.localeCompare(b.type);
  });

  return {
    filePath,
    seasonCount: seasonEntries.length,
    issues,
  };
}

/**
 * @param {string} seasonKey
 * @param {string} tierKey
 * @param {import('../wikipedia/models/output-file').TierData | import('../wikipedia/models/output-file').LeagueTableEntry[]} tierValue
 * @returns {TierAnalysis}
 */
function analyzeTier(seasonKey, tierKey, tierValue) {
  const tierMeta = extractTierMeta(tierValue, seasonKey);
  const tierIssues = [];

  if (!tierMeta.hasContent) {
    tierIssues.push(
      createIssue({
        type: 'empty-tier',
        season: seasonKey,
        tier: tierKey,
        message: 'Tier has no table rows or outcome lists',
      })
    );
  }

  if (
    tierMeta.seasonNumber != null &&
    tierMeta.seasonNumber !== tierMeta.normalisedSeasonKey &&
    tierMeta.normalisedSeasonKey != null
  ) {
    tierIssues.push(
      createIssue({
        type: 'season-mismatch',
        season: seasonKey,
        tier: tierKey,
        message: `Tier season (${tierMeta.seasonNumber}) does not match key ${tierMeta.normalisedSeasonKey}`,
      })
    );
  }

  const duplicateTeams = findDuplicates(
    tierMeta.table.map((row) => row.team),
    normalizeName
  );
  if (duplicateTeams.length) {
    tierIssues.push(
      createIssue({
        type: 'duplicate-teams',
        season: seasonKey,
        tier: tierKey,
        message: `Duplicate teams detected: ${duplicateTeams.join(', ')}`,
      })
    );
  }

  const duplicatePositions = findDuplicates(
    tierMeta.table.map((row) => row.pos).filter((pos) => Number.isFinite(pos))
  );
  if (duplicatePositions.length) {
    tierIssues.push(
      createIssue({
        type: 'duplicate-positions',
        season: seasonKey,
        tier: tierKey,
        message: `Duplicate position values detected: ${duplicatePositions.join(', ')}`,
      })
    );
  }

  const statMismatchRows = tierMeta.table
    .filter((row) => Number.isFinite(row.played))
    .filter((row) => row.played !== row.won + row.drawn + row.lost)
    .map((row) => row.team);

  if (statMismatchRows.length) {
    tierIssues.push(
      createIssue({
        type: 'match-count-mismatch',
        season: seasonKey,
        tier: tierKey,
        message: `Played totals do not equal won+drawn+lost for: ${statMismatchRows.join(', ')}`,
      })
    );
  }

  const goalDiffMismatch = tierMeta.table
    .filter((row) => row.goalDifference != null)
    .filter((row) => row.goalDifference !== row.goalsFor - row.goalsAgainst)
    .map((row) => row.team);

  if (goalDiffMismatch.length) {
    tierIssues.push(
      createIssue({
        type: 'goal-diff-mismatch',
        season: seasonKey,
        tier: tierKey,
        message: `Goal difference does not equal GF-GA for: ${goalDiffMismatch.join(', ')}`,
      })
    );
  }

  if (tierMeta.hasExplicitPromotedList) {
    const flaggedPromoted = tierMeta.table.filter((row) => row.wasPromoted).map((row) => row.team);
    const missingPromoted = flaggedPromoted.filter(
      (team) => !tierMeta.promoted.some((listed) => namesMatch(listed, team))
    );
    const unknownPromoted = tierMeta.promoted.filter(
      (team) => !tierMeta.table.some((row) => namesMatch(row.team, team))
    );

    if (missingPromoted.length) {
      tierIssues.push(
        createIssue({
          type: 'promoted-mismatch',
          season: seasonKey,
          tier: tierKey,
          message: `Promoted list missing flagged teams: ${missingPromoted.join(', ')}`,
        })
      );
    }
    if (unknownPromoted.length) {
      tierIssues.push(
        createIssue({
          type: 'promoted-unknown',
          season: seasonKey,
          tier: tierKey,
          message: `Promoted list includes teams not in table: ${unknownPromoted.join(', ')}`,
        })
      );
    }
  }

  if (tierMeta.hasExplicitRelegatedList) {
    const flaggedRelegated = tierMeta.table
      .filter((row) => row.wasRelegated)
      .map((row) => row.team);
    const missingRelegated = flaggedRelegated.filter(
      (team) => !tierMeta.relegated.some((listed) => namesMatch(listed, team))
    );
    const unknownRelegated = tierMeta.relegated.filter(
      (team) => !tierMeta.table.some((row) => namesMatch(row.team, team))
    );

    if (missingRelegated.length) {
      tierIssues.push(
        createIssue({
          type: 'relegated-mismatch',
          season: seasonKey,
          tier: tierKey,
          message: `Relegated list missing flagged teams: ${missingRelegated.join(', ')}`,
        })
      );
    }
    if (unknownRelegated.length) {
      tierIssues.push(
        createIssue({
          type: 'relegated-unknown',
          season: seasonKey,
          tier: tierKey,
          message: `Relegated list includes teams not in table: ${unknownRelegated.join(', ')}`,
        })
      );
    }
  }

  return {
    hasContent: tierMeta.hasContent,
    issues: tierIssues,
  };
}

/**
 * @param {import('../wikipedia/models/output-file').TierData | import('../wikipedia/models/output-file').LeagueTableEntry[]} tierValue
 * @param {string} seasonKey
 */
function extractTierMeta(tierValue, seasonKey) {
  const table = Array.isArray(tierValue)
    ? tierValue
    : Array.isArray(tierValue.table)
    ? tierValue.table
    : [];
  const promoted =
    !Array.isArray(tierValue) && Array.isArray(tierValue.promoted) ? tierValue.promoted : [];
  const relegated =
    !Array.isArray(tierValue) && Array.isArray(tierValue.relegated) ? tierValue.relegated : [];
  const hasExplicitPromotedList = !Array.isArray(tierValue) && Array.isArray(tierValue.promoted);
  const hasExplicitRelegatedList = !Array.isArray(tierValue) && Array.isArray(tierValue.relegated);

  const normSeason = parseSeasonNumber(seasonKey);

  return {
    table,
    promoted,
    relegated,
    hasExplicitPromotedList,
    hasExplicitRelegatedList,
    hasContent: Boolean(table.length || promoted.length || relegated.length),
    seasonNumber:
      !Array.isArray(tierValue) && typeof tierValue.season === 'number' ? tierValue.season : null,
    normalisedSeasonKey: normSeason,
  };
}

/**
 * @param {IssueInput} input
 * @returns {Issue}
 */
function createIssue(input) {
  return {
    season: input.season,
    tier: input.tier,
    type: input.type,
    message: input.message,
  };
}

/**
 * @param {number | string | null | undefined} value
 */
function normalizeName(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

/**
 * @template T
 * @param {T[]} values
 * @param {(value: T) => string | number | null | undefined} [normalizer]
 * @returns {Array<string | number>}
 */
function findDuplicates(values, normalizer) {
  const counts = new Map();
  const originals = new Map();

  for (const value of values) {
    const key = normalizer ? normalizer(value) : value;
    if (key == null && key !== 0) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!originals.has(key)) {
      originals.set(key, value);
    }
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => originals.get(key));
}

/**
 * @param {string} seasonA
 * @param {string} seasonB
 */
function compareSeasonKeys(seasonA, seasonB) {
  const numA = parseSeasonNumber(seasonA);
  const numB = parseSeasonNumber(seasonB);
  if (numA != null && numB != null) {
    return numA - numB;
  }
  return seasonA.localeCompare(seasonB);
}

/**
 * @param {string} seasonKey
 */
function parseSeasonNumber(seasonKey) {
  const numeric = Number.parseInt(String(seasonKey), 10);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * @param {string} a
 * @param {string} b
 */
function namesMatch(a, b) {
  return normalizeName(a) === normalizeName(b);
}

/**
 * @param {FileReport} report
 */
function printReport(report) {
  const relativePath = path.relative(process.cwd(), report.filePath);
  console.log(`\n${relativePath}`);
  console.log(`  Seasons scanned: ${report.seasonCount}`);

  if (!report.issues.length) {
    console.log('  No issues detected ✅');
    return;
  }

  console.log(`  Issues found: ${report.issues.length}`);
  for (const issue of report.issues) {
    const tierLabel = issue.tier ? ` ${issue.tier}` : '';
    console.log(`    [${issue.type}] ${issue.season}${tierLabel} – ${issue.message}`);
  }
}

/**
 * @typedef {Object} FileReport
 * @property {string} filePath
 * @property {number} seasonCount
 * @property {Issue[]} issues
 *
 * @typedef {Object} Issue
 * @property {string} season
 * @property {string} [tier]
 * @property {string} type
 * @property {string} message
 *
 * @typedef {Object} TierAnalysis
 * @property {boolean} hasContent
 * @property {Issue[]} issues
 *
 * @typedef {Object} IssueInput
 * @property {string} season
 * @property {string} [tier]
 * @property {string} type
 * @property {string} message
 */
