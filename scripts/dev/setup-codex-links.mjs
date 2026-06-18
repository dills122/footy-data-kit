#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const codexDir = path.join(repoRoot, '.codex');
const skillsDir = path.join(codexDir, 'skills');
const steeringDir = path.join(codexDir, 'steering');
const templatesRoot = resolveTemplatesRoot();
const dryRun = process.argv.includes('--dry-run');
const reset = process.argv.includes('--reset');
const sharedSteeringFiles = [
  'frontend-design-steering.md',
  'javascript-esm-steering.md',
  'testing-quality-gates-steering.md',
];

function usage() {
  console.log(`Usage: node scripts/dev/setup-codex-links.mjs [--dry-run] [--reset]

Creates local .codex symlinks from AI Central.

Environment:
  AI_CENTRAL_HOME       Path to ai-central or ai-central/templates.
                        Defaults to ../ai-central/templates.
  AI_CENTRAL_REFERENCE  Optional repo whose existing .codex symlinks can be
                        mirrored when AI Central is blocked by local privacy
                        permissions. Defaults to a known sibling repo when
                        present.

Options:
  --dry-run             Report changes without writing links.
  --reset               Remove generated .codex/skills and linked shared
                        steering files before recreating links.
  --help                Show this help.`);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  usage();
  process.exit(0);
}

function resolveTemplatesRoot() {
  const input = process.env.AI_CENTRAL_HOME ?? path.resolve(repoRoot, '../ai-central/templates');
  const absolute = path.resolve(input);
  return path.basename(absolute) === 'ai-central' ? path.join(absolute, 'templates') : absolute;
}

async function pathExists(target) {
  try {
    await fs.lstat(target);
    return true;
  } catch (error) {
    if (['ENOENT', 'EACCES', 'EPERM'].includes(error.code)) {
      return false;
    }
    throw error;
  }
}

async function* walkDirs(root) {
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    if (['ENOENT', 'EACCES', 'EPERM'].includes(error.code)) {
      return;
    }
    throw error;
  }

  yield root;

  for (const entry of entries) {
    if (entry.isDirectory()) {
      yield* walkDirs(path.join(root, entry.name));
    }
  }
}

async function findSkillLinksFromTemplates() {
  const skillRoot = path.join(templatesRoot, 'skills');
  const links = [];

  for await (const dir of walkDirs(skillRoot)) {
    if (!(await pathExists(path.join(dir, 'SKILL.md')))) {
      continue;
    }

    const relativeDir = path.relative(skillRoot, dir);
    const parts = relativeDir.split(path.sep);
    const name = parts.at(-1);
    const linkName = skillLinkName(parts, name);

    if (linkName) {
      links.push({ linkName, target: dir });
    }
  }

  return sortLinks(links);
}

function skillLinkName(parts, name) {
  if (!name) {
    return undefined;
  }

  if (parts[0] === 'adapted') {
    return name;
  }

  if (parts[0] !== 'imported') {
    return name;
  }

  if (parts[1] === 'agent-skills') {
    return name;
  }

  if (parts[1] === 'pm-skills') {
    return `pm-${name}`;
  }

  if (parts[1] === 'claude-skills') {
    return `claude-${name}`;
  }

  if (parts[1] === 'agent-toolkit') {
    return `toolkit-${name}`;
  }

  if (parts[1] === 'web-quality-skills') {
    return `web-${name}`;
  }

  return name;
}

async function findSteeringLinksFromTemplates() {
  const root = path.join(templatesRoot, 'steering');
  const links = [];

  for (const fileName of sharedSteeringFiles) {
    const target = path.join(root, fileName);
    if (await pathExists(target)) {
      links.push({ linkName: fileName, target });
    }
  }

  return sortLinks(links);
}

async function findLinksFromReference(directoryName) {
  const referenceRoot = await resolveReferenceRepo();
  if (!referenceRoot) {
    return [];
  }

  const referenceDir = path.join(referenceRoot, '.codex', directoryName);
  let entries;
  try {
    entries = await fs.readdir(referenceDir);
  } catch (error) {
    if (['ENOENT', 'EACCES', 'EPERM'].includes(error.code)) {
      return [];
    }
    throw error;
  }

  const links = [];
  for (const entry of entries) {
    if (directoryName === 'steering' && !sharedSteeringFiles.includes(entry)) {
      continue;
    }

    const linkPath = path.join(referenceDir, entry);
    const stat = await fs.lstat(linkPath);
    if (!stat.isSymbolicLink()) {
      continue;
    }

    links.push({
      linkName: entry,
      target: path.resolve(path.dirname(linkPath), await fs.readlink(linkPath)),
    });
  }

  return sortLinks(links);
}

async function resolveReferenceRepo() {
  const candidates = [
    process.env.AI_CENTRAL_REFERENCE,
    path.resolve(repoRoot, '../footy-stats'),
    path.resolve(repoRoot, '../forage'),
    path.resolve(repoRoot, '../reef'),
    path.resolve(repoRoot, '../breakerflow-platform'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (await pathExists(path.join(candidate, '.codex'))) {
      return candidate;
    }
  }

  return undefined;
}

function sortLinks(links) {
  return links.sort((left, right) => left.linkName.localeCompare(right.linkName));
}

async function removeGeneratedLinks() {
  if (!dryRun) {
    await fs.rm(skillsDir, { recursive: true, force: true });
  }

  let entries;
  try {
    entries = await fs.readdir(steeringDir);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const linkPath = path.join(steeringDir, entry);
    const stat = await fs.lstat(linkPath);
    if (stat.isSymbolicLink() && !dryRun) {
      await fs.unlink(linkPath);
    }
  }
}

async function ensureSymlink(directory, linkName, target) {
  const linkPath = path.join(directory, linkName);
  let existing;

  try {
    existing = await fs.lstat(linkPath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  if (existing && !existing.isSymbolicLink()) {
    return { action: 'skip-real-file', linkPath, target };
  }

  if (existing?.isSymbolicLink()) {
    const currentTarget = await fs.readlink(linkPath);
    const resolvedCurrentTarget = path.resolve(path.dirname(linkPath), currentTarget);

    if (resolvedCurrentTarget === target) {
      return { action: 'unchanged', linkPath, target };
    }

    if (!dryRun) {
      await fs.unlink(linkPath);
    }
  }

  if (!dryRun) {
    await fs.symlink(target, linkPath);
  }

  return {
    action: existing ? 'updated' : 'created',
    linkPath,
    target,
  };
}

async function main() {
  if (reset) {
    await removeGeneratedLinks();
  }

  if (!dryRun) {
    await fs.mkdir(skillsDir, { recursive: true });
    await fs.mkdir(steeringDir, { recursive: true });
  }

  let skillLinks = await findSkillLinksFromTemplates();
  let steeringLinks = await findSteeringLinksFromTemplates();
  let source = templatesRoot;

  if (skillLinks.length === 0) {
    skillLinks = await findLinksFromReference('skills');
    source = 'reference repo symlinks';
  }

  if (steeringLinks.length === 0) {
    steeringLinks = await findLinksFromReference('steering');
  }

  const links = [
    ...skillLinks.map((link) => ({ ...link, directory: skillsDir })),
    ...steeringLinks.map((link) => ({ ...link, directory: steeringDir })),
  ];

  if (links.length === 0) {
    console.error(`No AI Central links found from ${templatesRoot} or sibling reference repos.`);
    console.error('Set AI_CENTRAL_HOME or AI_CENTRAL_REFERENCE to a readable checkout.');
    process.exitCode = 1;
    return;
  }

  const results = [];
  for (const link of links) {
    results.push(await ensureSymlink(link.directory, link.linkName, link.target));
  }

  const counts = results.reduce((accumulator, result) => {
    accumulator[result.action] = (accumulator[result.action] ?? 0) + 1;
    return accumulator;
  }, {});

  for (const result of results.filter((item) => item.action !== 'unchanged')) {
    const relativeLink = path.relative(repoRoot, result.linkPath);
    console.log(`${result.action}: ${relativeLink} -> ${result.target}`);
  }

  console.log(
    `Codex links checked from ${source}: ${results.length} ` +
      `(created ${counts.created ?? 0}, updated ${counts.updated ?? 0}, ` +
      `unchanged ${counts.unchanged ?? 0}, skipped ${counts['skip-real-file'] ?? 0})`
  );
}

await main();
