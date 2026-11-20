import Ajv, { type AnySchema, type ErrorObject } from 'ajv';
import { Command } from 'commander';
import * as fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCHEMA_DIR = path.join(ROOT_DIR, 'schemas');

interface SchemaTarget {
  label: string;
  schemaFile: string;
  dataFile: string;
}

interface SchemaResult {
  valid: boolean | Promise<unknown>;
  errors: ErrorObject[];
}

interface SchemaTargetResult extends SchemaTarget, SchemaResult {
  dataPath: string;
}

interface SchemaTargetOptions {
  rootDir?: string;
  schemaDir?: string;
  targets?: readonly SchemaTarget[];
}

interface SchemaCliOptions {
  schemaDir: string;
  target: string[];
  json: boolean;
}

export const DEFAULT_SCHEMA_TARGETS: SchemaTarget[] = [
  {
    label: 'all-seasons.json',
    schemaFile: 'football-data.schema.json',
    dataFile: 'data-output/all-seasons.json',
  },
  {
    label: 'all-seasons.min.json',
    schemaFile: 'football-data.schema.json',
    dataFile: 'data-output/all-seasons.min.json',
  },
  {
    label: 'wiki_overview_tables_by_season.json',
    schemaFile: 'football-data.schema.json',
    dataFile: 'data-output/wiki_overview_tables_by_season.json',
  },
  {
    label: 'wiki_overview_tables_by_season.min.json',
    schemaFile: 'football-data.schema.json',
    dataFile: 'data-output/wiki_overview_tables_by_season.min.json',
  },
  {
    label: 'club-metadata.json',
    schemaFile: 'club-metadata.schema.json',
    dataFile: 'data/club-metadata.json',
  },
];

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readSchema(filePath: string): AnySchema {
  // AJV checks the parsed value when the schema is registered or compiled.
  return readJson(filePath) as AnySchema;
}

function createAjv() {
  return new Ajv({
    allErrors: true,
    strict: false,
    validateFormats: false,
  });
}

function loadSchemaFiles(schemaDir = SCHEMA_DIR) {
  return fs
    .readdirSync(schemaDir)
    .filter((fileName) => fileName.endsWith('.schema.json'))
    .sort()
    .map((fileName) => ({
      fileName,
      schema: readSchema(path.join(schemaDir, fileName)),
    }));
}

export function createSchemaValidator(schemaDir = SCHEMA_DIR) {
  const ajv = createAjv();
  const schemas = loadSchemaFiles(schemaDir);

  for (const { fileName, schema } of schemas) {
    ajv.addSchema(schema, fileName);
  }

  return {
    validate(schemaFile: string, data: unknown): SchemaResult {
      const validate =
        ajv.getSchema(schemaFile) || ajv.compile(readSchema(path.join(schemaDir, schemaFile)));
      const valid = validate(data);
      return {
        valid,
        errors: valid ? [] : validate.errors || [],
      };
    },
  };
}

function formatError(error: ErrorObject) {
  const pathLabel = error.instancePath || '/';
  const params = error.params ? ` ${JSON.stringify(error.params)}` : '';
  return `${pathLabel} ${error.message || 'failed schema validation'}${params}`;
}

export function validateSchemaTargets({
  rootDir = ROOT_DIR,
  schemaDir = path.join(rootDir, 'schemas'),
  targets = DEFAULT_SCHEMA_TARGETS,
}: SchemaTargetOptions = {}): SchemaTargetResult[] {
  const validator = createSchemaValidator(schemaDir);

  return targets.map((target) => {
    const dataPath = path.resolve(rootDir, target.dataFile);
    const data = readJson(dataPath);
    const result = validator.validate(target.schemaFile, data);
    return {
      ...target,
      dataPath,
      valid: result.valid,
      errors: result.errors,
    };
  });
}

function printReport(results: SchemaTargetResult[]) {
  for (const result of results) {
    console.log(`\n${result.dataFile}`);
    if (result.valid) {
      console.log(`  Schema: ${result.schemaFile}`);
      console.log('  No schema issues detected ✅');
      continue;
    }

    console.log(`  Schema: ${result.schemaFile}`);
    console.log(`  Issues found: ${result.errors.length}`);
    for (const error of result.errors.slice(0, 20)) {
      console.log(`    - ${formatError(error)}`);
    }
    if (result.errors.length > 20) {
      console.log(`    - ...and ${result.errors.length - 20} more issue(s)`);
    }
  }
}

export function runCli(argv = process.argv) {
  const program = new Command();
  program
    .name('verify-json-schemas')
    .description('Validate generated JSON data files against the repo JSON Schema contracts.')
    .option('--schema-dir <dir>', 'Directory containing *.schema.json files', './schemas')
    .option(
      '--target <schema:file>',
      'Validate an explicit schema/data pair. Repeatable. Example: football-data.schema.json:data-output/all-seasons.json',
      (value: string, previous: string[]) => [...previous, value],
      []
    )
    .option('--json', 'Print machine-readable JSON output', false);

  program.parse(argv);
  const options = program.opts<SchemaCliOptions>();
  const targets = options.target.length
    ? options.target.map((entry) => {
        const separatorIndex = entry.indexOf(':');
        if (separatorIndex === -1) {
          throw new Error(`Invalid --target value: ${entry}`);
        }
        const schemaFile = entry.slice(0, separatorIndex);
        const dataFile = entry.slice(separatorIndex + 1);
        return {
          label: dataFile,
          schemaFile,
          dataFile,
        };
      })
    : DEFAULT_SCHEMA_TARGETS;

  const results = validateSchemaTargets({
    rootDir: ROOT_DIR,
    schemaDir: path.resolve(ROOT_DIR, options.schemaDir),
    targets,
  });
  const hasIssues = results.some((result) => !result.valid);

  if (options.json) {
    console.log(
      JSON.stringify(
        results.map((result) => ({
          dataFile: result.dataFile,
          schemaFile: result.schemaFile,
          valid: result.valid,
          errors: result.errors,
        })),
        null,
        2
      )
    );
  } else {
    printReport(results);
  }

  if (hasIssues) {
    process.exitCode = 1;
  }

  return results;
}
