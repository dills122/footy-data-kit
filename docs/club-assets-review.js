/* global document, localStorage */

const CLUB_METADATA_URL = '../data/club-metadata.json';
const REVIEW_URL = '../data/club-assets-review.json';
const FLAGS_STORAGE_KEY = 'footy-data-kit:club-assets-review-flags:v1';
const ALL_STATUSES = [
  'all',
  'usable',
  'placeholder',
  'restricted',
  'needs-review',
  'needs-more-research',
];
const STATUS_LABELS = {
  all: 'all',
  usable: 'usable',
  placeholder: 'placeholder',
  restricted: 'restricted',
  'needs-review': 'needs review',
  'needs-more-research': 'needs more research',
};

const state = {
  clubs: [],
  issues: [],
  flags: {},
  view: 'review',
  status: 'needs-review',
  issue: 'all',
  source: 'all',
  search: '',
  flaggedOnly: false,
  selectedClubKey: null,
};

const elements = {
  searchInput: document.querySelector('#search-input'),
  issueSelect: document.querySelector('#issue-select'),
  sourceSelect: document.querySelector('#source-select'),
  resetButton: document.querySelector('#reset-button'),
  flaggedOnlyInput: document.querySelector('#flagged-only-input'),
  exportFlagsButton: document.querySelector('#export-flags-button'),
  clearFlagsButton: document.querySelector('#clear-flags-button'),
  flagCount: document.querySelector('#flag-count'),
  viewTabs: document.querySelector('#view-tabs'),
  statusTabs: document.querySelector('#status-tabs'),
  loadStatus: document.querySelector('#load-status'),
  statTotal: document.querySelector('#stat-total'),
  statVisible: document.querySelector('#stat-visible'),
  statReview: document.querySelector('#stat-review'),
  statCandidates: document.querySelector('#stat-candidates'),
  clubListCount: document.querySelector('#club-list-count'),
  clubList: document.querySelector('#club-list'),
  clubDetail: document.querySelector('#club-detail'),
  reviewWorkspace: document.querySelector('#review-workspace'),
  auditWorkspace: document.querySelector('#audit-workspace'),
  issueWorkspace: document.querySelector('#issue-workspace'),
  auditCount: document.querySelector('#audit-count'),
  auditList: document.querySelector('#audit-list'),
  issueCount: document.querySelector('#issue-count'),
  issueTableBody: document.querySelector('#issue-table-body'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function readStoredFlags() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FLAGS_STORAGE_KEY) || '{}');
    if (parsed.flags && typeof parsed.flags === 'object') return parsed.flags;
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {
    return {};
  }
  return {};
}

function writeStoredFlags() {
  try {
    localStorage.setItem(
      FLAGS_STORAGE_KEY,
      JSON.stringify({
        metadata: {
          generator: 'club-assets-review-ui',
          savedAt: new Date().toISOString(),
        },
        flags: state.flags,
      })
    );
  } catch {
    elements.loadStatus.textContent = 'Flags changed, but browser storage was not available.';
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return response.json();
}

function getCrest(club) {
  return club.assets?.crest || { status: 'needs-more-research' };
}

function getCandidates(club) {
  return getCrest(club).candidates || [];
}

function getCandidateSources(club) {
  return [
    ...new Set(
      getCandidates(club)
        .map((candidate) => candidate.source)
        .filter(Boolean)
    ),
  ];
}

function buildSearchText(record) {
  return [
    record.clubKey,
    record.club.canonicalName,
    record.club.clubId,
    getCrest(record.club).status,
    ...getCandidateSources(record.club),
    ...getCandidates(record.club).flatMap((candidate) => [
      candidate.assetId,
      candidate.fileTitle,
      candidate.status,
      candidate.source,
      candidate.license?.shortName,
      candidate.verification?.reviewReasons?.join(' '),
      candidate.notes,
    ]),
    ...(record.issues || []).flatMap((issue) => [issue.type, issue.message, issue.assetId]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function issueCountFor(record) {
  return record.issues?.length || 0;
}

function candidateCountFor(record) {
  return getCandidates(record.club).length;
}

function flagKeyFor(record, candidate) {
  return `${record.clubKey}::${candidate.assetId}`;
}

function isFlagged(record, candidate) {
  return Boolean(state.flags[flagKeyFor(record, candidate)]);
}

function recordHasFlag(record) {
  return getCandidates(record.club).some((candidate) => isFlagged(record, candidate));
}

function buildFlagRecord(record, candidate) {
  return {
    clubKey: record.clubKey,
    clubId: record.club.clubId || null,
    canonicalName: record.club.canonicalName,
    assetKind: candidate.kind || 'crest',
    assetId: candidate.assetId,
    fileTitle: candidate.fileTitle || null,
    candidateStatus: candidate.status || null,
    crestStatus: getCrest(record.club).status || null,
    source: candidate.source || null,
    sourceUrl: candidate.sourceUrl || null,
    pageUrl: candidate.pageUrl || null,
    imageUrl: candidate.imageUrl || null,
    license: candidate.license || null,
    verification: candidate.verification || null,
    reviewIssues: record.issues.filter((issue) => issue.assetId === candidate.assetId),
    flaggedAt: new Date().toISOString(),
  };
}

function findCandidateByFlagKey(flagKey) {
  for (const record of state.clubs) {
    for (const candidate of getCandidates(record.club)) {
      if (flagKeyFor(record, candidate) === flagKey) return { record, candidate };
    }
  }
  return null;
}

function toggleFlag(flagKey) {
  if (state.flags[flagKey]) {
    delete state.flags[flagKey];
  } else {
    const match = findCandidateByFlagKey(flagKey);
    if (!match) return;
    state.flags[flagKey] = buildFlagRecord(match.record, match.candidate);
  }
  writeStoredFlags();
  render();
}

function exportFlags() {
  const flags = Object.values(state.flags).sort((left, right) => {
    const clubDelta = left.canonicalName.localeCompare(right.canonicalName);
    if (clubDelta) return clubDelta;
    return String(left.assetId).localeCompare(String(right.assetId));
  });
  const payload = {
    metadata: {
      generator: 'club-assets-review-ui',
      exportedAt: new Date().toISOString(),
      flagCount: flags.length,
      sourceFiles: [CLUB_METADATA_URL, REVIEW_URL],
    },
    flags,
  };
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `club-asset-flags-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function sortRecords(records) {
  const statusOrder = {
    'needs-review': 0,
    'needs-more-research': 1,
    restricted: 3,
    placeholder: 4,
    usable: 5,
  };

  return [...records].sort((left, right) => {
    const statusDelta =
      (statusOrder[getCrest(left.club).status] ?? 10) -
      (statusOrder[getCrest(right.club).status] ?? 10);
    if (statusDelta) return statusDelta;
    const issueDelta = issueCountFor(right) - issueCountFor(left);
    if (issueDelta) return issueDelta;
    return left.club.canonicalName.localeCompare(right.club.canonicalName);
  });
}

function getVisibleRecords() {
  const query = state.search.trim().toLowerCase();
  return sortRecords(
    state.clubs.filter((record) => {
      const crest = getCrest(record.club);
      if (state.status !== 'all' && crest.status !== state.status) return false;
      if (state.issue !== 'all' && !record.issues.some((issue) => issue.type === state.issue))
        return false;
      if (
        state.source !== 'all' &&
        !getCandidates(record.club).some((candidate) => candidate.source === state.source)
      ) {
        return false;
      }
      if (state.flaggedOnly && !recordHasFlag(record)) return false;
      if (query && !record.searchText.includes(query)) return false;
      return true;
    })
  );
}

function getVisibleIssues(records) {
  const visibleClubKeys = new Set(records.map((record) => record.clubKey));
  return state.issues.filter((issue) => visibleClubKeys.has(issue.clubKey));
}

function renderStatusTabs() {
  const counts = state.clubs.reduce(
    (result, record) => {
      const status = getCrest(record.club).status || 'needs-more-research';
      result.all += 1;
      result[status] = (result[status] || 0) + 1;
      return result;
    },
    { all: 0 }
  );

  elements.statusTabs.innerHTML = ALL_STATUSES.map((status) => {
    const label = STATUS_LABELS[status] || status;
    const count = counts[status] || 0;
    return `<button class="status-tab" type="button" data-status="${escapeHtml(
      status
    )}" aria-pressed="${state.status === status}"><span>${escapeHtml(
      label
    )}</span><strong>${count}</strong></button>`;
  }).join('');
}

function renderViewTabs() {
  elements.viewTabs.querySelectorAll('button[data-view]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.view === state.view));
  });
}

function renderFilterOptions() {
  const issueTypes = [...new Set(state.issues.map((issue) => issue.type))].sort();
  elements.issueSelect.innerHTML = [
    '<option value="all">all issues</option>',
    ...issueTypes.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`),
  ].join('');
  elements.issueSelect.value = state.issue;

  const sources = [
    ...new Set(state.clubs.flatMap((record) => getCandidateSources(record.club))),
  ].sort();
  elements.sourceSelect.innerHTML = [
    '<option value="all">all sources</option>',
    ...sources.map(
      (source) => `<option value="${escapeHtml(source)}">${escapeHtml(source)}</option>`
    ),
  ].join('');
  elements.sourceSelect.value = state.source;
}

function renderStats(records, visibleIssues) {
  const candidateCount = records.reduce((total, record) => total + candidateCountFor(record), 0);
  const flagCount = Object.keys(state.flags).length;
  elements.statTotal.textContent = String(state.clubs.length);
  elements.statVisible.textContent = String(records.length);
  elements.statReview.textContent = String(visibleIssues.length);
  elements.statCandidates.textContent = String(candidateCount);
  elements.clubListCount.textContent = `${records.length} clubs`;
  elements.auditCount.textContent = `${records.length} clubs`;
  elements.issueCount.textContent = `${visibleIssues.length} issues`;
  elements.flagCount.textContent = `${flagCount} flagged`;
  elements.exportFlagsButton.disabled = flagCount === 0;
  elements.clearFlagsButton.disabled = flagCount === 0;
}

function renderSourceRefs(record) {
  const sourceRefs = [
    ...(record.club.derived?.identitySources || []),
    ...(record.club.status?.sourceRefs || []),
  ].filter((source) => source.sourceUrl);
  const uniqueSourceRefs = [
    ...new Map(sourceRefs.map((source) => [source.sourceUrl, source])).values(),
  ];
  if (!uniqueSourceRefs.length) return '<span class="asset-muted">no club source links</span>';
  return uniqueSourceRefs
    .map(
      (source) =>
        `<a class="compact-link" href="${escapeHtml(
          source.sourceUrl
        )}" target="_blank" rel="noreferrer">${escapeHtml(source.type || 'source')}</a>`
    )
    .join('');
}

function renderClubList(records) {
  if (!records.length) {
    elements.clubList.innerHTML = '<p class="empty-state">No clubs match the current filters.</p>';
    state.selectedClubKey = null;
    return;
  }

  if (
    !state.selectedClubKey ||
    !records.some((record) => record.clubKey === state.selectedClubKey)
  ) {
    state.selectedClubKey = records[0].clubKey;
  }

  elements.clubList.innerHTML = records
    .map((record) => {
      const crest = getCrest(record.club);
      const selectedClass = record.clubKey === state.selectedClubKey ? ' is-selected' : '';
      return `<button class="club-row${selectedClass}" type="button" data-club-key="${escapeHtml(
        record.clubKey
      )}">
        <span class="club-row-main">
          <strong>${escapeHtml(record.club.canonicalName)}</strong>
          <span class="status-chip" data-status="${escapeHtml(crest.status)}">${escapeHtml(
        STATUS_LABELS[crest.status] || crest.status
      )}</span>
        </span>
        <span class="asset-muted">${candidateCountFor(record)}</span>
        <span class="club-row-meta">
          <span>${escapeHtml(record.club.status?.current || 'unknown')}</span>
          <span>${escapeHtml(getCandidateSources(record.club).join(', ') || 'no source')}</span>
          <span>${issueCountFor(record)} issues</span>
        </span>
      </button>`;
    })
    .join('');
}

function renderCandidateImage(candidate, clubName) {
  if (!candidate.imageUrl) return '<div class="candidate-empty">No image URL</div>';
  return `<img src="${escapeHtml(candidate.imageUrl)}" alt="${escapeHtml(
    `${clubName} ${candidate.status} crest candidate`
  )}" loading="lazy" referrerpolicy="no-referrer" />`;
}

function renderCandidateLinks(candidate) {
  const links = [
    candidate.sourceUrl
      ? `<a class="compact-link" href="${escapeHtml(
          candidate.sourceUrl
        )}" target="_blank" rel="noreferrer">source</a>`
      : '',
    candidate.pageUrl
      ? `<a class="compact-link" href="${escapeHtml(
          candidate.pageUrl
        )}" target="_blank" rel="noreferrer">file page</a>`
      : '',
    candidate.imageUrl && !candidate.imageUrl.startsWith('data:')
      ? `<a class="compact-link" href="${escapeHtml(
          candidate.imageUrl
        )}" target="_blank" rel="noreferrer">image</a>`
      : '',
  ].filter(Boolean);
  return links.length ? `<div class="candidate-links">${links.join('')}</div>` : '';
}

function renderSwatches(colors = []) {
  if (!colors.length) return '';
  return `<div class="swatches">${colors
    .map(
      (color) =>
        `<span class="swatch"><i style="background:${escapeHtml(color.hex)}"></i>${escapeHtml(
          color.role
        )} ${escapeHtml(color.hex)}</span>`
    )
    .join('')}</div>`;
}

function renderReviewReasons(candidate) {
  const reasons = candidate.verification?.reviewReasons || [];
  if (!reasons.length) return '<span class="asset-muted">none</span>';
  return reasons.map((reason) => `<span class="issue-chip">${escapeHtml(reason)}</span>`).join(' ');
}

function renderCandidate(candidate, record) {
  const clubName = record.club.canonicalName;
  const flagKey = flagKeyFor(record, candidate);
  const flagged = Boolean(state.flags[flagKey]);
  return `<article class="candidate-card">
    <div class="candidate-image-frame">${renderCandidateImage(candidate, clubName)}</div>
    <div class="candidate-body">
      <div class="candidate-title">
        <h3>${escapeHtml(candidate.fileTitle || candidate.assetId)}</h3>
        <span class="status-chip" data-status="${escapeHtml(candidate.status)}">${escapeHtml(
    STATUS_LABELS[candidate.status] || candidate.status
  )}</span>
        ${candidate.placeholder ? '<span class="issue-chip">generated</span>' : ''}
        ${flagged ? '<span class="flag-chip">flagged</span>' : ''}
      </div>
      <dl class="candidate-meta">
        <div>
          <dt>Source</dt>
          <dd>${escapeHtml(candidate.source || '-')}</dd>
        </div>
        <div>
          <dt>License</dt>
          <dd>${escapeHtml(candidate.license?.shortName || 'unknown')}</dd>
        </div>
        <div>
          <dt>Verification</dt>
          <dd>${escapeHtml(candidate.verification?.identityMatch || '-')} / ${escapeHtml(
    candidate.verification?.licenseCheck || '-'
  )}</dd>
        </div>
        <div>
          <dt>Review reasons</dt>
          <dd>${renderReviewReasons(candidate)}</dd>
        </div>
      </dl>
      ${renderSwatches(candidate.colors)}
      ${candidate.notes ? `<p class="asset-muted">${escapeHtml(candidate.notes)}</p>` : ''}
      <div class="flag-actions">
        <button class="flag-button" type="button" data-flag-key="${escapeHtml(
          flagKey
        )}" aria-pressed="${flagged}">
          ${flagged ? 'Unflag' : 'Flag image'}
        </button>
      </div>
      ${renderCandidateLinks(candidate)}
    </div>
  </article>`;
}

function renderDetail(records) {
  const record = records.find((entry) => entry.clubKey === state.selectedClubKey);
  if (!record) {
    elements.clubDetail.innerHTML = `<div class="detail-heading">
      <div class="detail-title-row"><h2>Select a club</h2></div>
      <p class="asset-muted">Choose a record from the club list to inspect candidate images.</p>
    </div>`;
    return;
  }

  const crest = getCrest(record.club);
  const candidates = getCandidates(record.club);

  elements.clubDetail.innerHTML = `<div class="detail-heading">
    <div class="detail-title-row">
      <h2>${escapeHtml(record.club.canonicalName)}</h2>
      <span class="status-chip" data-status="${escapeHtml(crest.status)}">${escapeHtml(
    STATUS_LABELS[crest.status] || crest.status
  )}</span>
      <span class="issue-chip">${issueCountFor(record)} issues</span>
    </div>
    <p class="asset-muted">${escapeHtml(record.club.clubId || record.clubKey)} · ${escapeHtml(
    record.club.status?.current || 'unknown'
  )} · ${escapeHtml(record.club.status?.reasonLabel || record.club.status?.reason || '')}</p>
    <div class="detail-links">
      ${renderSourceRefs(record)}
    </div>
  </div>
  <div class="candidate-grid">
    ${
      candidates.length
        ? candidates.map((candidate) => renderCandidate(candidate, record)).join('')
        : '<p class="empty-state">No crest candidates found for this club.</p>'
    }
  </div>`;
}

function renderAuditClub(record) {
  const crest = getCrest(record.club);
  const candidates = getCandidates(record.club);
  const preferred = candidates.find((candidate) => candidate.assetId === crest.preferred);
  return `<article class="audit-club">
    <div class="audit-club-heading">
      <div>
        <h3>${escapeHtml(record.club.canonicalName)}</h3>
        <p class="asset-muted">${escapeHtml(record.club.clubId || record.clubKey)} · ${escapeHtml(
    record.club.status?.current || 'unknown'
  )}</p>
      </div>
      <div class="audit-badges">
        <span class="status-chip" data-status="${escapeHtml(crest.status)}">${escapeHtml(
    STATUS_LABELS[crest.status] || crest.status
  )}</span>
        <span class="issue-chip">${candidateCountFor(record)} candidates</span>
        <span class="issue-chip">${issueCountFor(record)} issues</span>
      </div>
    </div>
    <div class="audit-links">
      <span class="asset-muted">Club links</span>
      ${renderSourceRefs(record)}
    </div>
    ${
      preferred
        ? `<p class="asset-muted">Preferred: ${escapeHtml(
            preferred.fileTitle || preferred.assetId
          )}</p>`
        : ''
    }
    <div class="audit-candidates">
      ${
        candidates.length
          ? candidates.map((candidate) => renderCandidate(candidate, record)).join('')
          : '<p class="empty-state">No crest candidates found for this club.</p>'
      }
    </div>
  </article>`;
}

function renderAuditList(records) {
  if (!records.length) {
    elements.auditList.innerHTML = '<p class="empty-state">No clubs match the current filters.</p>';
    return;
  }

  elements.auditList.innerHTML = records.map((record) => renderAuditClub(record)).join('');
}

function renderIssueTable(issues) {
  if (!issues.length) {
    elements.issueTableBody.innerHTML = '<tr><td colspan="4">No visible review issues.</td></tr>';
    return;
  }

  elements.issueTableBody.innerHTML = issues
    .slice(0, 250)
    .map(
      (issue) => `<tr>
        <td>${escapeHtml(issue.canonicalName || issue.clubKey)}</td>
        <td><span class="issue-chip">${escapeHtml(issue.type)}</span></td>
        <td>${escapeHtml(issue.assetId || '-')}</td>
        <td>${escapeHtml(issue.message || '')}</td>
      </tr>`
    )
    .join('');
}

function render() {
  const visibleRecords = getVisibleRecords();
  const visibleIssues = getVisibleIssues(visibleRecords);
  renderViewTabs();
  renderStatusTabs();
  renderFilterOptions();
  renderStats(visibleRecords, visibleIssues);
  renderClubList(visibleRecords);
  renderDetail(visibleRecords);
  renderIssueTable(visibleIssues);
  elements.reviewWorkspace.hidden = state.view !== 'review';
  elements.issueWorkspace.hidden = state.view !== 'review';
  elements.auditWorkspace.hidden = state.view !== 'audit';
  if (state.view === 'audit') {
    renderAuditList(visibleRecords);
  } else {
    elements.auditList.innerHTML = '';
  }
}

function wireEvents() {
  elements.searchInput.addEventListener('input', (event) => {
    state.search = event.target.value;
    render();
  });
  elements.issueSelect.addEventListener('change', (event) => {
    state.issue = event.target.value;
    render();
  });
  elements.sourceSelect.addEventListener('change', (event) => {
    state.source = event.target.value;
    render();
  });
  elements.resetButton.addEventListener('click', () => {
    state.status = state.view === 'audit' ? 'all' : 'needs-review';
    state.issue = 'all';
    state.source = 'all';
    state.search = '';
    state.flaggedOnly = false;
    state.selectedClubKey = null;
    elements.searchInput.value = '';
    elements.flaggedOnlyInput.checked = false;
    render();
  });
  elements.flaggedOnlyInput.addEventListener('change', (event) => {
    state.flaggedOnly = event.target.checked;
    state.selectedClubKey = null;
    render();
  });
  elements.exportFlagsButton.addEventListener('click', () => {
    exportFlags();
  });
  elements.clearFlagsButton.addEventListener('click', () => {
    if (!Object.keys(state.flags).length) return;
    state.flags = {};
    writeStoredFlags();
    render();
  });
  elements.viewTabs.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-view]');
    if (!button) return;
    state.view = button.dataset.view;
    state.status = state.view === 'audit' ? 'all' : 'needs-review';
    state.issue = 'all';
    state.source = 'all';
    state.search = '';
    state.flaggedOnly = false;
    state.selectedClubKey = null;
    elements.searchInput.value = '';
    elements.flaggedOnlyInput.checked = false;
    render();
  });
  elements.statusTabs.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-status]');
    if (!button) return;
    state.status = button.dataset.status;
    state.selectedClubKey = null;
    render();
  });
  elements.clubList.addEventListener('click', (event) => {
    const row = event.target.closest('button[data-club-key]');
    if (!row) return;
    state.selectedClubKey = row.dataset.clubKey;
    render();
  });
  document.addEventListener('click', (event) => {
    const flagButton = event.target.closest('button[data-flag-key]');
    if (!flagButton) return;
    toggleFlag(flagButton.dataset.flagKey);
  });
}

async function init() {
  state.flags = readStoredFlags();
  wireEvents();
  try {
    const [metadata, review] = await Promise.all([
      fetchJson(CLUB_METADATA_URL),
      fetchJson(REVIEW_URL),
    ]);
    const issuesByClub = new Map();
    for (const issue of review.issues || []) {
      const list = issuesByClub.get(issue.clubKey) || [];
      list.push(issue);
      issuesByClub.set(issue.clubKey, list);
    }

    state.issues = review.issues || [];
    state.clubs = Object.entries(metadata.clubs || {}).map(([clubKey, club]) => {
      const record = {
        clubKey,
        club,
        issues: issuesByClub.get(clubKey) || [],
      };
      record.searchText = buildSearchText(record);
      return record;
    });
    elements.loadStatus.textContent = `Loaded ${state.clubs.length} clubs and ${state.issues.length} review issues.`;
    render();
  } catch (error) {
    elements.loadStatus.textContent = error.message;
    elements.clubList.innerHTML =
      '<p class="empty-state">Could not load local JSON. Serve the repo root over HTTP and reopen this page.</p>';
    elements.issueTableBody.innerHTML = '<tr><td colspan="4">No issue data loaded.</td></tr>';
  }
}

init();
