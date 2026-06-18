// Solibri Desktop REST client → spine rows, BOTH surfaces in one package:
//
//   1. Issues   — Solibri's local BCF endpoint  GET /bcfxml/{version}
//                 (BCF content from the Presentation view). Mapped with the
//                 SHARED, vendored bcf-api mapping (topicToRow) so it stays
//                 identical to Dalux/BIMcollab.
//   2. QA       — rule checking results          GET /checking/results
//                 (severity/status/rule/component) — Solibri-only data the
//                 BCF-API can't express. Mapped by the native mapper below.
//
// Offline-safe: with no SOLIBRI_BASE_URL set, both surfaces return mock rows so
// `npm start` / `npm test` work in one go with zero network.
import { deriveIfcGuid } from '../vendor/mycelium-sdk.mjs';
import { topicToRow } from '../vendor/bcf-api.mjs';

const BCFXML_PATH = '/bcfxml/2.1';        // issues (BCF) — confirm version
const CHECKING_PATH = '/checking/results'; // QA results — confirm against your OpenAPI

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

async function getJson(url, token) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`Solibri REST ${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

// Native Solibri checking-result → row (carries rule/severity/status as text).
function qaToRow(r, projectKey) {
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
export function makeFetchSource({ env = process.env } = {}) {
  const baseUrl = env.SOLIBRI_BASE_URL; // e.g. http://localhost:10876/api
  const token = env.SOLIBRI_TOKEN;
  const projectKey = env.SOLIBRI_PROJECT_KEY ?? 'horizons';

  return async function fetchSource() {
    if (!baseUrl) {
      const issues = MOCK_ISSUES.map((t) => topicToRow(t, { projectKey, deriveIfcGuid }));
      const qa = MOCK_QA.map((r) => qaToRow(r, projectKey));
      return [...issues, ...qa];
    }
    const topics = await getJson(`${baseUrl}${BCFXML_PATH}`, token).catch(() => []);
    const results = await getJson(`${baseUrl}${CHECKING_PATH}`, token).catch(() => []);
    const issues = (topics ?? []).map((t) => topicToRow(t, { projectKey, deriveIfcGuid }));
    const qa = (results ?? []).map((r) => qaToRow(r, projectKey));
    return [...issues, ...qa];
  };
}
