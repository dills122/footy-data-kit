const TEAM_NAME_CANONICAL_FORMS = {
  glossop: 'glossop',
  'glossop north end': 'glossop',
};

export function canonicalizeTeamName(value) {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  return TEAM_NAME_CANONICAL_FORMS[normalized] || normalized;
}

export default {
  canonicalizeTeamName,
};
