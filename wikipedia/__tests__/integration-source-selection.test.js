import {
  getPageSources,
  parseRequestedSources,
} from '../__integration_tests__/source-selection.js';

describe('integration source selection helpers', () => {
  test('parseRequestedSources accepts promotion and overview directly', () => {
    expect(Array.from(parseRequestedSources('promotion'))).toEqual(['promotion']);
    expect(Array.from(parseRequestedSources('overview'))).toEqual(['overview']);
  });

  test('parseRequestedSources expands both and all to both parser sources', () => {
    expect(Array.from(parseRequestedSources('both')).sort()).toEqual(['overview', 'promotion']);
    expect(Array.from(parseRequestedSources('all')).sort()).toEqual(['overview', 'promotion']);
    expect(Array.from(parseRequestedSources('promotion,all')).sort()).toEqual([
      'overview',
      'promotion',
    ]);
  });

  test('parseRequestedSources rejects unsupported filter values', () => {
    expect(() => parseRequestedSources('rsssf')).toThrow(/Unsupported WIKI_TEST_SOURCE value/);
  });

  test('getPageSources expands both fixtures and defaults missing source to promotion', () => {
    expect(getPageSources({ source: 'both' })).toEqual(['promotion', 'overview']);
    expect(getPageSources({ source: 'overview' })).toEqual(['overview']);
    expect(getPageSources({})).toEqual(['promotion']);
  });
});
