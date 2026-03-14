const ALLOWED_SOURCES = Object.freeze(['promotion', 'overview', 'both', 'all']);

export function parseRequestedSources(envValue) {
  if (!envValue) return null;

  const values = String(envValue)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!values.length) return null;

  const requestedSources = new Set();
  for (const value of values) {
    if (!ALLOWED_SOURCES.includes(value)) {
      throw new Error(
        `Unsupported WIKI_TEST_SOURCE value "${value}". Allowed sources: ${ALLOWED_SOURCES.join(
          ', '
        )}`
      );
    }
    if (value === 'all' || value === 'both') {
      requestedSources.add('promotion');
      requestedSources.add('overview');
      continue;
    }
    requestedSources.add(value);
  }

  return requestedSources;
}

export function getPageSources(page) {
  if (page?.source === 'both') {
    return ['promotion', 'overview'];
  }
  return [page?.source || 'promotion'];
}

export function getRequestedPageSources(page, requestedSources) {
  const pageSources = getPageSources(page);
  if (!requestedSources) return pageSources;
  return pageSources.filter((source) => requestedSources.has(source));
}

export default {
  parseRequestedSources,
  getPageSources,
  getRequestedPageSources,
};
