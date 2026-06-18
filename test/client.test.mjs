// Unit + integration tests for src/solibri-client.mjs.
// These test the client in isolation without going through the full connector.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qaToRow, makeFetchSource } from '../src/solibri-client.mjs';
import { toSpineRecord, checkConformance } from '../vendor/mycelium-sdk.mjs';

// ── qaToRow unit tests ────────────────────────────────────────────────────────

test('qaToRow: derives ifcGuid from revitUniqueId', () => {
  const row = qaToRow({
    guid: 'SOL-1',
    rule: 'Clash',
    severity: 'critical',
    status: 'open',
    revitUniqueId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-000000a1',
    zone: { kind: 'storey', id: 'L1', name: 'Level 1' },
    modified: '2026-01-01T00:00:00Z',
  }, 'proj');
  assert.equal(row.localId, 'SOL-1');
  assert.equal(row.project, 'proj');
  assert.ok(row.ifcGuid, 'ifcGuid derived from revitUniqueId');
  assert.equal(row.zone.id, 'L1');
  assert.match(row.text, /severity=critical/);
  assert.match(row.text, /status=open/);
});

test('qaToRow: component.ifcGuid takes precedence over revitUniqueId', () => {
  const row = qaToRow({
    guid: 'SOL-2',
    component: { ifcGuid: '3DIRECT_GUID_FROM_COMPONENT' },
    revitUniqueId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-000000a1',
    modified: '2026-01-01T00:00:00Z',
  }, 'proj');
  assert.equal(row.ifcGuid, '3DIRECT_GUID_FROM_COMPONENT');
});

test('qaToRow: r.ifcGuid takes precedence over revitUniqueId', () => {
  const row = qaToRow({
    guid: 'SOL-3',
    ifcGuid: 'DIRECT_GUID',
    revitUniqueId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-000000a1',
    modified: '2026-01-01T00:00:00Z',
  }, 'proj');
  assert.equal(row.ifcGuid, 'DIRECT_GUID');
});

test('qaToRow: malformed revitUniqueId leaves ifcGuid undefined', () => {
  const row = qaToRow({
    guid: 'SOL-4',
    revitUniqueId: 'not-a-valid-revit-id',
    zone: { kind: 'storey', id: 'L1', name: 'Level 1' },
    modified: '2026-01-01T00:00:00Z',
  }, 'proj');
  assert.equal(row.ifcGuid, undefined);
  assert.ok(row.zone, 'zone still present as fallback join key');
});

test('qaToRow: no revitUniqueId leaves ifcGuid undefined, zone provides join key', () => {
  const row = qaToRow({
    guid: 'SOL-5',
    rule: 'Space naming',
    severity: 'low',
    status: 'open',
    zone: { kind: 'storey', id: 'B1', name: 'Basement' },
    modified: '2026-01-01T00:00:00Z',
  }, 'proj');
  assert.equal(row.ifcGuid, undefined);
  assert.ok(row.zone, 'zone present');
});

test('qaToRow: uses r.id as localId fallback when guid absent', () => {
  const row = qaToRow({ id: 'fallback-id', modified: '2026-01-01T00:00:00Z' }, 'proj');
  assert.equal(row.localId, 'fallback-id');
});

test('qaToRow: uses location.zone when zone field absent', () => {
  const row = qaToRow({
    guid: 'SOL-6',
    location: { zone: { kind: 'storey', id: 'L2' } },
    modified: '2026-01-01T00:00:00Z',
  }, 'proj');
  assert.deepEqual(row.zone, { kind: 'storey', id: 'L2' });
});

// ── conformance: zone-only record (no ifcGuid) ────────────────────────────────

test('zone-only QA row is spine-conformant via uniqueId + zone join keys', () => {
  const row = qaToRow({
    guid: 'SOL-7',
    zone: { kind: 'storey', id: 'L1', name: 'Level 1' },
    modified: '2026-01-01T00:00:00Z',
  }, 'proj');
  const config = {
    source: 'solibri',
    identity: { uniqueId: 'solibri:{localId}', projectKey: '{project}', localIdField: 'localId' },
    freshness: { revisionId: '{modified}', asOf: '{modified}', confidence: 'live' },
  };
  const { identity, freshness } = toSpineRecord(row, config);
  const result = checkConformance({ identity, freshness });
  assert.equal(result.conformant, true, JSON.stringify(result.errors));
  assert.ok(identity.zone, 'zone present as join key');
  assert.equal(identity.ifcGuid, undefined);
});

// ── online path routing ───────────────────────────────────────────────────────

test('online: only calls bcfxml when SOLIBRI_CHECKING_PATH is unset', async () => {
  const called = [];
  const fetchImpl = async (url) => {
    called.push(url);
    return { ok: true, json: async () => [] };
  };
  const env = { SOLIBRI_BASE_URL: 'http://localhost:10876/solibri/v1' };
  await makeFetchSource({ env, fetchImpl })();
  assert.equal(called.length, 1);
  assert.ok(called[0].includes('/bcfxml/'), `expected bcfxml call, got: ${called[0]}`);
});

test('online: calls both bcfxml and checking path when SOLIBRI_CHECKING_PATH is set', async () => {
  const called = [];
  const fetchImpl = async (url) => {
    called.push(url);
    return { ok: true, json: async () => [] };
  };
  const env = {
    SOLIBRI_BASE_URL: 'http://localhost:10876/solibri/v1',
    SOLIBRI_CHECKING_PATH: '/myplugin/results',
  };
  await makeFetchSource({ env, fetchImpl })();
  assert.equal(called.length, 2);
  assert.ok(called.some((u) => u.includes('/bcfxml/')), 'bcfxml called');
  assert.ok(called.some((u) => u.includes('/myplugin/results')), 'checking path called');
});

test('online: trailing slash in SOLIBRI_BASE_URL is stripped (no double-slash in URL)', async () => {
  const called = [];
  const fetchImpl = async (url) => {
    called.push(url);
    return { ok: true, json: async () => [] };
  };
  const env = { SOLIBRI_BASE_URL: 'http://localhost:10876/solibri/v1/' };
  await makeFetchSource({ env, fetchImpl })();
  assert.ok(!called[0].includes('//bcfxml'), `double-slash in URL: ${called[0]}`);
});

test('online: bearer token is sent in Authorization header', async () => {
  let sentHeaders;
  const fetchImpl = async (_url, opts) => {
    sentHeaders = opts.headers;
    return { ok: true, json: async () => [] };
  };
  const env = { SOLIBRI_BASE_URL: 'http://localhost:10876/solibri/v1', SOLIBRI_TOKEN: 'tok123' };
  await makeFetchSource({ env, fetchImpl })();
  assert.equal(sentHeaders.Authorization, 'Bearer tok123');
});

test('online: no Authorization header when SOLIBRI_TOKEN is unset', async () => {
  let sentHeaders;
  const fetchImpl = async (_url, opts) => {
    sentHeaders = opts.headers;
    return { ok: true, json: async () => [] };
  };
  const env = { SOLIBRI_BASE_URL: 'http://localhost:10876/solibri/v1' };
  await makeFetchSource({ env, fetchImpl })();
  assert.equal(sentHeaders.Authorization, undefined);
});

// ── error resilience ──────────────────────────────────────────────────────────

test('online: bcfxml network error → empty result, no throw', async () => {
  const fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
  const env = { SOLIBRI_BASE_URL: 'http://localhost:10876/solibri/v1' };
  const rows = await makeFetchSource({ env, fetchImpl })();
  assert.deepEqual(rows, []);
});

test('online: bcfxml non-200 response → empty result, no throw', async () => {
  const fetchImpl = async () => ({ ok: false, status: 503, statusText: 'Service Unavailable' });
  const env = { SOLIBRI_BASE_URL: 'http://localhost:10876/solibri/v1' };
  const rows = await makeFetchSource({ env, fetchImpl })();
  assert.deepEqual(rows, []);
});

test('online: checking path network error → bcfxml rows still returned', async () => {
  let callCount = 0;
  const MOCK_TOPIC = {
    guid: 'B-100',
    title: 'Test issue',
    revit_unique_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee-000000c4',
    zone: { kind: 'storey', id: 'L1', name: 'Level 1' },
    modified_date: '2026-01-01T00:00:00Z',
  };
  const fetchImpl = async (url) => {
    callCount++;
    if (url.includes('/bcfxml/')) return { ok: true, json: async () => [MOCK_TOPIC] };
    throw new Error('checking path down');
  };
  const env = {
    SOLIBRI_BASE_URL: 'http://localhost:10876/solibri/v1',
    SOLIBRI_CHECKING_PATH: '/plugin/results',
  };
  const rows = await makeFetchSource({ env, fetchImpl })();
  assert.equal(callCount, 2, 'both endpoints attempted');
  assert.equal(rows.length, 1, 'bcfxml row still returned despite QA error');
  assert.equal(rows[0].localId, 'B-100');
});

test('online: null response body is treated as empty array', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => null });
  const env = { SOLIBRI_BASE_URL: 'http://localhost:10876/solibri/v1' };
  const rows = await makeFetchSource({ env, fetchImpl })();
  assert.deepEqual(rows, []);
});

// ── projectKey handling ───────────────────────────────────────────────────────

test('online: SOLIBRI_PROJECT_KEY is used for QA rows', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('/bcfxml/')) return { ok: true, json: async () => [] };
    return {
      ok: true,
      json: async () => [{
        guid: 'SOL-99',
        severity: 'low',
        status: 'open',
        zone: { kind: 'storey', id: 'L1', name: 'Level 1' },
        modified: '2026-01-01T00:00:00Z',
      }],
    };
  };
  const env = {
    SOLIBRI_BASE_URL: 'http://localhost:10876/solibri/v1',
    SOLIBRI_PROJECT_KEY: 'custom-project',
    SOLIBRI_CHECKING_PATH: '/plugin/results',
  };
  const rows = await makeFetchSource({ env, fetchImpl })();
  assert.equal(rows[0].project, 'custom-project');
});

test('offline: SOLIBRI_PROJECT_KEY defaults to horizons', async () => {
  const rows = await makeFetchSource({ env: {} })();
  assert.ok(rows.every((r) => r.project === 'horizons'), 'default project key is horizons');
});
