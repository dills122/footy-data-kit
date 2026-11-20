#!/usr/bin/env node

import { register } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep the existing CLI usable on Node versions without native type stripping.
if (!process.features.typescript) {
  register('./verify-json-schemas-loader.js', import.meta.url, {
    data: new URL('./verify-json-schemas.ts', import.meta.url).href,
  });
}

export const { DEFAULT_SCHEMA_TARGETS, createSchemaValidator, validateSchemaTargets, runCli } =
  await import('./verify-json-schemas.ts');

const isDirectExecution = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isDirectExecution) {
  runCli(process.argv);
}
