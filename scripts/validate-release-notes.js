#!/usr/bin/env node
// @ts-check

import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REQUIRED_SECTIONS = ['Summary', 'Data Changes', 'Validation'];
const OPTIONAL_SECTIONS = ['Breaking Changes', 'Bug Fixes', 'Consumer Notes', 'Known Limitations'];
const RELEASE_TAG_PATTERN = /^v\d+\.\d+\.\d+$/;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getPackageTag(rootDir) {
  const packageJson = readJson(path.join(rootDir, 'package.json'));
  return `v${packageJson.version}`;
}

function normalizeHeading(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function extractMarkdownSections(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const sections = new Map();
  let current = null;
  let body = [];

  function flush() {
    if (!current) return;
    sections.set(current, body.join('\n').trim());
  }

  for (const line of lines) {
    const match = line.match(/^##\s+(.+?)\s*$/);
    if (match) {
      flush();
      current = normalizeHeading(match[1]);
      body = [];
      continue;
    }

    if (current) body.push(line);
  }

  flush();
  return sections;
}

function isNonEmptySection(value) {
  const trimmed = String(value || '').trim();
  return trimmed.length > 0 && !/^none\.?$/i.test(trimmed);
}

export function validateReleaseManifest(manifest, { requiredTag } = {}) {
  const errors = [];
  if (!Array.isArray(manifest)) {
    return ['Release manifest must be an array.'];
  }

  const seenTags = new Set();
  for (const [index, entry] of manifest.entries()) {
    const prefix = `Release manifest entry ${index + 1}`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${prefix} must be an object.`);
      continue;
    }

    if (!RELEASE_TAG_PATTERN.test(String(entry.tag || ''))) {
      errors.push(`${prefix} must have a semver tag like v1.0.0.`);
    } else if (seenTags.has(entry.tag)) {
      errors.push(`${prefix} duplicates tag ${entry.tag}.`);
    } else {
      seenTags.add(entry.tag);
    }

    for (const field of ['title', 'summary']) {
      if (!String(entry[field] || '').trim()) {
        errors.push(`${prefix} must include a non-empty ${field}.`);
      }
    }
  }

  if (requiredTag && !seenTags.has(requiredTag)) {
    errors.push(`Release manifest must include ${requiredTag}.`);
  }

  return errors;
}

export function validateReleaseNoteMarkdown(markdown, { tag }) {
  const errors = [];
  const heading = String(markdown || '').match(/^#\s+(.+?)\s*$/m);
  if (!heading) {
    errors.push('Release note must start with a top-level # heading.');
  } else if (tag && !heading[1].includes(tag)) {
    errors.push(`Release note heading must include ${tag}.`);
  }

  const sections = extractMarkdownSections(markdown);
  for (const section of REQUIRED_SECTIONS) {
    if (!sections.has(section)) {
      errors.push(`Release note must include ## ${section}.`);
      continue;
    }
    if (!isNonEmptySection(sections.get(section))) {
      errors.push(`Release note section ## ${section} must include real content.`);
    }
  }

  for (const section of sections.keys()) {
    if (![...REQUIRED_SECTIONS, ...OPTIONAL_SECTIONS].includes(section)) continue;
    const body = sections.get(section);
    if (!body && REQUIRED_SECTIONS.includes(section)) {
      errors.push(`Release note section ## ${section} must not be empty.`);
    }
  }

  return errors;
}

export function validateReleaseNotes({
  rootDir = process.cwd(),
  tag,
  all = false,
  manifestPath = 'docs/release-notes/releases.json',
  notesDir = 'docs/release-notes',
} = {}) {
  const resolvedManifestPath = path.resolve(rootDir, manifestPath);
  const errors = [];
  const manifest = fs.existsSync(resolvedManifestPath) ? readJson(resolvedManifestPath) : null;
  const releaseTags = all
    ? Array.isArray(manifest)
      ? manifest.map((entry) => entry.tag)
      : []
    : [tag || getPackageTag(rootDir)];

  if (!manifest) {
    errors.push(`Release manifest not found: ${path.relative(rootDir, resolvedManifestPath)}`);
  } else {
    errors.push(...validateReleaseManifest(manifest, { requiredTag: all ? null : releaseTags[0] }));
  }

  for (const releaseTag of releaseTags) {
    const resolvedNotePath = path.resolve(rootDir, notesDir, `${releaseTag}.md`);
    if (!RELEASE_TAG_PATTERN.test(releaseTag)) {
      errors.push(`Release tag must look like v1.0.0, got ${releaseTag}.`);
    }

    if (!fs.existsSync(resolvedNotePath)) {
      errors.push(`Release note not found: ${path.relative(rootDir, resolvedNotePath)}`);
    } else {
      const markdown = fs.readFileSync(resolvedNotePath, 'utf8');
      errors.push(...validateReleaseNoteMarkdown(markdown, { tag: releaseTag }));
    }
  }

  return {
    tag: all ? 'all releases' : releaseTags[0],
    manifestPath: resolvedManifestPath,
    notePath: all ? null : path.resolve(rootDir, notesDir, `${releaseTags[0]}.md`),
    errors,
  };
}

export function runCli(argv = process.argv) {
  const program = new Command();
  program
    .name('validate-release-notes')
    .description('Validate release note markdown and release manifest metadata.')
    .option('--tag <tag>', 'Release tag to validate, for example v1.0.0')
    .option('--all', 'Validate every release listed in the release manifest', false)
    .option('--manifest <path>', 'Release manifest path', 'docs/release-notes/releases.json')
    .option('--notes-dir <path>', 'Release notes directory', 'docs/release-notes');

  program.parse(argv);
  const options = program.opts();
  const result = validateReleaseNotes({
    tag: options.tag,
    all: options.all,
    manifestPath: options.manifest,
    notesDir: options.notesDir,
  });

  if (result.errors.length) {
    console.error(`Release note validation failed for ${result.tag}:`);
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return result;
  }

  console.log(`Release note validation passed for ${result.tag}.`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli(process.argv);
}

export default {
  extractMarkdownSections,
  validateReleaseManifest,
  validateReleaseNoteMarkdown,
  validateReleaseNotes,
  runCli,
};
