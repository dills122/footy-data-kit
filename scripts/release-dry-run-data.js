#!/usr/bin/env node
// @ts-check

import { Command } from 'commander';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUTPUT_DIR = path.join(os.tmpdir(), 'footy-data-kit-release-dry-run');

function run(command, args, options = {}) {
  const display = [command, ...args].join(' ');
  console.log(`\n$ ${display}`);
  execFileSync(command, args, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    ...options,
  });
}

export function runReleaseDryRun({
  start = '1888',
  end = '2025',
  output = DEFAULT_OUTPUT_DIR,
  skipClean = false,
} = {}) {
  const outputDir = path.resolve(output);
  const overviewFile = path.join(outputDir, 'wiki_overview_tables_by_season.json');
  const allSeasonsFile = path.join(outputDir, 'all-seasons.json');
  const allSeasonsMinFile = path.join(outputDir, 'all-seasons.min.json');
  const overviewMinFile = path.join(outputDir, 'wiki_overview_tables_by_season.min.json');
  const clubMetadataFile = path.join(outputDir, 'club-metadata.json');

  if (!skipClean) {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outputDir, { recursive: true });

  run('node', [
    'wikipedia/cli/index.js',
    'overview',
    '--start',
    String(start),
    '--end',
    String(end),
    '--output',
    outputDir,
    '--force-update',
    '--include-war-placeholders',
  ]);
  run('node', ['wikipedia/data/combine-output-files.js', '--output', allSeasonsFile, overviewFile]);
  run('node', [
    'wikipedia/data/generate-club-metadata-seed.js',
    allSeasonsFile,
    '--output',
    clubMetadataFile,
  ]);
  run('node', ['scripts/minify-json.js', allSeasonsFile]);
  run('node', ['scripts/minify-json.js', overviewFile]);
  run('node', ['wikipedia/data/verify-football-data.js', '--fail-on-issues', outputDir]);
  run('node', [
    'wikipedia/data/verify-club-continuity.js',
    '--dataset',
    allSeasonsFile,
    '--club-metadata',
    clubMetadataFile,
    '--check-historical-reasons',
    '--fail-on-issues',
  ]);
  run('node', [
    'wikipedia/data/verify-json-schemas.js',
    '--target',
    `football-data.schema.json:${allSeasonsFile}`,
    '--target',
    `football-data.schema.json:${allSeasonsMinFile}`,
    '--target',
    `football-data.schema.json:${overviewFile}`,
    '--target',
    `football-data.schema.json:${overviewMinFile}`,
    '--target',
    `club-metadata.schema.json:${clubMetadataFile}`,
  ]);

  console.log(`\nRelease dry-run data verified in ${outputDir}`);
}

export function runCli(argv = process.argv) {
  const program = new Command();
  program
    .name('release-dry-run-data')
    .description('Rebuild release data into a temporary directory and run release verification.')
    .option('--start <year>', 'First season year', '1888')
    .option('--end <year>', 'Final season year', '2025')
    .option('--output <dir>', 'Temporary output directory', DEFAULT_OUTPUT_DIR)
    .option('--skip-clean', 'Do not delete the output directory before running', false);

  program.parse(argv);
  runReleaseDryRun(program.opts());
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli(process.argv);
}

export default {
  runReleaseDryRun,
  runCli,
};
