import {
  buildDatasetMetadata,
  loadFootballData,
  saveFootballData,
  setSeasonRecord,
} from './generate-output-files.js';

export function createDatasetStore(filePath, { generator, buildOptions } = {}) {
  const dataset = loadFootballData(filePath);
  const metadata = buildDatasetMetadata({ generator, buildOptions });

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
