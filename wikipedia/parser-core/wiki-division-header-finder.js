import { WIKIPEDIA_DIVISION_HEADER_SLUGS, WIKIPEDIA_GENERIC_TABLE_FALLBACKS } from '../config.js';

export function findDivisionHeader($, division) {
  const candidateSlugs = WIKIPEDIA_DIVISION_HEADER_SLUGS[division] || [];
  for (const slug of candidateSlugs) {
    const header = $(slug);
    if (header.length) return header;
  }

  const normalizedDivisionText = division === 'second' ? 'second division' : 'first division';
  const headlineMatch = $('span.mw-headline')
    .filter((_, el) => $(el).text().trim().toLowerCase().includes(normalizedDivisionText))
    .first();
  if (headlineMatch.length) return headlineMatch;

  for (const slug of WIKIPEDIA_GENERIC_TABLE_FALLBACKS) {
    const header = $(slug);
    if (header.length) return header;
  }

  return null;
}
