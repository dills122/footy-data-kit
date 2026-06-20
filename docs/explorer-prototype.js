const REPO_OWNER = 'dills122';
const REPO_NAME = 'footy-data-kit';
const RAW_BASE_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}`;
const JSON_HERO_NEW_URL = 'https://jsonhero.io/new';
const JSON_HERO_CREATE_URL = 'https://jsonhero.io/actions/createFromUrl';
const GITHUB_RELEASE_BASE_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`;
const LOCAL_DATA_URL = '../data-output/all-seasons.min.json';
const LOCAL_RELEASES_URL = './release-notes/releases.json';
const LOCAL_EXPLORER_LINKS_URL = './explorer-links.json';
const dataCache = new Map();

const state = {
  releases: [],
  explorerLinks: null,
  data: null,
  selectedSource: 'local',
  selectedSeason: null,
  selectedTier: null,
  selectedTarget: 'table',
};

const elements = {
  sourceSelect: document.querySelector('#source-select'),
  seasonSelect: document.querySelector('#season-select'),
  tierSelect: document.querySelector('#tier-select'),
  targetSelect: document.querySelector('#target-select'),
  jsonHeroSelectedLink: document.querySelector('#jsonhero-selected-link'),
  jsonHeroFullLink: document.querySelector('#jsonhero-full-link'),
  rawLink: document.querySelector('#raw-link'),
  copyPathButton: document.querySelector('#copy-path-button'),
  statusMessage: document.querySelector('#status-message'),
  rawUrlOutput: document.querySelector('#raw-url-output'),
  pathOutput: document.querySelector('#path-output'),
  sourceKind: document.querySelector('#source-kind'),
  previewCount: document.querySelector('#preview-count'),
  previewTableBody: document.querySelector('#preview-table-body'),
  jsonPreview: document.querySelector('#json-preview'),
  statSeasons: document.querySelector('#stat-seasons'),
  statTotalRows: document.querySelector('#stat-total-rows'),
  statSeasonTiers: document.querySelector('#stat-season-tiers'),
  statSelectedRows: document.querySelector('#stat-selected-rows'),
};

function rawDataUrlForRef(ref) {
  return `${RAW_BASE_URL}/${ref}/data-output/all-seasons.min.json`;
}

function getLatestReleaseTag() {
  return state.releases[0]?.tag || 'v1.0.0';
}

function getSelectedRawUrl() {
  if (state.selectedSource === 'local') return rawDataUrlForRef('main');
  if (state.selectedSource === 'current') return rawDataUrlForRef('main');

  return rawDataUrlForRef(state.selectedSource);
}

function releaseDownloadUrlForTag(tag) {
  return `${GITHUB_RELEASE_BASE_URL}/download/${tag}/all-seasons.min.json`;
}

function getSelectedJsonHeroSourceUrl() {
  const latestTag = getLatestReleaseTag();

  if (state.selectedSource === 'local') return releaseDownloadUrlForTag(latestTag);
  if (state.selectedSource === 'current') return rawDataUrlForRef('main');

  return releaseDownloadUrlForTag(state.selectedSource);
}

function getSelectedSourceLabel() {
  if (state.selectedSource === 'local') return 'Local checked-in data';
  if (state.selectedSource === 'current') return 'Current repo main';
  if (state.selectedSource === getLatestReleaseTag())
    return `Latest release ${state.selectedSource}`;
  return `Release ${state.selectedSource}`;
}

function buildJsonHeroUrlForRawUrl(rawUrl) {
  const url = new URL(JSON_HERO_CREATE_URL);
  url.searchParams.set('jsonUrl', rawUrl);
  url.searchParams.set('utm_source', 'footy-data-kit');
  return url.toString();
}

function buildJsonHeroUrlForJson(value) {
  const json = JSON.stringify(value, null, 2);
  const url = new URL(JSON_HERO_NEW_URL);
  url.searchParams.set('j', base64EncodeUtf8(json));
  url.searchParams.set('readonly', 'true');
  url.searchParams.set('title', `${getSelectedSourceLabel()} ${getJsonHeroPath()}`);
  url.searchParams.set('utm_source', 'footy-data-kit');
  return {
    href: url.toString(),
    byteLength: new TextEncoder().encode(json).byteLength,
  };
}

function getStoredJsonHeroUrl(sourceUrl) {
  const jsonHero = state.explorerLinks?.explorer?.jsonHero;
  if (!jsonHero?.url) return null;
  if (jsonHero.sourceUrl === sourceUrl) return jsonHero.url;

  const generatedTag = state.explorerLinks?.tag;
  const usesGeneratedRelease =
    state.selectedSource === generatedTag ||
    (state.selectedSource === 'local' && generatedTag === getLatestReleaseTag());

  return usesGeneratedRelease ? jsonHero.url : null;
}

function base64EncodeUtf8(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function getSeasonKeys() {
  return Object.keys(state.data?.seasons || {}).sort((left, right) => Number(left) - Number(right));
}

function getSelectedSeason() {
  if (!state.selectedSeason) return null;
  return state.data?.seasons?.[state.selectedSeason] || null;
}

function getTierKeys(season) {
  return Object.keys(season || {})
    .filter((key) => /^tier\d+$/.test(key))
    .sort((left, right) => Number(left.replace('tier', '')) - Number(right.replace('tier', '')));
}

function getSelectedTier() {
  const season = getSelectedSeason();
  if (!season || !state.selectedTier) return null;
  return season[state.selectedTier] || null;
}

function getSelectedRows() {
  const tier = getSelectedTier();
  return tier?.table || [];
}

function countLeagueRows(data) {
  let rowCount = 0;
  for (const season of Object.values(data?.seasons || {})) {
    for (const [key, tier] of Object.entries(season || {})) {
      if (!/^tier\d+$/.test(key)) continue;
      rowCount += tier.table?.length || 0;
      for (const division of tier.divisions || []) {
        rowCount += division.table?.length || 0;
      }
    }
  }
  return rowCount;
}

function getJsonHeroPath() {
  const seasonPart = state.selectedSeason ? `.seasons.${state.selectedSeason}` : '.seasons';
  const tierPart = state.selectedTier ? `.${state.selectedTier}` : '';

  switch (state.selectedTarget) {
    case 'dataset':
      return '$';
    case 'seasons':
      return '$.seasons';
    case 'season':
      return `$${seasonPart}`;
    case 'seasonInfo':
      return `$${seasonPart}.seasonInfo`;
    case 'tier':
      return `$${seasonPart}${tierPart}`;
    case 'table':
      return `$${seasonPart}${tierPart}.table`;
    case 'firstRow':
      return `$${seasonPart}${tierPart}.table.0`;
    default:
      return '$';
  }
}

function getPreviewValue() {
  const season = getSelectedSeason();
  const tier = getSelectedTier();
  const rows = getSelectedRows();

  switch (state.selectedTarget) {
    case 'dataset':
      return {
        note: 'The full dataset is intentionally not sent through the selected JSON action. Use the full dataset link if you want to test JSON Hero with the complete file.',
        jsonHeroSourceUrl: getSelectedJsonHeroSourceUrl(),
        previewRawUrl: getSelectedRawUrl(),
        metadata: state.data?.metadata || null,
        seasonCount: getSeasonKeys().length,
        leagueRowCount: countLeagueRows(state.data),
      };
    case 'seasons':
      return {
        seasonCount: getSeasonKeys().length,
        firstSeason: getSeasonKeys()[0],
        latestSeason: getSeasonKeys().at(-1),
      };
    case 'season':
      return season;
    case 'seasonInfo':
      return season?.seasonInfo || null;
    case 'tier':
      return tier;
    case 'table':
      return rows;
    case 'firstRow':
      return rows[0] || null;
    default:
      return null;
  }
}

function renderSourceOptions() {
  const latestTag = getLatestReleaseTag();
  const options = [
    { value: 'local', label: `Local checked-in data (${latestTag} shape)` },
    { value: latestTag, label: `Latest release (${latestTag})` },
    { value: 'current', label: 'Current repo main (WIP)' },
    ...state.releases
      .filter((release) => release.tag !== latestTag)
      .map((release) => ({ value: release.tag, label: `Release ${release.tag}` })),
  ];

  elements.sourceSelect.innerHTML = options
    .map((option) => `<option value="${option.value}">${option.label}</option>`)
    .join('');
  elements.sourceSelect.value = state.selectedSource;
}

function renderSeasonOptions() {
  const seasons = getSeasonKeys();
  if (!state.selectedSeason || !seasons.includes(state.selectedSeason)) {
    state.selectedSeason = seasons.at(-1) || null;
  }

  elements.seasonSelect.innerHTML = seasons
    .map(
      (season) =>
        `<option value="${season}">${season}-${String(Number(season) + 1).slice(-2)}</option>`
    )
    .join('');
  elements.seasonSelect.value = state.selectedSeason || '';
}

function renderTierOptions() {
  const tierKeys = getTierKeys(getSelectedSeason());
  if (!state.selectedTier || !tierKeys.includes(state.selectedTier)) {
    state.selectedTier = tierKeys[0] || null;
  }

  elements.tierSelect.innerHTML = tierKeys
    .map((tier) => `<option value="${tier}">${tier}</option>`)
    .join('');
  elements.tierSelect.disabled = tierKeys.length === 0;
  elements.tierSelect.value = state.selectedTier || '';
}

function renderStats() {
  const season = getSelectedSeason();
  const rows = getSelectedRows();
  elements.statSeasons.textContent = String(getSeasonKeys().length || '-');
  elements.statTotalRows.textContent = String(countLeagueRows(state.data) || '-');
  elements.statSeasonTiers.textContent = String(getTierKeys(season).length || '-');
  elements.statSelectedRows.textContent = String(rows.length || '-');
}

function renderTablePreview() {
  const rows = getSelectedRows().slice(0, 12);

  if (!rows.length) {
    elements.previewTableBody.innerHTML =
      '<tr><td colspan="9">No table rows for this selection.</td></tr>';
    elements.previewCount.textContent = '0 rows';
    return;
  }

  elements.previewCount.textContent = `${getSelectedRows().length} rows`;
  elements.previewTableBody.innerHTML = rows
    .map(
      (row) => `<tr>
        <td>${row.pos ?? ''}</td>
        <td>${escapeHtml(row.team ?? '')}</td>
        <td>${row.played ?? ''}</td>
        <td>${row.won ?? ''}</td>
        <td>${row.drawn ?? ''}</td>
        <td>${row.lost ?? ''}</td>
        <td>${row.goalDifference ?? ''}</td>
        <td>${row.points ?? ''}</td>
        <td>${escapeHtml(row.notes ?? '')}</td>
      </tr>`
    )
    .join('');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderLinks() {
  const rawUrl = getSelectedRawUrl();
  const jsonHeroSourceUrl = getSelectedJsonHeroSourceUrl();
  const storedJsonHeroUrl = getStoredJsonHeroUrl(jsonHeroSourceUrl);
  const path = getJsonHeroPath();
  const preview = getPreviewValue();
  const selectedJsonHero = buildJsonHeroUrlForJson(preview);

  elements.jsonHeroFullLink.href =
    storedJsonHeroUrl || buildJsonHeroUrlForRawUrl(jsonHeroSourceUrl);
  elements.rawLink.href = rawUrl;
  elements.rawUrlOutput.textContent = rawUrl;
  elements.pathOutput.textContent = path;
  elements.sourceKind.textContent =
    state.selectedSource === 'local' ? 'local preview, main handoff' : getSelectedSourceLabel();

  if (state.selectedTarget === 'dataset') {
    elements.jsonHeroSelectedLink.removeAttribute('href');
    elements.jsonHeroSelectedLink.setAttribute('aria-disabled', 'true');
    elements.jsonHeroSelectedLink.textContent = 'Use full dataset link';
  } else if (selectedJsonHero.byteLength > 750_000) {
    elements.jsonHeroSelectedLink.removeAttribute('href');
    elements.jsonHeroSelectedLink.setAttribute('aria-disabled', 'true');
    elements.jsonHeroSelectedLink.textContent = 'Selected JSON too large';
  } else {
    elements.jsonHeroSelectedLink.href = selectedJsonHero.href;
    elements.jsonHeroSelectedLink.removeAttribute('aria-disabled');
    elements.jsonHeroSelectedLink.textContent = 'Open selected JSON';
  }
}

function renderPreview() {
  const preview = getPreviewValue();
  elements.jsonPreview.textContent = JSON.stringify(preview, null, 2);
}

function renderAll() {
  elements.targetSelect.value = state.selectedTarget;
  renderSeasonOptions();
  renderTierOptions();
  renderLinks();
  renderStats();
  renderTablePreview();
  renderPreview();
}

function getDataUrlForSource(source) {
  if (source === 'local') return LOCAL_DATA_URL;
  if (source === 'current') return rawDataUrlForRef('main');
  return rawDataUrlForRef(source);
}

function validateDataset(data) {
  if (!data || typeof data !== 'object' || !data.seasons || typeof data.seasons !== 'object') {
    throw new Error('Dataset is missing a seasons object.');
  }
}

async function loadDataForSource(source) {
  if (dataCache.has(source)) {
    return dataCache.get(source);
  }

  const response = await fetch(getDataUrlForSource(source));
  if (!response.ok) {
    throw new Error(`Unable to load ${source} dataset (${response.status})`);
  }

  const data = await response.json();
  validateDataset(data);
  dataCache.set(source, data);
  return data;
}

async function setSource(source) {
  state.selectedSource = source;
  elements.sourceSelect.value = source;
  elements.statusMessage.textContent = `Loading ${getSelectedSourceLabel()}...`;

  try {
    state.data = await loadDataForSource(source);
    renderAll();
    elements.statusMessage.textContent =
      source === 'local'
        ? 'Loaded local checked-in data. JSON Hero links use public raw GitHub URLs.'
        : `Loaded ${getSelectedSourceLabel()}.`;
  } catch (error) {
    if (source === 'current') {
      const latestTag = getLatestReleaseTag();
      elements.statusMessage.textContent = `Current WIP failed to load; falling back to ${latestTag}.`;
      await setSource(latestTag);
      return;
    }

    throw error;
  }
}

async function loadReleases() {
  const response = await fetch(LOCAL_RELEASES_URL);
  if (!response.ok) {
    throw new Error(`Unable to load release manifest (${response.status})`);
  }
  state.releases = await response.json();
}

async function loadExplorerLinks() {
  const response = await fetch(LOCAL_EXPLORER_LINKS_URL);
  if (!response.ok) return;

  state.explorerLinks = await response.json();
}

function bindEvents() {
  elements.sourceSelect.addEventListener('change', () => {
    setSource(elements.sourceSelect.value).catch((error) => {
      elements.statusMessage.textContent =
        error instanceof Error ? error.message : 'Unable to load selected source.';
    });
  });

  elements.seasonSelect.addEventListener('change', () => {
    state.selectedSeason = elements.seasonSelect.value;
    renderAll();
  });

  elements.tierSelect.addEventListener('change', () => {
    state.selectedTier = elements.tierSelect.value;
    renderAll();
  });

  elements.targetSelect.addEventListener('change', () => {
    state.selectedTarget = elements.targetSelect.value;
    renderAll();
  });

  elements.copyPathButton.addEventListener('click', async () => {
    const path = getJsonHeroPath();
    await navigator.clipboard.writeText(path);
    elements.statusMessage.textContent = `Copied ${path}`;
  });
}

async function init() {
  bindEvents();

  try {
    await loadReleases();
    await loadExplorerLinks();
    renderSourceOptions();
    await setSource('local');
  } catch (error) {
    elements.statusMessage.textContent =
      error instanceof Error ? error.message : 'Unable to load prototype data.';
    elements.previewTableBody.innerHTML =
      '<tr><td colspan="9">Unable to load preview data.</td></tr>';
  }
}

init();
