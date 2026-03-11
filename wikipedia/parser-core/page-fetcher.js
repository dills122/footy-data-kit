import { buildWikipediaArticleUrl, WIKIPEDIA_FETCH_DELAY_MS } from '../config.js';
import { fetchHtmlForSlug, wait } from '../utils.js';

export function buildWikipediaPageUrl(seasonSlug) {
  return buildWikipediaArticleUrl(seasonSlug);
}

export async function fetchWikipediaSeasonPage(
  seasonSlug,
  { onError = () => {}, shouldLogError = true } = {}
) {
  const pageUrl = buildWikipediaPageUrl(seasonSlug);
  let html;

  try {
    html = await fetchHtmlForSlug(seasonSlug);
  } catch (error) {
    const message = `❌ Failed to fetch page for ${seasonSlug} (${pageUrl}): ${error.message}`;
    if (shouldLogError) {
      console.error(message);
    }
    onError({
      seasonSlug,
      pageUrl,
      error,
      message,
    });
    return null;
  }

  await wait(WIKIPEDIA_FETCH_DELAY_MS);
  return { html, pageUrl };
}
