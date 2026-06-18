# mycelium-for-solibri

A **complete, standalone** Mycelium connector for Solibri — both Solibri
surfaces in one package:

| Surface | Source | Endpoint | Mapped by |
|---|---|---|---|
| **Issues** | Presentation-view issues (BCF) | `GET /bcfxml/{version}` | shared vendored **`bcf-api.mjs`** (`topicToRow`) |
| **Checking / QA** | rule results (severity, status, rule, component) | `GET /checking/results` | native mapper (Solibri-only) |

Self-contained by design: it vendors the SDK *and* the canonical BCF-API mapping
(`vendor/bcf-api.mjs`), so there's **one install, no shared lib to wire up**.
Emits Connective Spine identity + freshness records (join key `ifcGuid` + `zone`,
`confidence: 'live'`).

## Build & run — in one go

Zero runtime dependencies (vendored SDK + vendored mapping).

```bash
node connector.mjs   # offline mock — prints records for BOTH surfaces
npm test             # node --test, passes offline (3 tests)
```

## Connect to Solibri Desktop

The REST API is served on localhost while Solibri Desktop runs (Solibri
Developer Platform → *Using Solibri with REST API*).

```bash
export SOLIBRI_BASE_URL=http://localhost:10876/api   # confirm host/port + base path
export SOLIBRI_TOKEN=<bearer if your setup requires one>
export SOLIBRI_PROJECT_KEY=horizons
node connector.mjs
```

> **Verify the endpoints.** `src/solibri-client.mjs` assumes `GET /bcfxml/2.1`
> for issues and `GET /checking/results` for QA. Exact paths/fields vary by
> Solibri version — check your version's OpenAPI and adjust the two path
> constants + the QA field mapping. The spine mapping and conformance stay the
> same.

## Layout

```
connector.mjs              spine config + entry (runs both surfaces)
src/solibri-client.mjs     REST client: /bcfxml issues + /checking QA (offline mock)
vendor/mycelium-sdk.mjs    vendored Connective Spine SDK (zero-dep)
vendor/bcf-api.mjs         vendored canonical BCF topic→spine mapping (re-sync from
                           Mycelium/packages/bcf-api when it changes)
test/conformance.test.mjs  asserts both surfaces are conformant
```

## Keeping the vendored mapping in sync

`vendor/bcf-api.mjs` is a copy of `Mycelium/packages/bcf-api/bcf-api.mjs` (the
canonical source). When that changes, refresh:

```bash
cp ../Mycelium/packages/bcf-api/bcf-api.mjs vendor/bcf-api.mjs
```

License: Apache-2.0.
