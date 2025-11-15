#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';

const program = new Command();

program
  .name('minify-json')
  .description('Minify JSON files and write compact output.')
  .argument('<files...>', 'JSON files to minify')
  .option('-i, --in-place', 'Overwrite the original files', false)
  .option(
    '-s, --suffix <suffix>',
    'Suffix to append when writing alongside the source file',
    '.min'
  )
  .parse(process.argv);

const files = program.args;
const { inPlace, suffix } = program.opts();

if (!files.length) {
  program.error('At least one JSON file must be provided.');
}

for (const inputFile of files) {
  const resolvedInput = path.resolve(process.cwd(), inputFile);

  if (!fs.existsSync(resolvedInput)) {
    program.error(`File not found: ${inputFile}`);
  }

  const raw = fs.readFileSync(resolvedInput, 'utf8');
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    program.error(`Failed to parse ${inputFile}: ${/** @type {Error} */ (error).message}`);
  }

  const minified = JSON.stringify(parsed);
  const outputFile = inPlace
    ? resolvedInput
    : (() => {
        const dir = path.dirname(resolvedInput);
        const ext = path.extname(resolvedInput);
        const base = path.basename(resolvedInput, ext);
        const safeSuffix = typeof suffix === 'string' && suffix.length ? suffix : '.min';
        const existingExt = ext || '.json';
        return path.join(dir, `${base}${safeSuffix}${existingExt}`);
      })();

  fs.writeFileSync(outputFile, minified);
  const displayPath = path.relative(process.cwd(), outputFile) || outputFile;
  console.log(`Minified ${inputFile} → ${displayPath}`);
}
