import {
  buildDatasetMetadata,
  loadFootballData,
  saveFootballData,
  setSeasonRecord,
} from './generate-output-files.ts';

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mergeBuildOptions(existingBuildOptions, incomingBuildOptions) {
  const existing =
    existingBuildOptions &&
    typeof existingBuildOptions === 'object' &&
    !Array.isArray(existingBuildOptions)
      ? existingBuildOptions
      : {};
  const incoming =
    incomingBuildOptions &&
    typeof incomingBuildOptions === 'object' &&
    !Array.isArray(incomingBuildOptions)
      ? incomingBuildOptions
      : {};
  const merged = {
    ...existing,
    ...incoming,
  };

  const existingStart = toFiniteNumber(existing.startYear);
  const incomingStart = toFiniteNumber(incoming.startYear);
  if (existingStart != null && incomingStart != null) {
    merged.startYear = Math.min(existingStart, incomingStart);
  }

  const existingEnd = toFiniteNumber(existing.endYear);
  const incomingEnd = toFiniteNumber(incoming.endYear);
  if (existingEnd != null && incomingEnd != null) {
    merged.endYear = Math.max(existingEnd, incomingEnd);
  }

  return merged;
}

function getDatasetCoverageBuildOptions(dataset) {
  const seasonYears = Object.keys(dataset?.seasons || {})
    .map((seasonKey) => toFiniteNumber(seasonKey))
    .filter((seasonYear) => seasonYear != null);

  if (!seasonYears.length) return {};

  return {
    startYear: Math.min(...seasonYears),
    endYear: Math.max(...seasonYears),
  };
}

export function createDatasetStore(filePath, { generator, buildOptions } = {}) {
  const dataset = loadFootballData(filePath);
  const existingBuildOptions = {
    ...(dataset.metadata?.buildOptions || {}),
    ...getDatasetCoverageBuildOptions(dataset),
  };
  const metadata = buildDatasetMetadata({
    generator,
    buildOptions: mergeBuildOptions(existingBuildOptions, buildOptions),
  });

  function save() {
    saveFootballData(filePath, dataset, { metadata });
    return dataset;
  }

  function writeSeason(seasonKey, seasonRecord) {
    setSeasonRecord(dataset, seasonKey, seasonRecord);
    return save();
  }

  return {
    dataset,
    metadata,
    save,
    writeSeason,
  };
}

export default {
  createDatasetStore,
};
