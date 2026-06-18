#!/usr/bin/env node
// mycelium-for-solibri — a COMPLETE, standalone Solibri connector covering BOTH
// Solibri surfaces in one package:
//   • issues       (Solibri /bcfxml, mapped by the shared vendored bcf-api)
//   • checking/QA  (Solibri rule results — the data BCF can't express)
// Self-contained: vendored SDK + vendored bcf-api mapping + native QA mapper.
// One install, set env vars, run.
import { runAdapter } from './vendor/mycelium-sdk.mjs';
import { makeFetchSource } from './src/solibri-client.mjs';

const config = {
  source: 'solibri',
  identity: {
    uniqueId: 'solibri:{localId}',
    projectKey: '{project}',
    localIdField: 'localId',
  },
  freshness: {
    revisionId: '{modified}',
    asOf: '{modified}',
    // 'live' while Solibri Desktop serves the REST API.
    confidence: 'live',
  },
  // Pull rule severity/status out of carried text (QA rows only).
  extract: {
    deterministic: [
      { edge: 'severity', regex: 'severity=([a-zA-Z]+)' },
      { edge: 'status', regex: 'status=([a-zA-Z]+)' },
    ],
  },
};

export async function run(env = process.env) {
  return runAdapter(config, { fetchSource: makeFetchSource({ env }) });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await run();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.conformant ? 0 : 1);
}
