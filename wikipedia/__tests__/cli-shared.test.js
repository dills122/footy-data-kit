import { Command } from 'commander';
import { WIKIPEDIA_DEFAULT_OUTPUT_DIR } from '../config.js';
import {
  addYearOptions,
  buildCommonRunOptions,
  buildDatasetOutput,
  parseSeasonRange,
} from '../cli/shared.js';

describe('cli-shared helpers', () => {
  test('parseSeasonRange parses numeric start/end options', () => {
    expect(
      parseSeasonRange(
        {
          start: '1990',
          end: '1991',
        },
        { start: '1888', end: '2000' }
      )
    ).toEqual({ startYear: 1990, endYear: 1991 });
  });

  test('buildCommonRunOptions coerces boolean command options', () => {
    expect(
      buildCommonRunOptions({
        updateOnly: true,
        forceUpdate: false,
        ignoreWarYears: 'true',
        includeWarPlaceholders: 1,
      })
    ).toEqual({
      updateOnly: true,
      forceUpdate: false,
      ignoreWarYears: true,
      includeWarPlaceholders: true,
    });
  });

  test('buildDatasetOutput respects configured output dir', () => {
    expect(buildDatasetOutput('promotion', '/tmp/data-output')).toContain(
      'wiki_promotion_relegations_by_season'
    );
  });

  test('addYearOptions wires consistent defaults', () => {
    const command = new Command();
    addYearOptions(command, { start: '1888', end: '2000' });
    command.parse(['node', 'test', '--start', '1900', '--end', '1910']);

    expect(command.opts().start).toBe('1900');
    expect(command.opts().end).toBe('1910');
    expect(command.opts().output).toBe(WIKIPEDIA_DEFAULT_OUTPUT_DIR);
  });
});
