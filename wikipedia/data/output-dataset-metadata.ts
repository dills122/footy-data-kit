import { execSync } from 'node:child_process';
import type { DatasetMetadata } from '../models/output-file.ts';

type BuildOptionValue = string | number | boolean | null;

export const DATASET_SCHEMA_VERSION = 1;

let cachedGitSha: string | null | undefined;

function toStringValue(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((entry) => toStringValue(entry)).filter((entry): entry is string => entry != null))
  );
}

function normalizeBuildOptions(value: unknown): Record<string, BuildOptionValue> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value)
    .map(([key, entry]): [string, BuildOptionValue] | null => {
      if (entry == null) return [key, null];
      if (['string', 'number', 'boolean'].includes(typeof entry)) {
        return [key, entry as string | number | boolean];
      }
      return null;
    })
    .filter((entry): entry is [string, BuildOptionValue] => entry != null);

  if (!entries.length) return undefined;
  return Object.fromEntries(entries);
}

export function normaliseDatasetMetadata(value: unknown): DatasetMetadata | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;

  const source = value as Record<string, unknown>;
  const schemaVersion = Number(source.schemaVersion);
  const metadata: DatasetMetadata = {
    schemaVersion: Number.isFinite(schemaVersion) ? schemaVersion : DATASET_SCHEMA_VERSION,
    generator: toStringValue(source.generator),
    generatedAt: toStringValue(source.generatedAt),
    gitSha: toStringValue(source.gitSha),
    sourceFiles: normalizeStringArray(source.sourceFiles),
    buildOptions: normalizeBuildOptions(source.buildOptions),
  };

  const cleaned = Object.fromEntries(
    Object.entries(metadata).filter(([, entry]) => {
      if (entry == null) return false;
      if (Array.isArray(entry)) return entry.length > 0;
      if (typeof entry === 'object') return Object.keys(entry).length > 0;
      return true;
    })
  );

  return Object.keys(cleaned).length ? (cleaned as DatasetMetadata) : undefined;
}

function getCurrentGitSha(cwd = process.cwd()): string | null {
  if (cachedGitSha !== undefined) return cachedGitSha;

  try {
    cachedGitSha = execSync('git rev-parse --short HEAD', {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    cachedGitSha = null;
  }

  return cachedGitSha;
}

export function buildDatasetMetadata({
  generator,
  sourceFiles,
  buildOptions,
  generatedAt = new Date().toISOString(),
  gitSha = getCurrentGitSha(),
}: {
  generator?: string | null;
  sourceFiles?: unknown;
  buildOptions?: unknown;
  generatedAt?: string | null;
  gitSha?: string | null;
} = {}): DatasetMetadata {
  return (
    normaliseDatasetMetadata({
      schemaVersion: DATASET_SCHEMA_VERSION,
      generator,
      generatedAt,
      gitSha,
      sourceFiles,
      buildOptions,
    }) ?? { schemaVersion: DATASET_SCHEMA_VERSION }
  );
}
