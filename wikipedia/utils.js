import * as fs from 'node:fs';
import * as path from 'node:path';

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function saveResults(results, outputFile) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`💾 Progress saved to ${outputFile}`);
}

let wikipediaClient = null;
export async function getWikipediaClient() {
  if (!wikipediaClient) {
    const mod = await import('wikipedia');
    wikipediaClient = mod.default || mod;
    // Set a sensible default user agent to avoid 403 from Wikimedia APIs.
    try {
      const ua =
        process.env.WIKIPEDIA_USER_AGENT ||
        'footy-data-kit (+https://github.com/dills122/footy-data-kit)';
      if (typeof wikipediaClient.setUserAgent === 'function') {
        wikipediaClient.setUserAgent(ua);
      }
    } catch (e) {
      // ignore failures setting user agent
    }
  }
  // Adapt newer `wikipedia` package which exposes functions like `html(title)`
  // but does not provide `page(title)` returning an object with `.html()`.
  // Provide a lightweight adapter so existing code can continue calling
  // `const page = await wikipedia.page(title); await page.html()`.
  if (typeof wikipediaClient.page !== 'function' && typeof wikipediaClient.html === 'function') {
    const orig = wikipediaClient;
    const adapted = Object.assign({}, orig);
    adapted.page = (title, opts) => ({
      html: async () => orig.html(title, opts),
      summary: async () =>
        typeof orig.summary === 'function' ? orig.summary(title, opts) : undefined,
      content: async () =>
        typeof orig.content === 'function' ? orig.content(title, opts) : undefined,
      images: async () =>
        typeof orig.images === 'function' ? orig.images(title, opts) : undefined,
      tables: async () =>
        typeof orig.tables === 'function' ? orig.tables(title, opts) : undefined,
      // allow spies on `.html` by returning functions on the page object
    });
    wikipediaClient = adapted;
  }

  return wikipediaClient;
}

export function normalizeHeader(txt) {
  const t = txt.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.]/g, '');

  if (t === 'pos' || t === 'position' || t === 'no') return 'pos';
  if (t === 'team' || t === 'club' || t === 'side') return 'team';
  if (t === 'pld' || t === 'p' || t === 'played' || t === 'games played') return 'played';
  if (t === 'w' || t === 'won') return 'won';
  if (t === 'd' || t === 'draw' || t === 'drawn') return 'drawn';
  if (t === 'l' || t === 'lost') return 'lost';
  if (t === 'gf' || t === 'goals for' || t === 'f' || t === 'for') return 'goalsFor';
  if (t === 'ga' || t === 'goals against' || t === 'a' || t === 'against') return 'goalsAgainst';
  if (t === 'gd' || t === 'goal difference' || t === 'difference') return 'goalDifference';
  if (t === 'gav' || t === 'gavg' || t === 'goal average' || t === 'ga v' || t === 'g av')
    return 'goalAverage';
  if (t === 'pts' || t === 'points' || t === 'points total') return 'points';
  if (t.includes('qualification') || t.includes('relegation') || t === 'notes' || t === 'remarks')
    return 'notes';
  return t;
}

export function wasRelegated(note) {
  const n = String(note || '').toLowerCase();
  if (!n) return false;

  if (n.includes('relegat')) return true;
  if (n.includes('demoted to the')) return true;

  if (n.includes('re-elected')) return false;
  if (n.includes('reprived from re-election') || n.includes('reprieved from re-election'))
    return false;

  return false;
}

export function wasPromoted(note) {
  return String(note || '')
    .toLowerCase()
    .includes('promot');
}

export function isExpansionTeam(note) {
  const n = String(note || '').toLowerCase();
  return (
    n.includes('expansion') ||
    n.includes('new club') ||
    n.includes('admitted') ||
    n.includes('joined league')
  );
}

export function cellText($, cell) {
  const clone = $(cell).clone();
  clone.find('sup.reference, span.reference, style, script, .navbar, .plainlinks, .hlist').remove();
  return clone
    .text()
    .replace(/\[\d+\]/g, '')
    .trim();
}

// Robust HTML fetch for a wiki slug. Tries in order:
// 1) wikipedia.page(slug).html()
// 2) wikipedia.html(slug)
// 3) direct GET of https://en.wikipedia.org/wiki/<encoded slug>
export async function fetchHtmlForSlug(slug) {
  const wikipedia = await getWikipediaClient();

  // 1) try page().html()
  try {
    if (typeof wikipedia.page === 'function') {
      const page = await wikipedia.page(slug);
      if (page && typeof page.html === 'function') {
        return await page.html();
      }
    }
  } catch (e) {
    // continue to next fallback
  }

  // 2) try wikipedia.html(slug)
  try {
    if (typeof wikipedia.html === 'function') {
      return await wikipedia.html(slug);
    }
  } catch (e) {
    // continue to next fallback
  }

  // 3) direct fetch of the article HTML
  const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(slug)}`;
  const headers = {
    'User-Agent':
      process.env.WIKIPEDIA_USER_AGENT ||
      'footy-data-kit (+https://github.com/dills122/footy-data-kit)',
  };
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}
