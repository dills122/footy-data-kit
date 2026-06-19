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
const SCHEMA_SOURCE_DIR = path.join(ROOT_DIR, 'schemas');
const SCHEMA_OUTPUT_DIR = path.join(ROOT_DIR, 'docs/schema');
const RELEASE_NOTES_DIR = path.join(ROOT_DIR, 'docs/release-notes');
const RELEASE_MANIFEST_PATH = path.join(RELEASE_NOTES_DIR, 'releases.json');
const RELEASE_OUTPUT_DIR = path.join(ROOT_DIR, 'docs/releases');
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderInlineMarkdown(value) {
  return escapeHtml(value)
    .replaceAll(/`([^`]+)`/g, '<code>$1</code>')
    .replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replaceAll(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
      const escapedUrl = escapeHtml(url);
      return `<a href="${escapedUrl}">${label}</a>`;
    });
}

function renderMarkdown(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const html = [];
  let paragraph = [];
  let listItems = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  }

  function flushList() {
    if (!listItems.length) return;
    html.push(
      `<ul>${listItems.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`
    );
    listItems = [];
  }

  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+?)\s*$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(heading[1].length, 4);
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^-\s+(.+?)\s*$/);
    if (bullet) {
      flushParagraph();
      listItems.push(bullet[1]);
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  return html.join('\n');
}

function stripTopMarkdownHeading(markdown) {
  return String(markdown || '')
    .replace(/^# .*(?:\r?\n)+/, '')
    .trim();
}

function slugify(value) {
  return String(value)
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
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

function getSchemaFiles() {
  if (!fs.existsSync(SCHEMA_SOURCE_DIR)) return [];
  return fs
    .readdirSync(SCHEMA_SOURCE_DIR)
    .filter((fileName) => fileName.endsWith('.schema.json'))
    .sort()
    .map((fileName) => {
      const schema = readJson(path.join('schemas', fileName));
      const baseName = fileName.replace(/\.schema\.json$/, '');
      return {
        fileName,
        baseName,
        title: schema.title || baseName,
        description: schema.description || 'JSON Schema reference.',
        schema,
        docFile: `${baseName}.html`,
        docUrl: `./schema/${baseName}.html`,
        rawUrl: `${RAW_MAIN_URL}/schemas/${fileName}`,
      };
    });
}

function getReleaseManifest() {
  if (!fs.existsSync(RELEASE_MANIFEST_PATH)) return [];
  return readJson(path.relative(ROOT_DIR, RELEASE_MANIFEST_PATH)).sort((left, right) =>
    compareTagsDescending(left.tag, right.tag)
  );
}

function getReleaseNoteMarkdown(tag) {
  const releaseNotePath = path.join(RELEASE_NOTES_DIR, `${tag}.md`);
  if (!fs.existsSync(releaseNotePath)) return '';
  return fs.readFileSync(releaseNotePath, 'utf8');
}

function getReleasePageFile(tag) {
  return `${tag}.html`;
}

function getSchemaRefLabel(ref) {
  const value = String(ref || '');
  const match = value.match(/#\/definitions\/([^/]+)$/);
  if (match) return match[1];
  return value.split('/').pop() || value;
}

function getSchemaRefHref(ref, currentSchemaFile) {
  const value = String(ref || '');
  const fileMatch = value.match(/^([^#]+)#\/definitions\/([^/]+)$/);
  if (fileMatch) {
    const fileBase = fileMatch[1].replace(/\.schema\.json$/, '');
    const prefix = fileMatch[1] === currentSchemaFile ? '' : `${fileBase}.html`;
    return `${prefix}#${slugify(fileMatch[2])}`;
  }

  const definitionMatch = value.match(/#\/definitions\/([^/]+)$/);
  if (definitionMatch) return `#${slugify(definitionMatch[1])}`;

  return null;
}

function humanizeSchemaName(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderType(schema, currentSchemaFile) {
  if (!schema || typeof schema !== 'object') return 'unknown';
  if (schema.$ref) {
    const href = getSchemaRefHref(schema.$ref, currentSchemaFile);
    const label = escapeHtml(getSchemaRefLabel(schema.$ref));
    return href
      ? `<a href="${escapeHtml(href)}"><code>${label}</code></a>`
      : `<code>${label}</code>`;
  }
  if (schema.const !== undefined) return `<code>${escapeHtml(JSON.stringify(schema.const))}</code>`;
  if (Array.isArray(schema.type)) {
    return schema.type.map((entry) => `<code>${escapeHtml(entry)}</code>`).join(' | ');
  }
  if (schema.type) return `<code>${escapeHtml(schema.type)}</code>`;
  if (schema.oneOf) return 'one of';
  if (schema.anyOf) return 'any of';
  if (schema.allOf) return 'all of';
  return 'unspecified';
}

function renderSchemaDescription(schema) {
  return schema?.description ? `<p>${escapeHtml(schema.description)}</p>` : '';
}

function renderSchemaBadges(schema) {
  const badges = [];
  if (schema?.required?.length) badges.push(`${schema.required.length} required`);
  if (schema?.additionalProperties === false) badges.push('closed object');
  if (schema?.patternProperties) badges.push('pattern keys');
  if (schema?.format) badges.push(`format: ${schema.format}`);
  if (schema?.pattern) badges.push(`pattern: ${schema.pattern}`);
  if (schema?.maxItems === 0) badges.push('always empty');
  return badges.map((badge) => `<span>${escapeHtml(badge)}</span>`).join('');
}

function renderPropertyRows(schema, currentSchemaFile) {
  const rows = [];
  const required = new Set(schema?.required || []);

  for (const [name, propertySchema] of Object.entries(schema?.properties || {})) {
    rows.push({
      name,
      required: required.has(name),
      type: renderType(propertySchema, currentSchemaFile),
      description: propertySchema?.description || '',
    });
  }

  for (const [pattern, propertySchema] of Object.entries(schema?.patternProperties || {})) {
    rows.push({
      name: pattern,
      required: false,
      type: renderType(propertySchema, currentSchemaFile),
      description: propertySchema?.description
        ? `Pattern property. ${propertySchema.description}`
        : 'Pattern property.',
    });
  }

  if (!rows.length) return '<p class="schema-muted">No named properties.</p>';

  return `<table class="schema-table">
    <thead>
      <tr>
        <th scope="col">Property key</th>
        <th scope="col">Type</th>
        <th scope="col">Use</th>
        <th scope="col">Notes</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) => `<tr>
            <th scope="row"><code>${escapeHtml(row.name)}</code></th>
            <td>${row.type}</td>
            <td><span class="schema-requirement ${row.required ? 'is-required' : 'is-optional'}">${
            row.required ? 'required' : 'optional'
          }</span></td>
            <td>${
              row.description
                ? escapeHtml(row.description)
                : '<span class="schema-muted">No description.</span>'
            }</td>
          </tr>`
        )
        .join('')}
    </tbody>
  </table>`;
}

function renderDefinitionSection(name, schema, currentSchemaFile) {
  const slug = slugify(name);
  const title = humanizeSchemaName(name);

  return `<section class="panel schema-definition" id="${escapeHtml(slugify(name))}">
    <div class="section-heading">
      <div>
        <h2>${escapeHtml(title)}</h2>
        <code class="schema-symbol">${escapeHtml(name)}</code>
      </div>
      <a href="#${escapeHtml(slug)}">anchor</a>
    </div>
    <div class="schema-summary">
      <span>type ${renderType(schema, currentSchemaFile)}</span>
      ${renderSchemaBadges(schema)}
    </div>
    ${renderSchemaDescription(schema)}
    ${renderPropertyRows(schema, currentSchemaFile)}
  </section>`;
}

function renderSchemaPage(schemaDoc, schemaDocs) {
  const definitions = Object.entries(schemaDoc.schema.definitions || {}).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  const allSections = [['Root', schemaDoc.schema], ...definitions];
  const nav = allSections
    .map(
      ([name]) => `<a href="#${escapeHtml(slugify(name))}">
        <span>${escapeHtml(humanizeSchemaName(name))}</span>
        <code>${escapeHtml(name)}</code>
      </a>`
    )
    .join('');
  const peerLinks = schemaDocs
    .filter((entry) => entry.baseName !== schemaDoc.baseName)
    .map((entry) => `<a href="./${escapeHtml(entry.docFile)}">${escapeHtml(entry.title)}</a>`)
    .join('');

  return formatGenerated(
    `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(schemaDoc.title)} schema | footy-data-kit</title>
        <meta name="description" content="${escapeHtml(schemaDoc.description)}" />
        <link rel="stylesheet" href="../styles.css" />
      </head>
      <body>
        <main class="page-shell schema-shell">
          <header class="site-header">
            <p class="eyebrow">schema reference</p>
            <h1>${escapeHtml(humanizeSchemaName(schemaDoc.title))}</h1>
            <code class="schema-title-symbol">${escapeHtml(schemaDoc.title)}</code>
            <p class="lede">${escapeHtml(schemaDoc.description)}</p>
          </header>

          <section class="panel">
            <h2>Schema Links</h2>
            <nav class="link-grid" aria-label="schema links">
              <a href="../index.html">docs home</a>
              <a href="./index.html">schema index</a>
              <a href="${escapeHtml(schemaDoc.rawUrl)}">raw schema</a>
              ${peerLinks}
            </nav>
          </section>

          <section class="panel">
            <h2>Contents</h2>
            <nav class="schema-toc" aria-label="schema contents">${nav}</nav>
          </section>

          ${allSections
            .map(([name, schema]) => renderDefinitionSection(name, schema, schemaDoc.fileName))
            .join('')}

          <footer>
            <span>generated from schemas/${escapeHtml(schemaDoc.fileName)}</span>
            <a href="../index.html">footy-data-kit</a>
          </footer>
        </main>
      </body>
    </html>`,
    { filepath: path.join(SCHEMA_OUTPUT_DIR, schemaDoc.docFile), parser: 'html' }
  );
}

function renderSchemaIndex(schemaDocs) {
  const rows = schemaDocs
    .map(
      (schemaDoc) => `<li>
        <code>${escapeHtml(schemaDoc.fileName)}</code>
        <span>${escapeHtml(schemaDoc.description)}</span>
        <a href="./${escapeHtml(schemaDoc.docFile)}">view</a>
        <a href="${escapeHtml(schemaDoc.rawUrl)}">raw</a>
      </li>`
    )
    .join('');

  return formatGenerated(
    `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Schema reference | footy-data-kit</title>
        <meta name="description" content="Static schema reference for footy-data-kit JSON exports." />
        <link rel="stylesheet" href="../styles.css" />
      </head>
      <body>
        <main class="page-shell">
          <header class="site-header">
            <p class="eyebrow">data contract</p>
            <h1>schema reference</h1>
            <p class="lede">Human-readable JSON Schema documentation for the published data files.</p>
          </header>

          <section class="panel">
            <h2>Schema Files</h2>
            <ul class="download-list schema-list">${rows}</ul>
          </section>

          <section class="panel">
            <h2>Use These Schemas</h2>
            <p>The schemas document the generated JSON contract and can be used by validators that support JSON Schema Draft-07.</p>
            <pre><code>schemas/football-data.schema.json
schemas/club-metadata.schema.json</code></pre>
          </section>

          <footer>
            <span>static schema docs</span>
            <a href="../index.html">docs home</a>
          </footer>
        </main>
      </body>
    </html>`,
    { filepath: path.join(SCHEMA_OUTPUT_DIR, 'index.html'), parser: 'html' }
  );
}

function renderSchemaDocs(schemaDocs) {
  return [
    {
      path: path.join(SCHEMA_OUTPUT_DIR, 'index.html'),
      html: renderSchemaIndex(schemaDocs),
    },
    ...schemaDocs.map((schemaDoc) => ({
      path: path.join(SCHEMA_OUTPUT_DIR, schemaDoc.docFile),
      html: renderSchemaPage(schemaDoc, schemaDocs),
    })),
  ];
}

function renderReleasePage(release) {
  const markdown = getReleaseNoteMarkdown(release.tag);
  const githubReleaseUrl = `${REPO_URL}/releases/tag/${release.tag}`;
  const releaseZipUrl = `${REPO_URL}/releases/download/${release.tag}/footy-data-kit-${release.tag}-data.zip`;

  return formatGenerated(
    `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(release.tag)} release notes | footy-data-kit</title>
        <meta name="description" content="${escapeHtml(release.summary)}" />
        <link rel="stylesheet" href="../styles.css" />
      </head>
      <body>
        <main class="page-shell">
          <header class="site-header">
            <p class="eyebrow">release notes</p>
            <h1>${escapeHtml(release.tag)}</h1>
            <p class="lede">${escapeHtml(release.summary)}</p>
          </header>

          <section class="panel">
            <h2>Release</h2>
            <ul class="release-meta">
              <li><span>title</span><strong>${escapeHtml(release.title)}</strong></li>
              <li><span>date</span><strong>${escapeHtml(release.date || 'not dated')}</strong></li>
              <li><span>type</span><strong>${escapeHtml(release.type || 'release')}</strong></li>
              <li><span>schema</span><strong>${escapeHtml(
                release.schemaCompatibility || 'unspecified'
              )}</strong></li>
            </ul>
          </section>

          <section class="panel release-notes-body">
            ${renderMarkdown(stripTopMarkdownHeading(markdown))}
          </section>

          <section class="panel">
            <h2>Links</h2>
            <nav class="link-grid" aria-label="release links">
              <a href="./index.html">release history</a>
              <a href="../index.html">docs home</a>
              <a href="${escapeHtml(githubReleaseUrl)}">github release</a>
              <a href="${escapeHtml(releaseZipUrl)}">data zip</a>
            </nav>
          </section>

          <footer>
            <span>${escapeHtml(release.tag)}</span>
            <a href="./index.html">release history</a>
          </footer>
        </main>
      </body>
    </html>`,
    { filepath: path.join(RELEASE_OUTPUT_DIR, getReleasePageFile(release.tag)), parser: 'html' }
  );
}

function renderReleaseIndex(releases) {
  const rows = releases
    .map(
      (release) => `<div class="release-row">
        <span>${escapeHtml(release.tag)}</span>
        <span>${escapeHtml(release.summary)}</span>
        <span class="release-actions">
          <a href="./${escapeHtml(getReleasePageFile(release.tag))}">notes</a>
          <a href="${escapeHtml(`${REPO_URL}/releases/tag/${release.tag}`)}">github</a>
        </span>
      </div>`
    )
    .join('');

  return formatGenerated(
    `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Release history | footy-data-kit</title>
        <meta name="description" content="Release notes for footy-data-kit data releases." />
        <link rel="stylesheet" href="../styles.css" />
      </head>
      <body>
        <main class="page-shell">
          <header class="site-header">
            <p class="eyebrow">release history</p>
            <h1>releases</h1>
            <p class="lede">Curated release notes for generated data releases.</p>
          </header>

          <section class="panel">
            <h2>Release Notes</h2>
            <div class="release-rows" aria-label="release notes">${rows}</div>
          </section>

          <footer>
            <span>generated from docs/release-notes</span>
            <a href="../index.html">docs home</a>
          </footer>
        </main>
      </body>
    </html>`,
    { filepath: path.join(RELEASE_OUTPUT_DIR, 'index.html'), parser: 'html' }
  );
}

function renderReleaseDocs(releases) {
  return [
    {
      path: path.join(RELEASE_OUTPUT_DIR, 'index.html'),
      html: renderReleaseIndex(releases),
    },
    ...releases.map((release) => ({
      path: path.join(RELEASE_OUTPUT_DIR, getReleasePageFile(release.tag)),
      html: renderReleasePage(release),
    })),
  ];
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
  const schemaDocs = getSchemaFiles().map((schemaDoc) => ({
    title: schemaDoc.title,
    description: schemaDoc.description,
    fileName: schemaDoc.fileName,
    docUrl: schemaDoc.docUrl,
    rawUrl: schemaDoc.rawUrl,
  }));

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
      { label: 'Release notes', url: './releases/' },
      { label: 'Roadmap', url: `${REPO_URL}/blob/main/docs/roadmap.md` },
      { label: 'Schema docs', url: './schema/' },
      { label: 'README', url: `${REPO_URL}/blob/main/readme.md` },
      { label: 'Pipeline code', url: `${REPO_URL}/tree/main/wikipedia` },
    ],
    schemaDocs,
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
  const schemaDocs = renderSchemaDocs(getSchemaFiles());
  const releaseDocs = renderReleaseDocs(getReleaseManifest());
  return {
    html: formatGenerated(Mustache.render(template, siteData), {
      filepath: OUTPUT_PATH,
      parser: 'html',
    }),
    siteData,
    schemaDocs,
    releaseDocs,
  };
}

function run(argv = process.argv) {
  const check = argv.includes('--check');
  const { html, siteData, schemaDocs, releaseDocs } = renderSite();
  const siteDataJson = formatGenerated(JSON.stringify(siteData), {
    filepath: SITE_DATA_PATH,
    parser: 'json',
  });

  if (check) {
    const currentHtml = fs.existsSync(OUTPUT_PATH) ? fs.readFileSync(OUTPUT_PATH, 'utf8') : '';
    const currentSiteData = fs.existsSync(SITE_DATA_PATH)
      ? fs.readFileSync(SITE_DATA_PATH, 'utf8')
      : '';
    const staleSchemaDoc = schemaDocs.find((schemaDoc) => {
      const currentSchemaHtml = fs.existsSync(schemaDoc.path)
        ? fs.readFileSync(schemaDoc.path, 'utf8')
        : '';
      return currentSchemaHtml !== schemaDoc.html;
    });
    const staleReleaseDoc = releaseDocs.find((releaseDoc) => {
      const currentReleaseHtml = fs.existsSync(releaseDoc.path)
        ? fs.readFileSync(releaseDoc.path, 'utf8')
        : '';
      return currentReleaseHtml !== releaseDoc.html;
    });
    if (
      currentHtml !== html ||
      currentSiteData !== siteDataJson ||
      staleSchemaDoc ||
      staleReleaseDoc
    ) {
      console.error('Docs site output is stale. Run `pnpm docs:build`.');
      process.exitCode = 1;
    }
    return;
  }

  fs.mkdirSync(SCHEMA_OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(RELEASE_OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, html);
  fs.writeFileSync(SITE_DATA_PATH, siteDataJson);
  for (const schemaDoc of schemaDocs) {
    fs.writeFileSync(schemaDoc.path, schemaDoc.html);
    console.log(`Generated ${path.relative(ROOT_DIR, schemaDoc.path)}`);
  }
  for (const releaseDoc of releaseDocs) {
    fs.writeFileSync(releaseDoc.path, releaseDoc.html);
    console.log(`Generated ${path.relative(ROOT_DIR, releaseDoc.path)}`);
  }
  console.log(`Generated ${path.relative(ROOT_DIR, OUTPUT_PATH)}`);
  console.log(`Generated ${path.relative(ROOT_DIR, SITE_DATA_PATH)}`);
}

run();
