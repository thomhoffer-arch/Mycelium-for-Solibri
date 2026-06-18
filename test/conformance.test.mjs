import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../connector.mjs';

test('offline mock run is spine-conformant', async () => {
  const result = await run({}); // no SOLIBRI_BASE_URL → mock mode
  assert.equal(result.conformant, true, JSON.stringify(result, null, 2));
  for (const r of result.records) {
    assert.equal(r.identity.source, 'solibri');
    assert.ok(r.identity.ifcGuid, 'every record carries the ifcGuid join key');
    assert.equal(r.freshness.confidence, 'live');
  }
});

test('both surfaces are emitted (issues + QA)', async () => {
  const result = await run({});
  const ids = result.records.map((r) => r.identity.sourceLocalId);
  assert.ok(ids.includes('B-201'), 'issue from /bcfxml present');
  assert.ok(ids.includes('SOL-INT-114'), 'checking/QA result present');
});

test('QA rule severity/status are extracted as edges', async () => {
  const result = await run({});
  const qa = result.records.find((r) => r.identity.sourceLocalId === 'SOL-INT-114');
  assert.deepEqual(qa.identity.edges?.severity, ['critical']);
  assert.deepEqual(qa.identity.edges?.status, ['open']);
});
