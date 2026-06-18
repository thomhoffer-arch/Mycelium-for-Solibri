// Solibri Desktop REST client → spine rows.
//
// Verified against the Solibri Developer Platform docs (REST API, base path
// `/solibri/v1` on port 10876). The documented REST surface is small —
// /ping, /about, /status, GET /bcfxml/{version}, /models/*, /selectionBasket —
// so this client maps the one data-bearing endpoint and treats checking/QA
// honestly:
//
//   1. Issues   — Solibri's local BCF endpoint  GET /bcfxml/{version}
//                 "BCF content created from issues in the Presentation view."
//                 Mapped with the SHARED, vendored bcf-api mapping (topicToRow)
//                 so it stays identical to Dalux/BIMcollab.
//   2. QA       — rule checking results. The REST API does NOT expose a native
//                 checking-results endpoint: Solibri delivers checking results
//                 AS BCF through /bcfxml (export saved Presentation results),
//                 or a site-specific Solibri plugin (Java SMC API,
//                 com.solibri.smc.api.checking) can expose its own JSON route.
//                 So this surface is OPT-IN: set SOLIBRI_CHECKING_PATH to that
//                 plugin route to pull severity/status/rule/component as the
//                 Solibri-only data BCF can't express. Mapped by qaToRow below.
//
// Offline-safe: with no SOLIBRI_BASE_URL set, both surfaces return mock rows so
// `npm start` / `npm test` work in one go with zero network.
import { deriveIfcGuid } from '../vendor/mycelium-sdk.mjs';
import { topicToRow } from '../vendor/bcf-api.mjs';

// Issues (BCF). Solibri serves BCF content (a BCF archive) at this path;
// confirm the {version} against your Solibri build's Swagger UI.
const BCFXML_PATH = '/bcfxml/2.1';

const MOCK_ISSUES = [
  {
    guid: 'B-201',
    title: 'Door clearance below code',
    revit_unique_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-000000c4',
    zone: { kind: 'storey', id: 'B01', name: 'B – onderbouw' },
    modified_date: '2026-06-17T10:40:00Z',
  },
];

const MOCK_QA = [
  {
    guid: 'SOL-INT-114',
    rule: 'Intersection: Structural vs MEP',
    severity: 'critical',
    status: 'open',
    revitUniqueId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-000000a1',
    zone: { kind: 'storey', id: 'B01', name: 'B – onderbouw' },
    modified: '2026-06-17T11:02:00Z',
  },
];

async function getJson(url, token, fetchImpl = fetch) {
  const res = await fetchImpl(url, {
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`Solibri REST ${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

// Native Solibri checking-result → row (carries rule/severity/status as text).
// Exported for unit testing.
export function qaToRow(r, projectKey) {
  return {
    localId: r.guid ?? r.id,
    project: projectKey,
    ifcGuid: r.component?.ifcGuid ?? r.ifcGuid ?? (r.revitUniqueId ? safeDerive(r.revitUniqueId) : undefined),
    classification: r.classification,
    zone: r.location?.zone ?? r.zone,
    text: `${r.rule ?? ''} severity=${r.severity ?? ''} status=${r.status ?? ''}`,
    modified: r.modified ?? r.modifiedDate,
  };
}

function safeDerive(uniqueId) {
  try { return deriveIfcGuid(uniqueId); } catch { return undefined; }
}

// Returns a fetchSource() that emits BOTH surfaces as a single row array.
// Pass fetchImpl to override global fetch (used in tests).
export function makeFetchSource({ env = process.env, fetchImpl = fetch } = {}) {
  // Strip trailing slash so callers don't have to be careful about it.
  const baseUrl = env.SOLIBRI_BASE_URL?.replace(/\/+$/, '');
  const token = env.SOLIBRI_TOKEN;
  const projectKey = env.SOLIBRI_PROJECT_KEY ?? 'horizons';
  // Opt-in: a site-specific plugin route that returns checking results as JSON.
  // Unset by default because the stock REST API has no such endpoint.
  const checkingPath = env.SOLIBRI_CHECKING_PATH;

  return async function fetchSource() {
    if (!baseUrl) {
      const issues = MOCK_ISSUES.map((t) => topicToRow(t, { projectKey, deriveIfcGuid }));
      const qa = MOCK_QA.map((r) => qaToRow(r, projectKey));
      return [...issues, ...qa];
    }
    const topics = await getJson(`${baseUrl}${BCFXML_PATH}`, token, fetchImpl).catch(() => []);
    const issues = (topics ?? []).map((t) => topicToRow(t, { projectKey, deriveIfcGuid }));
    // Only hit the checking route when a plugin path is configured.
    const results = checkingPath
      ? await getJson(`${baseUrl}${checkingPath}`, token, fetchImpl).catch(() => [])
      : [];
    const qa = (results ?? []).map((r) => qaToRow(r, projectKey));
    return [...issues, ...qa];
  };
}
