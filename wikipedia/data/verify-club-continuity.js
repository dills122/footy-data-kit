#!/usr/bin/env node
// @ts-check

import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFootballData } from './generate-output-files.js';
import { isHistoricalPlaceholderSeason, parseSeasonNumber, sortSeasonKeys } from './season-rules.js';

const DEFAULT_DATASET_FILE = './data-output/all-seasons.json';
const DEFAULT_CLUB_METADATA_FILE = './data/club-metadata.json';

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getSeasonNumbers(dataset) {
  return sortSeasonKeys(Object.keys(dataset?.seasons || {}))
    .map(parseSeasonNumber)
    .filter(Number.isInteger);
}

function getOfficialPausedSeasons(dataset) {
  const pausedSeasons = new Set();
  for (const [seasonKey, seasonRecord] of Object.entries(dataset?.seasons || {})) {
    const seasonNumber = parseSeasonNumber(seasonKey);
    if (seasonNumber == null) continue;
    const seasonInfo = seasonRecord?.seasonInfo || {};
    if (
      isHistoricalPlaceholderSeason(seasonRecord, seasonKey) ||
      seasonInfo.officialLeagueTables === false ||
      seasonInfo.officialCompetitionsSuspended === true ||
      seasonInfo.officialCompetitionsAbandoned === true ||
      seasonInfo.regionalBridgeSeason === true
    ) {
      pausedSeasons.add(seasonNumber);
    }
  }
  return pausedSeasons;
}

function seasonIsCoveredByAbsenceExplanation(season, explanations = []) {
  return explanations.some((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const fromSeason = parseSeasonNumber(entry.fromSeason);
    const toSeason = entry.toSeason == null ? fromSeason : parseSeasonNumber(entry.toSeason);
    if (fromSeason == null || toSeason == null) return false;
    return season >= fromSeason && season <= toSeason;
  });
}

function groupConsecutiveSeasons(seasons) {
  const sortedSeasons = [...seasons].sort((a, b) => a - b);
  const groups = [];
  let startSeason = null;
  let previousSeason = null;

  for (const season of sortedSeasons) {
    if (startSeason == null) {
      startSeason = season;
      previousSeason = season;
      continue;
    }

    if (season === previousSeason + 1) {
      previousSeason = season;
      continue;
    }

    groups.push({ startSeason, endSeason: previousSeason });
    startSeason = season;
    previousSeason = season;
  }

  if (startSeason != null && previousSeason != null) {
    groups.push({ startSeason, endSeason: previousSeason });
  }

  return groups;
}

function getMembershipEndSeason(membership, latestSeason) {
  const explicitEndSeason = parseSeasonNumber(membership?.toSeason);
  if (explicitEndSeason != null) return explicitEndSeason;
  return latestSeason;
}

function createGapIssue({ clubKey, club, membership, missingSeasons }) {
  return {
    type: 'unexplained-club-gap',
    clubKey,
    clubId: club.clubId || null,
    canonicalName: club.canonicalName,
    fromSeason: missingSeasons[0],
    toSeason: missingSeasons[missingSeasons.length - 1],
    missingSeasons,
    trackedFromSeason: membership.fromSeason,
    trackedToSeason: membership.toSeason ?? null,
    suggestedReason: 'unknown',
    message: `${club.canonicalName} is expected in tracked membership but is missing ${missingSeasons.length} season(s)`,
  };
}

function analyzeClubContinuityForRecord({
  clubKey,
  club,
  availableSeasons,
  latestSeason,
  officialPausedSeasons,
}) {
  const observedSeasons = new Set(club?.derived?.seasonsSeen || []);
  const memberships = Array.isArray(club?.history?.trackedMembership)
    ? club.history.trackedMembership
    : [];
  const absenceExplanations = Array.isArray(club?.history?.absenceExplanations)
    ? club.history.absenceExplanations
    : [];
  const issues = [];

  for (const membership of memberships) {
    const fromSeason = parseSeasonNumber(membership?.fromSeason);
    const toSeason = getMembershipEndSeason(membership, latestSeason);
    if (fromSeason == null || toSeason == null || toSeason < fromSeason) continue;

    const missingSeasons = [];
    for (const season of availableSeasons) {
      if (season < fromSeason || season > toSeason) continue;
      if (observedSeasons.has(season)) continue;
      if (officialPausedSeasons.has(season)) continue;
      if (seasonIsCoveredByAbsenceExplanation(season, absenceExplanations)) continue;
      missingSeasons.push(season);
    }

    for (const group of groupConsecutiveSeasons(missingSeasons)) {
      const groupedSeasons = [];
      for (let season = group.startSeason; season <= group.endSeason; season += 1) {
        groupedSeasons.push(season);
      }
      issues.push(createGapIssue({ clubKey, club, membership, missingSeasons: groupedSeasons }));
    }
  }

  return issues;
}

export function analyzeClubContinuity(dataset, clubMetadata) {
  const clubs = clubMetadata?.clubs || {};
  const availableSeasons = getSeasonNumbers(dataset);
  const latestSeason = availableSeasons[availableSeasons.length - 1] ?? null;
  const officialPausedSeasons = getOfficialPausedSeasons(dataset);
  const issues = [];

  for (const [clubKey, club] of Object.entries(clubs)) {
    if (!club || typeof club !== 'object') continue;
    issues.push(
      ...analyzeClubContinuityForRecord({
        clubKey,
        club,
        availableSeasons,
        latestSeason,
        officialPausedSeasons,
      })
    );
  }

  return issues.sort((a, b) => {
    if (a.fromSeason !== b.fromSeason) return a.fromSeason - b.fromSeason;
    return a.clubKey.localeCompare(b.clubKey);
  });
}

export function analyzeClubContinuityFiles({
  datasetPath = DEFAULT_DATASET_FILE,
  clubMetadataPath = DEFAULT_CLUB_METADATA_FILE,
  cwd = process.cwd(),
} = {}) {
  const resolvedDatasetPath = path.resolve(cwd, datasetPath);
  const resolvedClubMetadataPath = path.resolve(cwd, clubMetadataPath);
  const dataset = loadFootballData(resolvedDatasetPath);
  const clubMetadata = loadJson(resolvedClubMetadataPath);
  const issues = analyzeClubContinuity(dataset, clubMetadata);

  return {
    datasetPath: resolvedDatasetPath,
    clubMetadataPath: resolvedClubMetadataPath,
    clubCount: Object.keys(clubMetadata?.clubs || {}).length,
    issueCount: issues.length,
    issues,
  };
}

export function runCli(argv = process.argv) {
  const program = new Command();

  program
    .name('verify-club-continuity')
    .description('Report club metadata continuity gaps against a FootballData season export.')
    .option('-d, --dataset <file>', 'FootballData JSON dataset file', DEFAULT_DATASET_FILE)
    .option(
      '-c, --club-metadata <file>',
      'Club metadata sidecar JSON file',
      DEFAULT_CLUB_METADATA_FILE
    )
    .option('--json', 'Print machine-readable JSON output', false)
    .option('--fail-on-issues', 'Exit non-zero when continuity issues are found', false);

  program.parse(argv);
  const options = program.opts();
  const report = analyzeClubContinuityFiles({
    datasetPath: options.dataset,
    clubMetadataPath: options.clubMetadata,
    cwd: process.cwd(),
  });

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Club metadata records scanned: ${report.clubCount}`);
    if (!report.issues.length) {
      console.log('No club continuity issues detected ✅');
    } else {
      console.log(`Club continuity issues detected: ${report.issues.length}`);
      for (const issue of report.issues) {
        const seasonLabel =
          issue.fromSeason === issue.toSeason
            ? String(issue.fromSeason)
            : `${issue.fromSeason}-${issue.toSeason}`;
        console.log(`- ${issue.canonicalName} (${issue.clubId || issue.clubKey}): ${seasonLabel}`);
      }
    }
  }

  if (options.failOnIssues && report.issues.length) {
    process.exitCode = 1;
  }

  return report;
}

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectExecution) {
  runCli(process.argv);
}

export default {
  analyzeClubContinuity,
  analyzeClubContinuityFiles,
  runCli,
};
