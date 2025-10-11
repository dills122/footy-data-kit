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
