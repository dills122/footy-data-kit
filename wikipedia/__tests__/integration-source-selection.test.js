import {
  getRequestedPageSources,
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

  test('getRequestedPageSources applies promotion and overview filters to dual-source fixtures', () => {
    const bothFixture = { source: 'both' };

    expect(getRequestedPageSources(bothFixture, parseRequestedSources('promotion'))).toEqual([
      'promotion',
    ]);
    expect(getRequestedPageSources(bothFixture, parseRequestedSources('overview'))).toEqual([
      'overview',
    ]);
    expect(getRequestedPageSources(bothFixture, parseRequestedSources('both'))).toEqual([
      'promotion',
      'overview',
    ]);
    expect(getRequestedPageSources(bothFixture, parseRequestedSources('all'))).toEqual([
      'promotion',
      'overview',
    ]);
  });

  test('getRequestedPageSources drops fixtures that do not match the requested filter', () => {
    expect(
      getRequestedPageSources({ source: 'overview' }, parseRequestedSources('promotion'))
    ).toEqual([]);
    expect(getRequestedPageSources({}, parseRequestedSources('overview'))).toEqual([]);
  });
});
