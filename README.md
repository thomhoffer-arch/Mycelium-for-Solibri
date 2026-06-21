# mycelium-for-solibri

A **complete, standalone** Mycelium connector for Solibri — both Solibri
surfaces in one package:

| Surface | Source | Endpoint | Mapped by |
|---|---|---|---|
| **Issues** | Presentation-view issues (BCF) | `GET /bcfxml/{version}` | shared vendored **`bcf-api.mjs`** (`topicToRow`) |
| **Checking / QA** | rule results (severity, status, rule, component) | plugin route via `SOLIBRI_CHECKING_PATH` (opt-in) | native mapper (Solibri-only) |

> **Verified against the [Solibri Developer Platform docs](https://solibri.github.io/Developer-Platform/) (2026-06).**
> The stock Solibri Desktop REST API (base path **`/solibri/v1`**, port `10876`)
> exposes a small surface — `/ping`, `/about`, `/status`,
> `GET /bcfxml/{version}`, `/models/*`, `/selectionBasket`. It has **no native
> checking-results endpoint**: Solibri delivers checking results *as BCF*
> through `/bcfxml` (export saved Presentation results). The QA surface is
> therefore **opt-in** — point `SOLIBRI_CHECKING_PATH` at a site-specific
> Solibri plugin (Java SMC API, `com.solibri.smc.api.checking`) that serves rule
> results as JSON. Unset, the connector only pulls BCF issues over REST.

Self-contained by design: it vendors the SDK *and* the canonical BCF-API mapping
(`vendor/bcf-api.mjs`), so there's **one install, no shared lib to wire up**.
Emits Connective Spine identity + freshness records (join key `ifcGuid` + `zone`,
`confidence: 'live'`).

## One-click app (no Node required)

For non-developers, build self-contained executables that bundle the Node
runtime — nothing else to install:

```bash
npm install          # dev deps: esbuild + @yao-pkg/pkg
npm run build:binaries
```

This produces two ready installers in `dist/`:

| File | Platform | How to use |
|---|---|---|
| `Mycelium-for-Solibri-Windows.zip` | Windows x64 | unzip → run `Install-Windows.cmd` (Desktop shortcut), or double-click the `.exe` |
| `Mycelium-for-Solibri-macOS.zip` | macOS (Apple Silicon + Intel) | unzip → run `Install-macOS.command` (installs to /Applications, ad-hoc signs) |

On first launch the app writes an editable `solibri.config.json` next to itself
(macOS: `~/MyceliumForSolibri/`), runs the offline demo, and writes the full
spine feed to `solibri-spine-output.json`. Point `SOLIBRI_BASE_URL` at Solibri
Desktop's REST API and launch again to go live. See `installer/README-FIRST.txt`.

> macOS binaries are cross-built unsigned; the installer ad-hoc-signs them on
> the user's Mac (`codesign --sign -`). For wide distribution, sign + notarize
> with an Apple Developer ID. Windows `.exe` is unsigned — sign with an
> Authenticode certificate to avoid SmartScreen prompts.

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
export SOLIBRI_BASE_URL=http://localhost:10876/solibri/v1   # documented base path
export SOLIBRI_TOKEN=<bearer if your setup requires one>
export SOLIBRI_PROJECT_KEY=horizons
export SOLIBRI_CHECKING_PATH=/your-plugin/results           # optional: QA surface
node connector.mjs
```

> **Verify the version.** `src/solibri-client.mjs` reads issues from
> `GET /bcfxml/2.1`; confirm `{version}` against your build's Swagger UI
> (`http://localhost:10876/solibri/v1/`). The QA surface only fires when
> `SOLIBRI_CHECKING_PATH` is set — adjust the QA field mapping (`qaToRow`) to
> your plugin's JSON. The spine mapping and conformance stay the same.

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
