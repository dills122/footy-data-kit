import { jest } from '@jest/globals';
import { WIKIPEDIA_FETCH_DELAY_MS } from '../../config.js';

const fetchHtmlForSlugMock = jest.fn();
const waitMock = jest.fn().mockResolvedValue(undefined);

await jest.unstable_mockModule('../../utils.js', () => ({
  fetchHtmlForSlug: fetchHtmlForSlugMock,
  wait: waitMock,
}));

const { fetchWikipediaSeasonPage } = await import('../../parser-core/page-fetcher.js');

describe('page-fetcher', () => {
  afterEach(() => {
    fetchHtmlForSlugMock.mockReset();
    waitMock.mockClear();
    jest.restoreAllMocks();
  });

  test('fetchWikipediaSeasonPage returns pageUrl and html for successful fetches', async () => {
    fetchHtmlForSlugMock.mockResolvedValue('<html>page</html>');

    const result = await fetchWikipediaSeasonPage('1898-99_Football_League');

    expect(result).toMatchObject({
      html: '<html>page</html>',
      pageUrl: 'https://en.wikipedia.org/wiki/1898-99_Football_League',
    });
    expect(fetchHtmlForSlugMock).toHaveBeenCalledWith('1898-99_Football_League');
    expect(waitMock).toHaveBeenCalledWith(WIKIPEDIA_FETCH_DELAY_MS);
  });

  test('fetchWikipediaSeasonPage logs and returns null on fetch failure', async () => {
    fetchHtmlForSlugMock.mockRejectedValue(new Error('bad'));
    const onError = jest.fn();
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await fetchWikipediaSeasonPage('missing', { onError });

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '❌ Failed to fetch page for missing (https://en.wikipedia.org/wiki/missing): bad'
      )
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        seasonSlug: 'missing',
        error: expect.any(Error),
      })
    );
    expect(waitMock).not.toHaveBeenCalled();
  });
});
