#!/usr/bin/env node
// @ts-check

import Mustache from 'mustache';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import prettier from 'prettier';

const REPO_OWNER = 'dills122';
const REPO_NAME = 'footy-data-kit';
const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;
const RAW_MAIN_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main`;
const ROOT_DIR = process.cwd();
const TEMPLATE_PATH = path.join(ROOT_DIR, 'docs/index.template.html');
const OUTPUT_PATH = path.join(ROOT_DIR, 'docs/index.html');
const SITE_DATA_PATH = path.join(ROOT_DIR, 'docs/site-data.json');
const PRETTIER_OPTIONS = prettier.resolveConfig.sync(ROOT_DIR) || {};

function formatGenerated(source, options) {
  return prettier.format(source, {
    ...PRETTIER_OPTIONS,
    ...options,
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, filePath), 'utf8'));
}

function getFileSize(filePath) {
  return fs.statSync(path.join(ROOT_DIR, filePath)).size;
}

function formatBytes(bytes) {
  const units = ['B', 'K', 'M', 'G'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  if (unitIndex === 0) return `${value}B`;
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)}${units[unitIndex]}`;
}

function parseVersion(tag) {
  return tag
    .replace(/^v/, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compareTagsDescending(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const diff = (rightParts[index] || 0) - (leftParts[index] || 0);
    if (diff !== 0) return diff;
  }
  return right.localeCompare(left);
}

function getGitTags() {
  try {
    return execFileSync('git', ['tag', '--list', 'v*'], { cwd: ROOT_DIR, encoding: 'utf8' })
      .split('\n')
      .map((tag) => tag.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getCurrentReleaseTag(packageVersion, gitTags) {
  const envTag = process.env.DOCS_RELEASE_TAG || process.env.GITHUB_REF_NAME || '';
  if (/^v\d+\.\d+\.\d+/.test(envTag)) return envTag;
  return [...new Set([`v${packageVersion}`, ...gitTags])].sort(compareTagsDescending)[0];
}

function getTierCount(seasonRecord) {
  return Object.keys(seasonRecord || {}).filter((key) => /^tier\d+$/.test(key)).length;
}

function buildRelease(tag, summary) {
  return {
    tag,
    summary,
    notesUrl: `${REPO_URL}/releases/tag/${tag}`,
    zipUrl: `${REPO_URL}/releases/download/${tag}/footy-data-kit-${tag}-data.zip`,
  };
}

function buildSiteData() {
  const packageJson = readJson('package.json');
  const allSeasons = readJson('data-output/all-seasons.json');
  const clubMetadata = readJson('data/club-metadata.json');
  const seasonYears = Object.keys(allSeasons.seasons || {})
    .map((season) => Number.parseInt(season, 10))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  const firstSeason = seasonYears[0];
  const latestSeason = seasonYears[seasonYears.length - 1];
  const latestSeasonRecord = allSeasons.seasons?.[String(latestSeason)];
  const seasonCount = seasonYears.length;
  const clubCount = Object.keys(clubMetadata.clubs || {}).length;
  const latestTierCount = getTierCount(latestSeasonRecord);
  const gitTags = getGitTags();
  const currentTag = getCurrentReleaseTag(packageJson.version, gitTags);
  const tags = [...new Set([currentTag, ...gitTags])].sort(compareTagsDescending);
  const releaseSummary = `${firstSeason}-${latestSeason}. ${seasonCount} seasons. ${clubCount} club metadata records.`;
  const latestRelease = {
    ...buildRelease(currentTag, releaseSummary),
    notesUrl: `${REPO_URL}/releases/latest`,
    zipUrl: `${REPO_URL}/releases/latest/download/footy-data-kit-${currentTag}-data.zip`,
  };
  const historicReleases = tags
    .filter((tag) => tag !== currentTag)
    .map((tag) => buildRelease(tag, 'previous data release'));

  const releaseDownloadBase = `${REPO_URL}/releases/latest/download`;
  const rawDownloadBase = `${RAW_MAIN_URL}`;

  return {
    site: {
      title: 'footy-data-kit',
      description:
        'Small, validated English football league table datasets generated from Wikipedia.',
      eyebrow: 'plain files for football projects',
      lede: 'Historic English league tables scraped, normalised, verified, and shipped as JSON. Minimal tooling. No API key. No runtime dependency.',
      descriptionParagraphs: [
        'A small data kit for English football history: league tables by season, promotion and relegation summaries, and a sidecar file for club identity metadata.',
        'The maintained dataset is generated from Wikipedia overview pages, validated by local checks, and committed as static files for direct download.',
      ],
      footer: 'static files, boring formats, useful tables',
    },
    stats: [
      { value: `${firstSeason}-${latestSeason}`, label: 'season coverage' },
      { value: String(seasonCount), label: 'seasons' },
      { value: String(clubCount), label: 'club metadata records' },
      { value: `${latestTierCount} tiers`, label: 'latest season depth' },
    ],
    links: [
      { label: 'GitHub repo', url: REPO_URL },
      { label: 'Releases', url: `${REPO_URL}/releases` },
      { label: 'README', url: `${REPO_URL}/blob/main/readme.md` },
      { label: 'Pipeline code', url: `${REPO_URL}/tree/main/wikipedia` },
    ],
    latestRelease,
    historicReleases,
    downloads: [
      {
        file: 'all-seasons.json',
        description: 'Full merged season dataset.',
        size: formatBytes(getFileSize('data-output/all-seasons.json')),
        links: [
          { label: 'json', url: `${releaseDownloadBase}/all-seasons.json` },
          { label: 'raw', url: `${rawDownloadBase}/data-output/all-seasons.json` },
        ],
      },
      {
        file: 'all-seasons.min.json',
        description: 'Minified full merged season dataset.',
        size: formatBytes(getFileSize('data-output/all-seasons.min.json')),
        links: [
          { label: 'min', url: `${releaseDownloadBase}/all-seasons.min.json` },
          { label: 'raw', url: `${rawDownloadBase}/data-output/all-seasons.min.json` },
        ],
      },
      {
        file: 'wiki_overview_tables_by_season.json',
        description: 'Maintained Wikipedia overview export.',
        size: formatBytes(getFileSize('data-output/wiki_overview_tables_by_season.json')),
        links: [
          { label: 'json', url: `${releaseDownloadBase}/wiki_overview_tables_by_season.json` },
          {
            label: 'raw',
            url: `${rawDownloadBase}/data-output/wiki_overview_tables_by_season.json`,
          },
        ],
      },
      {
        file: 'wiki_overview_tables_by_season.min.json',
        description: 'Minified Wikipedia overview export.',
        size: formatBytes(getFileSize('data-output/wiki_overview_tables_by_season.min.json')),
        links: [
          { label: 'min', url: `${releaseDownloadBase}/wiki_overview_tables_by_season.min.json` },
          {
            label: 'raw',
            url: `${rawDownloadBase}/data-output/wiki_overview_tables_by_season.min.json`,
          },
        ],
      },
      {
        file: 'club-metadata.json',
        description: 'Club identity sidecar metadata.',
        size: formatBytes(getFileSize('data/club-metadata.json')),
        links: [
          { label: 'json', url: `${releaseDownloadBase}/club-metadata.json` },
          { label: 'raw', url: `${rawDownloadBase}/data/club-metadata.json` },
        ],
      },
    ],
    curlUrl: `${releaseDownloadBase}/all-seasons.min.json`,
    licenseUrl: `${REPO_URL}/blob/main/LICENSE`,
  };
}

function renderSite() {
  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const siteData = buildSiteData();
  return {
    html: formatGenerated(Mustache.render(template, siteData), {
      filepath: OUTPUT_PATH,
      parser: 'html',
    }),
    siteData,
  };
}

function run(argv = process.argv) {
  const check = argv.includes('--check');
  const { html, siteData } = renderSite();
  const siteDataJson = formatGenerated(JSON.stringify(siteData), {
    filepath: SITE_DATA_PATH,
    parser: 'json',
  });

  if (check) {
    const currentHtml = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, 'utf8') : '';
    const currentSiteData = fs.existsSync(SITE_DATA_PATH)
      ? fs.readFileSync(SITE_DATA_PATH, 'utf8')
      : '';
    if (currentHtml !== html || currentSiteData !== siteDataJson) {
      console.error('Docs site output is stale. Run `pnpm docs:build`.');
      process.exitCode = 1;
    }
    return;
  }

  fs.writeFileSync(OUTPUT_PATH, html);
  fs.writeFileSync(SITE_DATA_PATH, siteDataJson);
  console.log(`Generated ${path.relative(ROOT_DIR, OUTPUT_PATH)}`);
  console.log(`Generated ${path.relative(ROOT_DIR, SITE_DATA_PATH)}`);
}

run();
