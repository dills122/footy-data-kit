import { resolveWikipediaDatasetPath, WIKIPEDIA_DEFAULT_OUTPUT_DIR } from './config.js';

const DEFAULT_INTERRUPT_MESSAGE = '\n🛑 Interrupted, Last entry saved will be the last one';

export function addYearOptions(command, defaults) {
  const safeDefaults = defaults || {};
  return command
    .option('-s, --start <year>', 'Start year', safeDefaults.start || '1888')
    .option('-e, --end <year>', 'End year', safeDefaults.end || '2000')
    .option('-o, --output <path>', 'Output directory', WIKIPEDIA_DEFAULT_OUTPUT_DIR)
    .option('-u, --update-only', 'Skip seasons that already contain tier data', false)
    .option('-f, --force-update', 'Rebuild seasons even if data exists', false)
    .option('--ignore-war-years', 'Skip WWI/WWII suspension seasons', false);
}

export function parseSeasonRange(opts, defaults = {}) {
  return {
    startYear: Number.parseInt(opts.start ?? defaults.start, 10),
    endYear: Number.parseInt(opts.end ?? defaults.end, 10),
  };
}

export function buildDatasetOutput(sourceKey, outputDir) {
  return resolveWikipediaDatasetPath(sourceKey, outputDir || WIKIPEDIA_DEFAULT_OUTPUT_DIR);
}

export function buildCommonRunOptions(opts) {
  return {
    updateOnly: Boolean(opts.updateOnly),
    forceUpdate: Boolean(opts.forceUpdate),
    ignoreWarYears: Boolean(opts.ignoreWarYears),
  };
}

export function installInterruptHandler() {
  const handler = () => {
    console.log(DEFAULT_INTERRUPT_MESSAGE);
    process.exit(0);
  };
  process.on('SIGINT', handler);
}
