import { CLUB_IDENTITY_RULES } from './club-identity-config.js';

const TEAM_NAME_NORMALIZATION_ALIASES = {
  'afc wimbledon': 'afc wimbledon',
  'brighton & hove albion': 'brighton and hove albion',
  'brighton and hove albion': 'brighton and hove albion',
  'bradford (park avenue)': 'bradford park avenue',
  'bradford park avenue': 'bradford park avenue',
  'dagenham & redbridge': 'dagenham and redbridge',
  'dagenham and redbridge': 'dagenham and redbridge',
  'fc halifax town': 'fc halifax town',
  'halifax town': 'halifax town',
  'harrogate town': 'harrogate town',
  'harrogate town afc': 'harrogate town',
  'harrogate town a f c': 'harrogate town',
  qpr: 'queens park rangers',
  'queens park rangers': 'queens park rangers',
  'west brom': 'west bromwich albion',
  'west bromwich': 'west bromwich albion',
  wolves: 'wolverhampton wanderers',
  'sheffield united': 'sheffield united',
  wba: 'west bromwich albion',
  wimbledon: 'wimbledon',
  'wrexham a f c': 'wrexham',
  'wrexham afc': 'wrexham',
  'newport county': 'newport county',
};

export function normalizeTeamNameText(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\//g, ' and ')
    .replace(/[.'"]/g, '')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildClubIdentityAliasMap() {
  const entries = [];

  for (const rule of CLUB_IDENTITY_RULES) {
    for (const alias of rule.aliases || []) {
      entries.push([normalizeTeamNameText(alias), rule.clubKey]);
    }
  }

  return Object.fromEntries(entries);
}

const TEAM_NAME_CANONICAL_FORMS = {
  ...TEAM_NAME_NORMALIZATION_ALIASES,
  ...buildClubIdentityAliasMap(),
};

export function canonicalizeTeamName(value) {
  if (typeof value !== 'string') return value;
  const normalized = normalizeTeamNameText(value);
  return TEAM_NAME_CANONICAL_FORMS[normalized] || normalized;
}

export default {
  canonicalizeTeamName,
  normalizeTeamNameText,
};
